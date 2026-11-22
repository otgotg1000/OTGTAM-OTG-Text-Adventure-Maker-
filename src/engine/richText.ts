import { PlaySession, StoryProject } from '../types/story';

/**
 * Evaluates inline conditional blocks (`{{if flag:name}}...{{/if}}`, `{{if item:name}}...{{/if}}`,
 * `{{if visited:titleOrId}}...{{/if}}`) and variable substitutions (`{{stat:name}}`, `{{item:name}}`,
 * `{{flag:name}}`, `{{title}}`, `{{author}}`) safely as plain text.
 */
export function interpolateStoryText(
  text: string,
  project: StoryProject,
  session: PlaySession
): string {
  if (!text) return '';

  // 1. Evaluate conditional text blocks {{if kind:key}}...{{/if}}
  let out = text.replace(
    /\{\{if\s+(flag|item|visited):([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/gi,
    (_match, kindRaw: string, keyRaw: string, inner: string) => {
      const kind = kindRaw.toLowerCase();
      const key = keyRaw.trim().toLowerCase();

      if (kind === 'flag') {
        const flagDef = (project.rpgConfig.flags || []).find(
          (f) => f.id.toLowerCase() === key || f.name.toLowerCase() === key
        );
        const flagId = flagDef?.id ?? keyRaw.trim();
        return session.flags?.[flagId] ? inner : '';
      }

      if (kind === 'item') {
        const itemDef = project.rpgConfig.items.find(
          (i) => i.id.toLowerCase() === key || i.name.toLowerCase() === key
        );
        const itemId = itemDef?.id ?? keyRaw.trim();
        return (session.inventory[itemId] ?? 0) > 0 ? inner : '';
      }

      if (kind === 'visited') {
        const p = Object.values(project.passages).find(
          (node) => node.id.toLowerCase() === key || node.title.toLowerCase() === key
        );
        const pid = p?.id ?? keyRaw.trim();
        const visited =
          session.visitedPassageIds?.includes(pid) || session.history.includes(pid);
        return visited ? inner : '';
      }

      return '';
    }
  );

  // 2. Replace variable tokens {{stat:...}}, {{item:...}}, {{flag:...}}, {{title}}, {{author}}
  out = out.replace(/\{\{([^}]+)\}\}/g, (match, exprRaw: string) => {
    const expr = exprRaw.trim();
    const lower = expr.toLowerCase();

    if (lower === 'title') return project.meta.title || '';
    if (lower === 'author') return project.meta.author || '';

    const colonIdx = expr.indexOf(':');
    if (colonIdx === -1) return match;

    const kind = expr.slice(0, colonIdx).trim().toLowerCase();
    const target = expr.slice(colonIdx + 1).trim();
    const targetLower = target.toLowerCase();

    if (kind === 'stat') {
      const statDef = project.rpgConfig.stats.find(
        (s) => s.id.toLowerCase() === targetLower || s.name.toLowerCase() === targetLower
      );
      const id = statDef?.id ?? target;
      return String(session.stats[id] ?? statDef?.initial ?? 0);
    }

    if (kind === 'item') {
      const itemDef = project.rpgConfig.items.find(
        (i) => i.id.toLowerCase() === targetLower || i.name.toLowerCase() === targetLower
      );
      const id = itemDef?.id ?? target;
      return String(session.inventory[id] ?? 0);
    }

    if (kind === 'flag') {
      const flagDef = (project.rpgConfig.flags || []).find(
        (f) => f.id.toLowerCase() === targetLower || f.name.toLowerCase() === targetLower
      );
      const id = flagDef?.id ?? target;
      return session.flags?.[id] ? 'True' : 'False';
    }

    return match;
  });

  return out;
}

export type RichLineBlock =
  | { type: 'hr' }
  | { type: 'quote'; text: string }
  | { type: 'paragraph'; text: string };

export function parseRichLines(text: string): RichLineBlock[] {
  const lines = text.split('\n');
  const blocks: RichLineBlock[] = [];
  let paraLines: string[] = [];

  const flushPara = () => {
    if (paraLines.length > 0) {
      const joined = paraLines.join('\n').trim();
      if (joined) blocks.push({ type: 'paragraph', text: joined });
      paraLines = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed === '---' || trimmed === '***') {
      flushPara();
      blocks.push({ type: 'hr' });
    } else if (trimmed.startsWith('> ')) {
      flushPara();
      blocks.push({ type: 'quote', text: trimmed.slice(2) });
    } else if (trimmed === '') {
      flushPara();
    } else {
      paraLines.push(rawLine);
    }
  }
  flushPara();
  return blocks;
}

export type InlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string };

export function parseInlineFormatting(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      segments.push({ kind: 'bold', text: token.slice(2, -2) });
    } else if (token.startsWith('*') && token.endsWith('*')) {
      segments.push({ kind: 'italic', text: token.slice(1, -1) });
    } else if (token.startsWith('`') && token.endsWith('`')) {
      segments.push({ kind: 'code', text: token.slice(1, -1) });
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}
