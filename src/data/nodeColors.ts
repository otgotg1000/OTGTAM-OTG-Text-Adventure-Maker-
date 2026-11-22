import { CustomNodeColor, NodeColor } from '../types/story';

export interface NodeColorMeta {
  id: NodeColor;
  label: string;
  meaningHint: string;
  hex: string;
  isCustom?: boolean;
  swatchClass: string;
  cardClass: string;
  textClass: string;
}

export const NODE_COLORS: NodeColorMeta[] = [
  {
    id: 'none',
    label: 'Default',
    meaningHint: 'Neutral passage',
    hex: '#64748B',
    swatchClass: 'bg-slate-500',
    cardClass: 'border-[var(--border-hairline)] bg-[var(--bg-surface)]',
    textClass: 'text-[var(--text-muted)]',
  },
  {
    id: 'emerald',
    label: 'Green',
    meaningHint: 'Happy ending / Safe',
    hex: '#10B981',
    swatchClass: 'bg-emerald-500',
    cardClass: 'border-emerald-500/60 bg-emerald-500/10',
    textClass: 'text-emerald-500',
  },
  {
    id: 'amber',
    label: 'Amber',
    meaningHint: 'Main plot / Hub',
    hex: '#F59E0B',
    swatchClass: 'bg-amber-500',
    cardClass: 'border-amber-500/60 bg-amber-500/10',
    textClass: 'text-amber-500',
  },
  {
    id: 'sky',
    label: 'Blue',
    meaningHint: 'Clue / Investigation',
    hex: '#0EA5E9',
    swatchClass: 'bg-sky-500',
    cardClass: 'border-sky-500/60 bg-sky-500/10',
    textClass: 'text-sky-500',
  },
  {
    id: 'violet',
    label: 'Violet',
    meaningHint: 'Secret / Twist',
    hex: '#8B5CF6',
    swatchClass: 'bg-violet-500',
    cardClass: 'border-violet-500/60 bg-violet-500/10',
    textClass: 'text-violet-500',
  },
  {
    id: 'crimson',
    label: 'Red',
    meaningHint: 'Danger / Bad ending',
    hex: '#EF4444',
    swatchClass: 'bg-red-500',
    cardClass: 'border-red-500/60 bg-red-500/10',
    textClass: 'text-red-500',
  },
];

export function getAllNodeColors(customColors?: CustomNodeColor[]): NodeColorMeta[] {
  const customMetas: NodeColorMeta[] = (customColors || []).map((c) => ({
    id: c.id,
    label: c.label,
    meaningHint: c.meaningHint,
    hex: c.hex,
    isCustom: true,
    swatchClass: '',
    cardClass: '',
    textClass: '',
  }));
  return [...NODE_COLORS, ...customMetas];
}

export function getNodeColorMeta(
  color?: NodeColor,
  customColors?: CustomNodeColor[]
): NodeColorMeta {
  if (!color || color === 'none') return NODE_COLORS[0];
  const builtin = NODE_COLORS.find((c) => c.id === color);
  if (builtin) return builtin;

  const custom = (customColors || []).find((c) => c.id === color);
  if (custom) {
    return {
      id: custom.id,
      label: custom.label,
      meaningHint: custom.meaningHint,
      hex: custom.hex,
      isCustom: true,
      swatchClass: '',
      cardClass: '',
      textClass: '',
    };
  }
  return NODE_COLORS[0];
}
