import { StoryProject } from '../types/story';
import { getPassageConnections } from './rpgEngine';

export interface StoryIssue {
  id: string;
  severity: 'error' | 'warning';
  kind: 'broken_link' | 'unreachable' | 'dead_end' | 'empty_body' | 'missing_start';
  passageId?: string;
  passageTitle?: string;
  detailText?: string;
}

export function validateStoryProject(project: StoryProject): StoryIssue[] {
  const issues: StoryIssue[] = [];
  const passages = project.passages;
  const startId = project.meta.startPassageId;

  if (!startId || !passages[startId]) {
    issues.push({
      id: 'missing_start',
      severity: 'error',
      kind: 'missing_start',
    });
  }

  // BFS reachability from start passage
  const reachable = new Set<string>();
  if (startId && passages[startId]) {
    const queue = [startId];
    reachable.add(startId);
    while (queue.length > 0) {
      const currId = queue.shift()!;
      const curr = passages[currId];
      if (!curr) continue;
      for (const conn of getPassageConnections(curr)) {
        if (passages[conn.toId] && !reachable.has(conn.toId)) {
          reachable.add(conn.toId);
          queue.push(conn.toId);
        }
      }
    }
  }

  for (const p of Object.values(passages)) {
    const connections = getPassageConnections(p);

    // 1. Broken targets
    for (let i = 0; i < connections.length; i++) {
      const conn = connections[i];
      if (!passages[conn.toId]) {
        issues.push({
          id: `broken_${p.id}_${i}`,
          severity: 'error',
          kind: 'broken_link',
          passageId: p.id,
          passageTitle: p.title,
          detailText: conn.label,
        });
      }
    }

    // 2. Unreachable from start
    if (startId && passages[startId] && !reachable.has(p.id)) {
      issues.push({
        id: `orphan_${p.id}`,
        severity: 'warning',
        kind: 'unreachable',
        passageId: p.id,
        passageTitle: p.title,
      });
    }

    // 3. Unmarked dead-end (no outgoing choices, no skillCheck, no combat, not marked ending)
    const hasBranching =
      p.choices.length > 0 || Boolean(p.skillCheck) || Boolean(p.combat);
    const implicitlyEnding =
      Boolean(p.isEnding) || p.color === 'emerald' || p.color === 'crimson';

    if (!hasBranching && !implicitlyEnding) {
      issues.push({
        id: `deadend_${p.id}`,
        severity: 'warning',
        kind: 'dead_end',
        passageId: p.id,
        passageTitle: p.title,
      });
    }

    // 4. Empty body
    if (!p.body || !p.body.trim()) {
      issues.push({
        id: `empty_${p.id}`,
        severity: 'warning',
        kind: 'empty_body',
        passageId: p.id,
        passageTitle: p.title,
      });
    }
  }

  return issues;
}
