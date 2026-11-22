export type AppLanguage = 'en' | 'id' | 'es' | 'fr' | 'ja' | 'ko' | 'zh' | 'de';

export type WorkspaceTab =
  | 'home'
  | 'map'
  | 'rpg'
  | 'media'
  | 'story-settings'
  | 'export';

export type StoryGenre =
  | 'rpg'
  | 'mystery'
  | 'scifi'
  | 'horror'
  | 'romance'
  | 'interactive';

export type BuiltinNodeColor =
  | 'none'
  | 'emerald'
  | 'amber'
  | 'sky'
  | 'violet'
  | 'crimson';

export type NodeColor = BuiltinNodeColor | (string & {});

export interface CustomNodeColor {
  id: string;
  label: string;
  meaningHint: string;
  hex: string;
}

export type StatDisplayMode = 'bar' | 'attribute' | 'currency';

export interface StatDefinition {
  id: string;
  name: string;
  initial: number;
  min: number;
  max: number;
  display: StatDisplayMode;
}

export type ItemCategory = 'consumable' | 'key' | 'equipment';

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  /** Stat bonus applied when consumed (for consumables) or passively counted (for equipment) */
  effectStatId?: string;
  effectAmount?: number;
}

export type QuestStatus = 'hidden' | 'active' | 'completed' | 'failed';

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  initialStatus: QuestStatus;
}

export interface FactionDefinition {
  id: string;
  name: string;
  description: string;
  initialReputation: number;
}

export interface FlagDefinition {
  id: string;
  name: string;
  description: string;
  initialValue: boolean;
}

export type EffectAction =
  | {
      id: string;
      kind: 'stat';
      statId: string;
      operation: 'add' | 'set';
      value: number;
    }
  | {
      id: string;
      kind: 'item';
      itemId: string;
      operation: 'give' | 'take';
      quantity: number;
    }
  | {
      id: string;
      kind: 'quest';
      questId: string;
      status: QuestStatus;
    }
  | {
      id: string;
      kind: 'faction';
      factionId: string;
      delta: number;
    }
  | {
      id: string;
      kind: 'flag';
      flagId: string;
      value: boolean;
    };

export type ConditionRule =
  | {
      kind: 'stat_gte';
      statId: string;
      value: number;
    }
  | {
      kind: 'stat_lte';
      statId: string;
      value: number;
    }
  | {
      kind: 'has_item';
      itemId: string;
    }
  | {
      kind: 'quest_status';
      questId: string;
      status: QuestStatus;
    }
  | {
      kind: 'faction_gte';
      factionId: string;
      value: number;
    }
  | {
      kind: 'flag_is';
      flagId: string;
      value: boolean;
    }
  | {
      kind: 'visited_passage';
      passageId: string;
      visited: boolean;
    };

export type DiceType = 'd20' | '2d6' | 'd100';

export interface SkillCheckConfig {
  id: string;
  label: string;
  statId: string;
  dice: DiceType;
  difficulty: number;
  successPassageId: string;
  failurePassageId: string;
  successEffects: EffectAction[];
  failureEffects: EffectAction[];
}

export interface CombatConfig {
  id: string;
  enemyName: string;
  enemyPortraitId?: string;
  enemyMaxHp: number;
  enemyAttackMin: number;
  enemyAttackMax: number;
  enemyDefense: number;
  playerHpStatId: string;
  playerAttackStatId: string;
  lootItemId?: string;
  victoryPassageId: string;
  defeatPassageId: string;
  fleePassageId?: string;
}

export interface PassageChoice {
  id: string;
  label: string;
  targetPassageId: string;
  condition?: ConditionRule;
  hideWhenLocked?: boolean;
  effects: EffectAction[];
  sfxId?: string;
}

export interface Passage {
  id: string;
  title: string;
  tags: string[];
  color?: NodeColor;
  isEnding?: boolean;
  x: number;
  y: number;
  createdAt?: number;
  body: string;
  imageId?: string;
  ambientAudioId?: string;
  ambientLoop?: boolean;
  entrySfxId?: string;
  entryEffects: EffectAction[];
  choices: PassageChoice[];
  skillCheck?: SkillCheckConfig;
  combat?: CombatConfig;
}

export type MediaAssetKind = 'image' | 'audio';
export type MediaAssetSource = 'builtin' | 'upload' | 'synth';
export type AudioRole = 'sfx' | 'ambient';

export interface MediaAsset {
  id: string;
  name: string;
  kind: MediaAssetKind;
  source: MediaAssetSource;
  url?: string;
  synthPreset?: string;
  audioRole?: AudioRole;
  description?: string;
}

export interface RpgConfig {
  stats: StatDefinition[];
  items: ItemDefinition[];
  quests: QuestDefinition[];
  factions: FactionDefinition[];
  flags?: FlagDefinition[];
}

export interface StoryMeta {
  title: string;
  author: string;
  subtitle: string;
  genre: StoryGenre;
  startPassageId: string;
  storyTheme?: StudioThemeId;
  customStoryTheme?: CustomStoryTheme;
  storyLayout?: StoryLayoutId;
  storyFont?: StoryFontId;
  storyFontSize?: StoryFontSizeId;
  storyLanguage?: AppLanguage;
}

export interface StoryProject {
  id: string;
  version: number;
  meta: StoryMeta;
  rpgConfig: RpgConfig;
  assets: MediaAsset[];
  customColors?: CustomNodeColor[];
  passages: Record<string, Passage>;
  updatedAt: string;
}

export interface DiceRollResult {
  checkLabel: string;
  statName: string;
  dice: DiceType;
  rawRolls: number[];
  modifier: number;
  total: number;
  difficulty: number;
  passed: boolean;
  nextPassageId: string;
}

export interface CombatState {
  enemyName: string;
  enemyPortraitId?: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyAttackMin: number;
  enemyAttackMax: number;
  enemyDefense: number;
  playerHpStatId: string;
  playerAttackStatId: string;
  lootItemId?: string;
  victoryPassageId: string;
  defeatPassageId: string;
  fleePassageId?: string;
  defending: boolean;
  resolved: 'ongoing' | 'victory' | 'defeat' | 'fled';
  log: string[];
}

export interface SessionSnapshot {
  currentPassageId: string;
  history: string[];
  stats: Record<string, number>;
  inventory: Record<string, number>;
  quests: Record<string, QuestStatus>;
  factions: Record<string, number>;
  flags?: Record<string, boolean>;
  visitedPassageIds?: string[];
  notifications: string[];
  lastRoll: DiceRollResult | null;
  combat: CombatState | null;
}

export interface PlaySession {
  currentPassageId: string;
  history: string[];
  stats: Record<string, number>;
  inventory: Record<string, number>;
  quests: Record<string, QuestStatus>;
  factions: Record<string, number>;
  flags?: Record<string, boolean>;
  visitedPassageIds?: string[];
  notifications: string[];
  lastRoll: DiceRollResult | null;
  combat: CombatState | null;
  undoStack?: SessionSnapshot[];
}

export type InlineImageSize = 75 | 50 | 25;

export type BodyBlock =
  | { type: 'text'; content: string }
  | {
      type: 'image';
      assetId: string;
      caption: string;
      size: InlineImageSize;
      rawToken: string;
    };

export type StoryLayoutId =
  | 'rpg-split'
  | 'blog-journal'
  | 'dossier-left'
  | 'terminal-hud'
  | 'cinematic-stage';

export type StoryFontId =
  | 'serif-editorial'
  | 'serif-classic'
  | 'sans-modern'
  | 'sans-literary'
  | 'mono-console';

export type StoryFontSizeId = 'sm' | 'md' | 'lg' | 'xl';

export type BuiltinStudioThemeId =
  | 'obsidian-amber'
  | 'midnight-sky'
  | 'forest-emerald'
  | 'parchment-light'
  | 'crimson-noir';

export type StudioThemeId = BuiltinStudioThemeId | (string & {});

export interface StoryThemeTokens {
  bg: string;
  surface: string;
  elevated: string;
  hover: string;
  border: string;
  text: string;
  textSecondary: string;
  muted: string;
  accent: string;
  accentHover: string;
  accentContrast: string;
}

export interface CustomStoryTheme {
  id: string;
  name: string;
  description: string;
  swatches: [string, string, string];
  tokens: StoryThemeTokens;
  isCustom: true;
}

export interface StudioSettings {
  language: AppLanguage;
  theme: StudioThemeId;
  storyTheme: StudioThemeId;
  defaultStoryLayout: StoryLayoutId;
  defaultStoryFont: StoryFontId;
  defaultStoryFontSize: StoryFontSizeId;
  customStoryThemes: CustomStoryTheme[];
  defaultSnapToGrid: boolean;
  autoCompressImages?: boolean;
  masterVolume: number;
  muted: boolean;
  defaultAuthor: string;
}

