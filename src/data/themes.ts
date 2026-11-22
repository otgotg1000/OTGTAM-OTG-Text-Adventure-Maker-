import type { CSSProperties } from 'react';
import {
  CustomStoryTheme,
  StoryFontId,
  StoryFontSizeId,
  StoryGenre,
  StoryLayoutId,
  StoryThemeTokens,
  StudioThemeId,
} from '../types/story';

export interface StudioThemeOption {
  id: StudioThemeId;
  name: string;
  description: string;
  swatches: [string, string, string];
  tokens: StoryThemeTokens;
  isCustom?: boolean;
}

export interface StoryLayoutOption {
  id: StoryLayoutId;
  name: string;
  description: string;
  bestFor: string;
}

export interface StoryFontOption {
  id: StoryFontId;
  name: string;
  description: string;
  cssFamily: string;
}

export const STORY_FONTS: StoryFontOption[] = [
  {
    id: 'serif-editorial',
    name: 'Source Serif',
    description: 'Warm editorial book prose',
    cssFamily: "'Source Serif 4', Georgia, serif",
  },
  {
    id: 'serif-classic',
    name: 'Lora Classic',
    description: 'Literary high-contrast serif',
    cssFamily: "'Lora', 'Palatino Linotype', Georgia, serif",
  },
  {
    id: 'sans-modern',
    name: 'Jakarta Sans',
    description: 'Crisp contemporary UI & fiction',
    cssFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  {
    id: 'sans-literary',
    name: 'DM Sans',
    description: 'Clean humanist reader sans',
    cssFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
  },
  {
    id: 'mono-console',
    name: 'JetBrains Mono',
    description: 'Terminal logs, dossiers & sci-fi',
    cssFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  },
];

export function getStoryFontOption(id?: StoryFontId): StoryFontOption {
  return STORY_FONTS.find((f) => f.id === id) || STORY_FONTS[0];
}

export interface StoryFontSizeOption {
  id: StoryFontSizeId;
  name: string;
  label: string;
  cssSize: string;
  lineHeight: string;
}

export const STORY_FONT_SIZES: StoryFontSizeOption[] = [
  {
    id: 'sm',
    name: 'Compact',
    label: '15px',
    cssSize: '15px',
    lineHeight: '1.66',
  },
  {
    id: 'md',
    name: 'Medium',
    label: '18px',
    cssSize: '18px',
    lineHeight: '1.74',
  },
  {
    id: 'lg',
    name: 'Large',
    label: '21px',
    cssSize: '21px',
    lineHeight: '1.8',
  },
  {
    id: 'xl',
    name: 'Extra Large',
    label: '24px',
    cssSize: '24px',
    lineHeight: '1.82',
  },
];

export function getStoryFontSizeOption(id?: StoryFontSizeId): StoryFontSizeOption {
  return STORY_FONT_SIZES.find((s) => s.id === id) || STORY_FONT_SIZES[1];
}

export const STORY_LAYOUTS: StoryLayoutOption[] = [
  {
    id: 'rpg-split',
    name: 'Classic RPG Split HUD',
    description:
      'Story stage on the left paired with a persistent RPG Stats & Inventory panel on the right.',
    bestFor: 'Fantasy & RPG',
  },
  {
    id: 'blog-journal',
    name: 'Editorial Blog & Novel',
    description:
      'Centered single-column reading stream with wide inline images and a collapsible notes drawer.',
    bestFor: 'Interactive Fiction & Romance',
  },
  {
    id: 'dossier-left',
    name: 'Casefile & Dossier (Left HUD)',
    description:
      'Left-docked evidence & vitals ledger paired with a crisp, structured narrative dossier.',
    bestFor: 'Mystery & Detective',
  },
  {
    id: 'terminal-hud',
    name: 'Sci-Fi Console HUD',
    description:
      'Top horizontal telemetry bar above a framed command-prompt narrative console.',
    bestFor: 'Sci-Fi & Cyberpunk',
  },
  {
    id: 'cinematic-stage',
    name: 'Cinematic Theater',
    description:
      'Wide atmospheric hero stage, centered choices, and an on-demand slide-over Story Sheet.',
    bestFor: 'Horror & Visual Stories',
  },
];

export function getStoryLayoutOption(id?: StoryLayoutId): StoryLayoutOption {
  return STORY_LAYOUTS.find((l) => l.id === id) || STORY_LAYOUTS[0];
}

export function getDefaultLayoutForGenre(genre?: StoryGenre): StoryLayoutId {
  switch (genre) {
    case 'interactive':
    case 'romance':
      return 'blog-journal';
    case 'mystery':
      return 'dossier-left';
    case 'scifi':
      return 'terminal-hud';
    case 'horror':
      return 'cinematic-stage';
    case 'rpg':
    default:
      return 'rpg-split';
  }
}

export const STUDIO_THEMES: StudioThemeOption[] = [
  {
    id: 'obsidian-amber',
    name: 'Obsidian & Amber',
    description: 'Deep studio dark with warm gold accents',
    swatches: ['#0B0E14', '#141923', '#F59E0B'],
    tokens: {
      bg: '#0B0E14',
      surface: '#141923',
      elevated: '#1B2230',
      hover: '#232C3E',
      border: '#283244',
      text: '#F1F5F9',
      textSecondary: '#CBD5E1',
      muted: '#94A3B8',
      accent: '#F59E0B',
      accentHover: '#FBBF24',
      accentContrast: '#0B0E14',
    },
  },
  {
    id: 'midnight-sky',
    name: 'Midnight & Sky',
    description: 'Cool slate navy with crisp cyan focus',
    swatches: ['#080D18', '#0F172A', '#38BDF8'],
    tokens: {
      bg: '#080D18',
      surface: '#0F172A',
      elevated: '#18233B',
      hover: '#213050',
      border: '#273859',
      text: '#F1F5F9',
      textSecondary: '#CBD5E1',
      muted: '#94A3B8',
      accent: '#38BDF8',
      accentHover: '#7DD3FC',
      accentContrast: '#080D18',
    },
  },
  {
    id: 'forest-emerald',
    name: 'Forest & Emerald',
    description: 'Charcoal moss with emerald highlights',
    swatches: ['#09110E', '#111C18', '#10B981'],
    tokens: {
      bg: '#09110E',
      surface: '#111C18',
      elevated: '#182722',
      hover: '#21362F',
      border: '#263D34',
      text: '#ECFDF5',
      textSecondary: '#CBD5E1',
      muted: '#94A3B8',
      accent: '#10B981',
      accentHover: '#34D399',
      accentContrast: '#052E16',
    },
  },
  {
    id: 'parchment-light',
    name: 'Warm Parchment',
    description: 'High-contrast daylight paper & ink',
    swatches: ['#F5F2EB', '#FFFFFF', '#D97706'],
    tokens: {
      bg: '#F5F2EB',
      surface: '#FFFFFF',
      elevated: '#EDE9DF',
      hover: '#E3DDD0',
      border: '#D6CFC1',
      text: '#1C1917',
      textSecondary: '#44403C',
      muted: '#78716C',
      accent: '#D97706',
      accentHover: '#B45309',
      accentContrast: '#FFFFFF',
    },
  },
  {
    id: 'crimson-noir',
    name: 'Crimson Noir',
    description: 'Obsidian #0C0C0C main, #EEEEEE text, #872341 crimson accent',
    swatches: ['#0C0C0C', '#EEEEEE', '#872341'],
    tokens: {
      bg: '#0C0C0C',
      surface: '#141214',
      elevated: '#1E181C',
      hover: '#292026',
      border: '#34262D',
      text: '#EEEEEE',
      textSecondary: '#D4CED1',
      muted: '#9D9398',
      accent: '#872341',
      accentHover: '#A42D51',
      accentContrast: '#EEEEEE',
    },
  },
];

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return [r, g, b];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`.toUpperCase();
}

function mixHex(a: string, b: string, weightB: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const wA = 1 - weightB;
  return toHex(r1 * wA + r2 * weightB, g1 * wA + g2 * weightB, b1 * wA + b2 * weightB);
}

function getLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function buildCustomStoryTheme(input: {
  name: string;
  bg: string;
  surface: string;
  text: string;
  accent: string;
}): CustomStoryTheme {
  const bgLum = getLuminance(input.bg);
  const isLight = bgLum > 0.45;
  const accentLum = getLuminance(input.accent);

  const elevated = isLight
    ? mixHex(input.surface, '#000000', 0.06)
    : mixHex(input.surface, input.text, 0.06);
  const hover = isLight
    ? mixHex(input.surface, '#000000', 0.12)
    : mixHex(input.surface, input.text, 0.12);
  const border = isLight
    ? mixHex(input.surface, input.text, 0.18)
    : mixHex(input.surface, input.text, 0.16);
  const textSecondary = mixHex(input.text, input.surface, 0.22);
  const muted = mixHex(input.text, input.surface, 0.44);
  const accentHover =
    accentLum > 0.45
      ? mixHex(input.accent, '#000000', 0.14)
      : mixHex(input.accent, '#FFFFFF', 0.16);
  const accentContrast = accentLum > 0.36 ? '#0C0C0C' : '#F8FAFC';

  return {
    id: `ctheme_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    name: input.name.trim() || 'Custom Theme',
    description: `${input.bg.toUpperCase()} · ${input.text.toUpperCase()} · ${input.accent.toUpperCase()}`,
    swatches: [input.bg.toUpperCase(), input.text.toUpperCase(), input.accent.toUpperCase()],
    tokens: {
      bg: input.bg.toUpperCase(),
      surface: input.surface.toUpperCase(),
      elevated,
      hover,
      border,
      text: input.text.toUpperCase(),
      textSecondary,
      muted,
      accent: input.accent.toUpperCase(),
      accentHover,
      accentContrast,
    },
    isCustom: true,
  };
}

export function getAllStoryThemes(
  customThemes: CustomStoryTheme[] = [],
  embeddedCustomTheme?: CustomStoryTheme
): StudioThemeOption[] {
  const list: StudioThemeOption[] = [...STUDIO_THEMES, ...customThemes];
  if (embeddedCustomTheme && !list.some((t) => t.id === embeddedCustomTheme.id)) {
    list.push(embeddedCustomTheme);
  }
  return list;
}

export function getStudioThemeOption(
  id?: StudioThemeId,
  customThemes: CustomStoryTheme[] = [],
  embeddedCustomTheme?: CustomStoryTheme
): StudioThemeOption {
  const all = getAllStoryThemes(customThemes, embeddedCustomTheme);
  return all.find((t) => t.id === id) || STUDIO_THEMES[0];
}

export function getThemeCssVars(theme: StudioThemeOption): CSSProperties {
  return {
    ['--bg-canvas' as string]: theme.tokens.bg,
    ['--bg-surface' as string]: theme.tokens.surface,
    ['--bg-elevated' as string]: theme.tokens.elevated,
    ['--bg-hover' as string]: theme.tokens.hover,
    ['--border-hairline' as string]: theme.tokens.border,
    ['--text-primary' as string]: theme.tokens.text,
    ['--text-secondary' as string]: theme.tokens.textSecondary,
    ['--text-muted' as string]: theme.tokens.muted,
    ['--accent-primary' as string]: theme.tokens.accent,
    ['--accent-hover' as string]: theme.tokens.accentHover,
    ['--accent-contrast' as string]: theme.tokens.accentContrast,
  };
}

export const READER_LIGHT_TOKENS: StoryThemeTokens = {
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  elevated: '#F1EFEA',
  hover: '#E8E4DC',
  border: '#D6D3CD',
  text: '#1C1917',
  textSecondary: '#44403C',
  muted: '#78716C',
  accent: '#B45309',
  accentHover: '#92400E',
  accentContrast: '#FFFFFF',
};

export const READER_DARK_TOKENS: StoryThemeTokens = {
  bg: '#0B0E14',
  surface: '#141923',
  elevated: '#1C2331',
  hover: '#242C3D',
  border: '#2A3346',
  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  muted: '#94A3B8',
  accent: '#F59E0B',
  accentHover: '#D97706',
  accentContrast: '#0B0E14',
};

