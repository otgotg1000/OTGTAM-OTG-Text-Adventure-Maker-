import {
  ArrowDown,
  ArrowUp,
  Bold,
  Compass,
  Dices,
  EyeOff,
  Flag,
  Image as ImageIcon,
  ImagePlus,
  Italic,
  Link2,
  Lock,
  PanelRightClose,
  Play,
  Plus,
  Quote,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { ChangeEvent, useRef, useState } from 'react';
import { synthEngine } from '../audio/synthEngine';
import { getAllNodeColors, getNodeColorMeta } from '../data/nodeColors';
import { parseBodyBlocks, parseInlineLinks } from '../engine/rpgEngine';
import { getPassageWordCount } from '../engine/textStats';
import { useI18n } from '../i18n/LanguageContext';
import {
  CombatConfig,
  ConditionRule,
  CustomNodeColor,
  EffectAction,
  InlineImageSize,
  MediaAsset,
  Passage,
  PassageChoice,
  QuestStatus,
  SkillCheckConfig,
  StoryProject,
} from '../types/story';

interface PassageInspectorProps {
  project: StoryProject;
  passage: Passage | null;
  onUpdatePassage: (id: string, patch: Partial<Passage>) => void;
  onDeletePassage: (id: string) => void;
  onSetStartPassage: (id: string) => void;
  onPlayFromPassage: (id: string) => void;
  onCreateConnectedPassage: (fromPassageId: string, initialTitle?: string) => string;
  onUploadMediaAsset: (
    file: File,
    kind: 'image' | 'audio',
    audioRole?: 'sfx' | 'ambient'
  ) => Promise<MediaAsset | null>;
  onCreateCustomColor: (color: Omit<CustomNodeColor, 'id'>) => string;
  onDeleteCustomColor: (colorId: string) => void;
  onCollapse: () => void;
}

export function PassageInspector({
  project,
  passage,
  onUpdatePassage,
  onDeletePassage,
  onSetStartPassage,
  onPlayFromPassage,
  onCreateConnectedPassage,
  onUploadMediaAsset,
  onCreateCustomColor,
  onDeleteCustomColor,
  onCollapse,
}: PassageInspectorProps) {
  const { t } = useI18n();
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [showInlineImageDrawer, setShowInlineImageDrawer] = useState(false);
  const [showCustomColorForm, setShowCustomColorForm] = useState(false);
  const [customColorLabel, setCustomColorLabel] = useState('');
  const [customColorMeaning, setCustomColorMeaning] = useState('');
  const [customColorHex, setCustomColorHex] = useState('#EC4899');
  const [tagInput, setTagInput] = useState('');
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const inlineUploadRef = useRef<HTMLInputElement>(null);
  const audioUploadRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  if (!passage) {
    return (
      <aside className="w-[440px] shrink-0 border-l border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col h-full">
        <div className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text-muted)]">{t.inspector.inspectorTitle}</span>
          <button
            type="button"
            onClick={onCollapse}
            title={t.inspector.collapseInspector}
            aria-label={t.inspector.collapseInspector}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-[var(--text-secondary)]">{t.inspector.noPassageSelected}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)] max-w-xs">
            {t.inspector.noPassageHint}
          </p>
        </div>
      </aside>
    );
  }

  const allPassages = Object.values(project.passages);
  const imageAssets = project.assets.filter((a) => a.kind === 'image');
  const ambientAssets = project.assets.filter(
    (a) => a.kind === 'audio' && a.audioRole === 'ambient'
  );
  const sfxAssets = project.assets.filter(
    (a) => a.kind === 'audio' && a.audioRole !== 'ambient'
  );

  const attachedImage = passage.imageId
    ? project.assets.find((a) => a.id === passage.imageId)
    : undefined;
  const isStart = project.meta.startPassageId === passage.id;
  const inlineLinks = parseInlineLinks(passage.body);
  const inlineImageBlocks = parseBodyBlocks(passage.body).filter(
    (b): b is Extract<ReturnType<typeof parseBodyBlocks>[number], { type: 'image' }> =>
      b.type === 'image'
  );
  const allColors = getAllNodeColors(project.customColors);
  const activeColorMeta = getNodeColorMeta(passage.color, project.customColors);
  const customColors = project.customColors || [];

  const handleSaveCustomColor = () => {
    const label = customColorLabel.trim();
    if (!label) return;
    const newId = onCreateCustomColor({
      label,
      meaningHint: customColorMeaning.trim() || 'Custom story tag',
      hex: customColorHex,
    });
    onUpdatePassage(passage.id, { color: newId });
    setCustomColorLabel('');
    setCustomColorMeaning('');
    setShowCustomColorForm(false);
  };

  const insertInlineImageAtCursor = (asset: MediaAsset) => {
    const token = `[[img:${asset.id}|${asset.name}|75]]`;
    const el = bodyTextareaRef.current;
    if (el) {
      const start = el.selectionStart ?? passage.body.length;
      const end = el.selectionEnd ?? passage.body.length;
      const before = passage.body.slice(0, start);
      const after = passage.body.slice(end);
      const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
      const suffix = after && !after.startsWith('\n') ? '\n\n' : '';
      const nextBody = `${before}${prefix}${token}${suffix}${after}`;
      onUpdatePassage(passage.id, { body: nextBody });
    } else {
      const nextBody = passage.body
        ? `${passage.body}\n\n${token}`
        : token;
      onUpdatePassage(passage.id, { body: nextBody });
    }
    setShowInlineImageDrawer(false);
  };

  const updateInlineImageToken = (
    rawToken: string,
    assetId: string,
    newCaption: string,
    size: InlineImageSize
  ) => {
    const clean = newCaption.replace(/[\[\]|]/g, '');
    const replacement = `[[img:${assetId}|${clean}|${size}]]`;
    onUpdatePassage(passage.id, {
      body: passage.body.replace(rawToken, replacement),
    });
  };

  const removeInlineImageToken = (rawToken: string) => {
    const nextBody = passage.body
      .replace(rawToken, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    onUpdatePassage(passage.id, { body: nextBody });
  };

  const wrapSelectionOrInsert = (beforeToken: string, afterToken = '', placeholder = '') => {
    const el = bodyTextareaRef.current;
    if (!el) {
      onUpdatePassage(passage.id, {
        body: `${passage.body}${beforeToken}${placeholder}${afterToken}`,
      });
      return;
    }
    const start = el.selectionStart ?? passage.body.length;
    const end = el.selectionEnd ?? passage.body.length;
    const selected = passage.body.slice(start, end) || placeholder;
    const nextBody =
      passage.body.slice(0, start) +
      beforeToken +
      selected +
      afterToken +
      passage.body.slice(end);
    onUpdatePassage(passage.id, { body: nextBody });
    window.requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + beforeToken.length;
      const cursorEnd = cursorStart + selected.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const makeDefaultEffect = (kind: EffectAction['kind'] = 'stat'): EffectAction => {
    const id = `ef_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (kind === 'item' && project.rpgConfig.items[0]) {
      return {
        id,
        kind: 'item',
        itemId: project.rpgConfig.items[0].id,
        operation: 'give',
        quantity: 1,
      };
    }
    if (kind === 'quest' && project.rpgConfig.quests[0]) {
      return {
        id,
        kind: 'quest',
        questId: project.rpgConfig.quests[0].id,
        status: 'active',
      };
    }
    if (kind === 'faction' && project.rpgConfig.factions[0]) {
      return {
        id,
        kind: 'faction',
        factionId: project.rpgConfig.factions[0].id,
        delta: 10,
      };
    }
    if (kind === 'flag') {
      return {
        id,
        kind: 'flag',
        flagId: (project.rpgConfig.flags || [])[0]?.id || '',
        value: true,
      };
    }
    const firstStat = project.rpgConfig.stats[0]?.id || 'hp';
    return { id, kind: 'stat', statId: firstStat, operation: 'add', value: -5 };
  };

  // One-click handlers
  const handleOneClickAddEffect = (kind: EffectAction['kind'] = 'stat') => {
    const nextEffect = makeDefaultEffect(kind);
    onUpdatePassage(passage.id, {
      entryEffects: [...passage.entryEffects, nextEffect],
    });
  };

  const handleOneClickToggleSkillCheck = () => {
    if (passage.skillCheck) {
      onUpdatePassage(passage.id, { skillCheck: undefined });
      return;
    }
    const defaultStat =
      project.rpgConfig.stats.find((s) => s.display === 'attribute')?.id ||
      project.rpgConfig.stats[0]?.id ||
      'perception';
    const fallbackTarget =
      allPassages.find((p) => p.id !== passage.id)?.id || passage.id;

    const newCheck: SkillCheckConfig = {
      id: `sc_${Date.now()}`,
      label: 'Skill Check',
      statId: defaultStat,
      dice: 'd20',
      difficulty: 12,
      successPassageId: fallbackTarget,
      failurePassageId: fallbackTarget,
      successEffects: [],
      failureEffects: [],
    };
    onUpdatePassage(passage.id, { skillCheck: newCheck });
  };

  const handleOneClickToggleCombat = () => {
    if (passage.combat) {
      onUpdatePassage(passage.id, { combat: undefined });
      return;
    }
    const hpStat =
      project.rpgConfig.stats.find((s) => s.id === 'hp' || s.display === 'bar')?.id ||
      project.rpgConfig.stats[0]?.id ||
      'hp';
    const atkStat =
      project.rpgConfig.stats.find((s) => s.id === 'strength' || s.display === 'attribute')?.id ||
      project.rpgConfig.stats[0]?.id ||
      'strength';
    const fallbackTarget =
      allPassages.find((p) => p.id !== passage.id)?.id || passage.id;
    const defaultPortrait =
      imageAssets.find((a) => a.id === 'img_warden')?.id || imageAssets[0]?.id;

    const newCombat: CombatConfig = {
      id: `cmb_${Date.now()}`,
      enemyName: 'Keep Sentinel',
      enemyPortraitId: defaultPortrait,
      enemyMaxHp: 20,
      enemyAttackMin: 3,
      enemyAttackMax: 6,
      enemyDefense: 1,
      playerHpStatId: hpStat,
      playerAttackStatId: atkStat,
      lootItemId: project.rpgConfig.items[0]?.id,
      victoryPassageId: fallbackTarget,
      defeatPassageId: fallbackTarget,
    };
    onUpdatePassage(passage.id, { combat: newCombat });
  };

  const handleOneClickAddChoice = () => {
    const fallbackTarget =
      allPassages.find((p) => p.id !== passage.id)?.id || passage.id;
    const newChoice: PassageChoice = {
      id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      label: 'Continue forward',
      targetPassageId: fallbackTarget,
      effects: [],
    };
    onUpdatePassage(passage.id, {
      choices: [...passage.choices, newChoice],
    });
  };

  const handleSyncInlineLinks = () => {
    if (inlineLinks.length === 0) return;
    const updatedChoices = [...passage.choices];
    for (const link of inlineLinks) {
      const alreadyExists = updatedChoices.some(
        (c) => c.label.toLowerCase() === link.label.toLowerCase()
      );
      if (alreadyExists) continue;

      const existingTarget = allPassages.find(
        (p) => p.title.trim().toLowerCase() === link.targetTitle.toLowerCase()
      );
      const targetId =
        existingTarget?.id || onCreateConnectedPassage(passage.id, link.targetTitle);

      updatedChoices.push({
        id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        label: link.label,
        targetPassageId: targetId,
        effects: [],
      });
    }
    onUpdatePassage(passage.id, { choices: updatedChoices });
  };

  const handleUploadImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const asset = await onUploadMediaAsset(file, 'image');
    if (asset) {
      onUpdatePassage(passage.id, { imageId: asset.id });
    }
    e.target.value = '';
  };

  const handleUploadInlineImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const asset = await onUploadMediaAsset(file, 'image');
    if (asset) {
      insertInlineImageAtCursor(asset);
    }
    e.target.value = '';
  };

  const handleUploadAudio = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const asset = await onUploadMediaAsset(file, 'audio', 'ambient');
    if (asset) {
      onUpdatePassage(passage.id, { ambientAudioId: asset.id });
    }
    e.target.value = '';
  };

  const updateChoice = (idx: number, patch: Partial<PassageChoice>) => {
    const next = passage.choices.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onUpdatePassage(passage.id, { choices: next });
  };

  const removeChoice = (idx: number) => {
    onUpdatePassage(passage.id, {
      choices: passage.choices.filter((_, i) => i !== idx),
    });
  };

  const moveChoice = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= passage.choices.length) return;
    const next = [...passage.choices];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    onUpdatePassage(passage.id, { choices: next });
  };

  const toggleChoiceCondition = (idx: number) => {
    const current = passage.choices[idx];
    if (current.condition) {
      updateChoice(idx, { condition: undefined });
      return;
    }
    const defaultCond: ConditionRule = project.rpgConfig.items[0]
      ? { kind: 'has_item', itemId: project.rpgConfig.items[0].id }
      : {
          kind: 'stat_gte',
          statId: project.rpgConfig.stats[0]?.id || 'hp',
          value: 5,
        };
    updateChoice(idx, { condition: defaultCond });
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed || passage.tags.includes(trimmed)) return;
    onUpdatePassage(passage.id, { tags: [...passage.tags, trimmed] });
    setTagInput('');
  };

  return (
    <aside className="w-[440px] shrink-0 border-l border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col h-full overflow-hidden">
      {/* Inspector Header */}
      <div className="p-4 border-b border-[var(--border-hairline)] space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            value={passage.title}
            onChange={(e) => onUpdatePassage(passage.id, { title: e.target.value })}
            aria-label={t.inspector.passageTitlePlaceholder}
            placeholder={t.inspector.passageTitlePlaceholder}
            className="flex-1 min-w-0 bg-transparent text-base font-semibold text-[var(--text-primary)] border-b border-transparent focus:border-[var(--accent-primary)] focus:outline-none py-0.5"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onSetStartPassage(passage.id)}
              disabled={isStart}
              title={isStart ? t.inspector.startNode : t.inspector.setStart}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                isStart
                  ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)]/50 text-[var(--accent-primary)]'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{isStart ? t.inspector.startNode : t.inspector.setStart}</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdatePassage(passage.id, { isEnding: !passage.isEnding })}
              title={t.inspector.markEnding}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                passage.isEnding
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>{t.inspector.endingNode}</span>
            </button>
            <button
              type="button"
              onClick={() => onPlayFromPassage(passage.id)}
              title={t.inspector.playFromHere}
              aria-label={t.inspector.playFromHere}
              className="p-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] border border-[var(--border-hairline)] text-[var(--accent-primary)] transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
            <button
              type="button"
              onClick={() => onDeletePassage(passage.id)}
              disabled={allPassages.length <= 1}
              title={t.inspector.deletePassage}
              className="p-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-red-500/20 border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-red-500 disabled:opacity-30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onCollapse}
              title={t.inspector.collapseInspector}
              aria-label={t.inspector.collapseInspector}
              className="p-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Node Color Tag Selector */}
        <div className="space-y-2 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] min-w-0">
              <span className="shrink-0">{t.inspector.nodeColor}</span>
              <span
                style={activeColorMeta.isCustom ? { color: activeColorMeta.hex } : undefined}
                className={`truncate ${activeColorMeta.textClass}`}
                title={`${activeColorMeta.isCustom ? activeColorMeta.label : t.nodeColors[activeColorMeta.id]?.label || activeColorMeta.label} · ${activeColorMeta.isCustom ? activeColorMeta.meaningHint : t.nodeColors[activeColorMeta.id]?.meaningHint || activeColorMeta.meaningHint}`}
              >
                {activeColorMeta.isCustom ? activeColorMeta.label : t.nodeColors[activeColorMeta.id]?.label || activeColorMeta.label} · {activeColorMeta.isCustom ? activeColorMeta.meaningHint : t.nodeColors[activeColorMeta.id]?.meaningHint || activeColorMeta.meaningHint}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {allColors.map((c) => {
                const selected = (passage.color || 'none') === c.id;
                const cLabel = c.isCustom ? c.label : t.nodeColors[c.id]?.label || c.label;
                const cHint = c.isCustom ? c.meaningHint : t.nodeColors[c.id]?.meaningHint || c.meaningHint;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onUpdatePassage(passage.id, { color: c.id })}
                    title={`${cLabel}: ${cHint}`}
                    aria-label={`${t.inspector.nodeColor}: ${cLabel}`}
                    style={c.isCustom ? { backgroundColor: c.hex } : undefined}
                    className={`w-4 h-4 rounded-full transition-transform ${c.swatchClass} ${
                      selected
                        ? 'ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-surface)] scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                );
              })}
              <button
                type="button"
                onClick={() => setShowCustomColorForm((v) => !v)}
                title={t.inspector.createCustomColor}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[10px] font-medium text-[var(--text-secondary)]"
              >
                <Plus className="w-3 h-3" />
                <span>{t.common.custom}</span>
              </button>
            </div>
          </div>

          {/* Custom Color Chips (Delete & Quick Select) */}
          {customColors.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {customColors.map((cc) => {
                const isSelected = passage.color === cc.id;
                return (
                  <div
                    key={cc.id}
                    className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md border text-[11px] ${
                      isSelected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onUpdatePassage(passage.id, { color: cc.id })}
                      title={cc.meaningHint}
                      className="inline-flex items-center gap-1.5"
                    >
                      <span
                        style={{ backgroundColor: cc.hex }}
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                      />
                      <span>{cc.label}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCustomColor(cc.id)}
                      title={`Delete custom color "${cc.label}"`}
                      aria-label={`Delete custom color ${cc.label}`}
                      className="p-0.5 rounded text-[var(--text-muted)] hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create New Custom Color Form */}
          {showCustomColorForm && (
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColorHex}
                  onChange={(e) => setCustomColorHex(e.target.value)}
                  aria-label={t.inspector.pickCustomColor}
                  className="w-8 h-7 rounded cursor-pointer bg-transparent border border-[var(--border-hairline)] p-0.5 shrink-0"
                />
                <input
                  type="text"
                  value={customColorLabel}
                  onChange={(e) => setCustomColorLabel(e.target.value)}
                  placeholder={t.inspector.customColorNamePlaceholder}
                  className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
                />
              </div>
              <input
                type="text"
                value={customColorMeaning}
                onChange={(e) => setCustomColorMeaning(e.target.value)}
                placeholder={t.inspector.customColorMeaningPlaceholder}
                className="w-full px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCustomColorForm(false)}
                  className="px-2.5 py-1 rounded bg-[var(--bg-elevated)] text-[11px] text-[var(--text-muted)]"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomColor}
                  disabled={!customColorLabel.trim()}
                  className="px-2.5 py-1 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-[var(--accent-contrast)] text-[11px] font-semibold"
                >
                  {t.inspector.saveColor}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* One-Click Add Strip */}
        <div>
          <div className="text-[11px] font-medium text-[var(--text-muted)] mb-1.5">
            {t.inspector.oneClickEnhancements}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!passage.imageId && imageAssets[0]) {
                  onUpdatePassage(passage.id, { imageId: imageAssets[0].id });
                }
                setShowImagePicker((v) => !v);
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                passage.imageId
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border-[var(--border-hairline)] text-[var(--text-primary)]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{passage.imageId ? t.inspector.coverArt : t.inspector.addCoverArt}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!passage.ambientAudioId && !passage.entrySfxId && ambientAssets[0]) {
                  onUpdatePassage(passage.id, { ambientAudioId: ambientAssets[0].id });
                }
                setShowAudioPicker((v) => !v);
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                passage.ambientAudioId || passage.entrySfxId
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border-[var(--border-hairline)] text-[var(--text-primary)]'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{passage.ambientAudioId || passage.entrySfxId ? t.inspector.sound : t.inspector.addSound}</span>
            </button>

            <button
              type="button"
              onClick={() => handleOneClickAddEffect('stat')}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.inspector.addEffect}</span>
            </button>

            <button
              type="button"
              onClick={handleOneClickToggleSkillCheck}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                passage.skillCheck
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border-[var(--border-hairline)] text-[var(--text-primary)]'
              }`}
            >
              <Dices className="w-3.5 h-3.5" />
              <span>{passage.skillCheck ? t.inspector.diceCheck : t.inspector.addDiceCheck}</span>
            </button>

            <button
              type="button"
              onClick={handleOneClickToggleCombat}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                passage.combat
                  ? 'bg-red-500/15 border-red-500/40 text-red-300'
                  : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border-[var(--border-hairline)] text-[var(--text-primary)]'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>{passage.combat ? t.inspector.combat : t.inspector.addCombat}</span>
            </button>

            <button
              type="button"
              onClick={handleOneClickAddChoice}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.inspector.addChoice}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Cover Scene Illustration */}
        {(showImagePicker || attachedImage) && (
          <section className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {t.inspector.topSceneBanner}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => imageUploadRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-primary)]"
                >
                  <Upload className="w-3 h-3" />
                  <span>{t.inspector.upload}</span>
                </button>
                <input
                  ref={imageUploadRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadImage}
                  className="hidden"
                />
                {passage.imageId && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdatePassage(passage.id, { imageId: undefined });
                      setShowImagePicker(false);
                    }}
                    className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-red-400"
                    title={t.inspector.removeCoverImage}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {attachedImage?.url && (
              <div className="relative h-28 rounded-md overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
                <img
                  src={attachedImage.url}
                  alt={attachedImage.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 px-2.5 py-1 bg-gradient-to-t from-black/80 to-transparent text-xs text-[var(--text-primary)] truncate">
                  {attachedImage.name}
                </div>
              </div>
            )}

            <select
              value={passage.imageId || ''}
              onChange={(e) =>
                onUpdatePassage(passage.id, { imageId: e.target.value || undefined })
              }
              className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="">{t.inspector.noneHeaderBanner}</option>
              {imageAssets.map((img) => (
                <option key={img.id} value={img.id}>
                  {img.name} ({img.source === 'upload' ? t.inspector.uploadedLabel : t.inspector.starterLabel})
                </option>
              ))}
            </select>
          </section>
        )}

        {/* Audio & SFX Picker */}
        {(showAudioPicker || passage.ambientAudioId || passage.entrySfxId) && (
          <section className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {t.inspector.soundscapeSfxTitle}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => audioUploadRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-primary)]"
                >
                  <Upload className="w-3 h-3" />
                  <span>{t.inspector.uploadAudio}</span>
                </button>
                <input
                  ref={audioUploadRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleUploadAudio}
                  className="hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-[11px] text-[var(--text-muted)]">
                    {t.inspector.ambientSoundscape}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePassage(passage.id, {
                        ambientLoop: !(passage.ambientLoop ?? true),
                      })
                    }
                    title={t.inspector.soundscapeLoopHint}
                    className={`px-2 py-0.5 rounded border text-[10px] font-medium transition-colors ${
                      (passage.ambientLoop ?? true)
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-muted)]'
                    }`}
                  >
                    {(passage.ambientLoop ?? true) ? t.inspector.loopOn : t.inspector.loopOff}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={passage.ambientAudioId || ''}
                    onChange={(e) =>
                      onUpdatePassage(passage.id, {
                        ambientAudioId: e.target.value || undefined,
                      })
                    }
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="">{t.inspector.silence}</option>
                    {ambientAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const asset = project.assets.find(
                        (a) => a.id === passage.ambientAudioId
                      );
                      if (synthEngine.getActiveAmbientId() === asset?.id) {
                        synthEngine.stopAmbient();
                      } else {
                        synthEngine.playAmbient(asset, passage.ambientLoop ?? true);
                      }
                    }}
                    disabled={!passage.ambientAudioId}
                    className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] disabled:opacity-40"
                  >
                    {t.common.test}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  {t.inspector.onEnterSfx}
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={passage.entrySfxId || ''}
                    onChange={(e) =>
                      onUpdatePassage(passage.id, {
                        entrySfxId: e.target.value || undefined,
                      })
                    }
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="">{t.common.none}</option>
                    {sfxAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const asset = project.assets.find((a) => a.id === passage.entrySfxId);
                      synthEngine.playSfx(asset);
                    }}
                    disabled={!passage.entrySfxId}
                    className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] disabled:opacity-40"
                  >
                    {t.common.test}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Narrative Prose + Blog-Style Inline Image Insertion */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <label htmlFor="passage-body" className="text-xs font-semibold text-[var(--text-secondary)] truncate">
                {t.inspector.storyTextTitle}
              </label>
              <span className="text-[11px] font-mono-tabular px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-muted)] shrink-0">
                {getPassageWordCount(passage)} {t.inspector.wordsLabel}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowInlineImageDrawer((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>{t.inspector.insertImageInText}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdatePassage(passage.id, {
                    body: `${passage.body}${passage.body ? '\n\n' : ''}[[Follow the passage->New Room]]`,
                  })
                }
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 whitespace-nowrap"
              >
                <Link2 className="w-3 h-3" />
                <span>{t.inspector.insertLink}</span>
              </button>
            </div>
          </div>

          {/* Inline Image Picker Drawer */}
          {showInlineImageDrawer && (
            <div className="rounded-lg border border-sky-500/40 bg-[var(--bg-canvas)] p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-sky-300">
                  {t.inspector.pickOrUploadInline}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => inlineUploadRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-500 hover:bg-sky-400 text-[#0B0E14] text-[11px] font-semibold"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{t.inspector.uploadAndInsert}</span>
                  </button>
                  <input
                    ref={inlineUploadRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadInlineImage}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInlineImageDrawer(false)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                {imageAssets.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => insertInlineImageAtCursor(img)}
                    title={`Insert "${img.name}" into story text`}
                    className="group relative aspect-square rounded-md overflow-hidden border border-[var(--border-hairline)] hover:border-amber-400 bg-[var(--bg-surface)]"
                  >
                    {img.url && (
                      <img
                        src={img.url}
                        alt={img.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 px-1 py-0.5 bg-black/75 text-[10px] text-[var(--text-primary)] truncate">
                      {img.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rich Text & Variable Formatting Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] px-2 py-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => wrapSelectionOrInsert('**', '**', 'bold text')}
                title={t.inspector.formatBold}
                aria-label={t.inspector.formatBold}
                className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapSelectionOrInsert('*', '*', 'italic text')}
                title={t.inspector.formatItalic}
                aria-label={t.inspector.formatItalic}
                className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapSelectionOrInsert('\n> ', '', 'Quoted line...')}
                title={t.inspector.formatQuote}
                aria-label={t.inspector.formatQuote}
                className="p-1.5 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapSelectionOrInsert('\n---\n', '', '')}
                title="---"
                className="px-1.5 py-0.5 rounded hover:bg-[var(--bg-elevated)] text-[11px] font-mono-tabular text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ---
              </button>
            </div>

            <select
              value=""
              aria-label={t.inspector.insertVariable}
              onChange={(e) => {
                if (!e.target.value) return;
                wrapSelectionOrInsert(e.target.value, '', '');
              }}
              className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)] max-w-[170px]"
            >
              <option value="">+ {t.inspector.insertVariable}</option>
              <option value="{{title}}">{'{{title}}'}</option>
              <option value="{{author}}">{'{{author}}'}</option>
              {project.rpgConfig.stats.map((s) => (
                <option key={`vs_${s.id}`} value={`{{stat:${s.name}}}`}>
                  {`{{stat:${s.name}}}`}
                </option>
              ))}
              {project.rpgConfig.items.map((it) => (
                <option key={`vi_${it.id}`} value={`{{item:${it.name}}}`}>
                  {`{{item:${it.name}}}`}
                </option>
              ))}
              {(project.rpgConfig.flags || []).map((fl) => (
                <option
                  key={`vf_${fl.id}`}
                  value={`{{if flag:${fl.name}}}...{{/if}}`}
                >
                  {`{{if flag:${fl.name}}}`}
                </option>
              ))}
            </select>
          </div>

          <textarea
            ref={bodyTextareaRef}
            id="passage-body"
            rows={7}
            value={passage.body}
            onChange={(e) => onUpdatePassage(passage.id, { body: e.target.value })}
            placeholder={t.inspector.bodyPlaceholder}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-sm text-[var(--text-primary)] leading-relaxed focus:outline-none focus:border-[var(--accent-primary)] resize-y"
          />

          {/* Visual manager for inline blog images embedded in the text */}
          {inlineImageBlocks.length > 0 && (
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--text-muted)]">
                <span>{t.inspector.inlineImagesInStory} ({inlineImageBlocks.length})</span>
                <span>{t.inspector.centeredAspectHint}</span>
              </div>
              {inlineImageBlocks.map((block, i) => {
                const asset = project.assets.find((a) => a.id === block.assetId);
                return (
                  <div
                    key={`${block.assetId}-${i}`}
                    className="space-y-1.5 pb-2 border-b border-[var(--border-hairline)]/60 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2.5 text-xs">
                      <div className="w-10 h-10 rounded overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)] shrink-0 flex items-center justify-center">
                        {asset?.url ? (
                          <img
                            src={asset.url}
                            alt={asset.name}
                            referrerPolicy="no-referrer"
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        value={block.caption}
                        onChange={(e) =>
                          updateInlineImageToken(
                            block.rawToken,
                            block.assetId,
                            e.target.value,
                            block.size
                          )
                        }
                        placeholder={t.inspector.optionalCaption}
                        className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => removeInlineImageToken(block.rawToken)}
                        title={t.inspector.removeInlineImage}
                        className="p-1 text-[var(--text-muted)] hover:text-red-400 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-12">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {t.inspector.proportionalWidth}
                      </span>
                      <div className="flex items-center gap-1">
                        {([75, 50, 25] as InlineImageSize[]).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() =>
                              updateInlineImageToken(
                                block.rawToken,
                                block.assetId,
                                block.caption,
                                sz
                              )
                            }
                            className={`px-2 py-0.5 rounded border text-[11px] font-mono-tabular transition-colors ${
                              block.size === sz
                                ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                                : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                            }`}
                          >
                            {sz}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {inlineLinks.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-hairline)]">
              <span className="text-[11px] text-[var(--text-secondary)]">
                {t.inspector.detectedInlineLinks}: {inlineLinks.length}
              </span>
              <button
                type="button"
                onClick={handleSyncInlineLinks}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300"
              >
                {t.inspector.convertToChoices}
              </button>
            </div>
          )}
        </section>

        {/* Entry Effects */}
        {passage.entryEffects.length > 0 && (
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {t.inspector.onEnterEffectsTitle}
              </span>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleOneClickAddEffect('stat')}
                  className="text-amber-400 hover:text-amber-300"
                >
                  + {t.inspector.effectStat}
                </button>
                <button
                  type="button"
                  onClick={() => handleOneClickAddEffect('item')}
                  className="text-amber-400 hover:text-amber-300"
                >
                  + {t.inspector.effectItem}
                </button>
                <button
                  type="button"
                  onClick={() => handleOneClickAddEffect('quest')}
                  className="text-amber-400 hover:text-amber-300"
                >
                  + {t.inspector.effectQuest}
                </button>
                <button
                  type="button"
                  onClick={() => handleOneClickAddEffect('faction')}
                  className="text-amber-400 hover:text-amber-300"
                >
                  + {t.inspector.effectFaction}
                </button>
                <button
                  type="button"
                  onClick={() => handleOneClickAddEffect('flag')}
                  className="text-violet-400 hover:text-violet-300"
                >
                  {t.inspector.addFlag}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {passage.entryEffects.map((ef, idx) => (
                <div
                  key={ef.id}
                  className="p-2.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex items-center gap-2 text-xs"
                >
                  <select
                    value={ef.kind}
                    onChange={(e) => {
                      const nextKind = e.target.value as EffectAction['kind'];
                      const next = [...passage.entryEffects];
                      next[idx] = { ...makeDefaultEffect(nextKind), id: ef.id };
                      onUpdatePassage(passage.id, { entryEffects: next });
                    }}
                    className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  >
                    <option value="stat">{t.inspector.effectStat}</option>
                    <option value="item">{t.inspector.effectItem}</option>
                    <option value="quest">{t.inspector.effectQuest}</option>
                    <option value="faction">{t.inspector.effectFaction}</option>
                    <option value="flag">{t.inspector.effectFlag}</option>
                  </select>

                  {ef.kind === 'stat' && (
                    <>
                      <select
                        value={ef.statId}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = { ...ef, statId: e.target.value };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        {project.rpgConfig.stats.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={ef.operation}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = { ...ef, operation: e.target.value as 'add' | 'set' };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="px-1.5 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        <option value="add">+/-</option>
                        <option value="set">{t.inspector.opSet}</option>
                      </select>
                      <input
                        type="number"
                        value={ef.value}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = { ...ef, value: Number(e.target.value) || 0 };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="w-16 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                      />
                    </>
                  )}

                  {ef.kind === 'item' && (
                    <>
                      <select
                        value={ef.operation}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = { ...ef, operation: e.target.value as 'give' | 'take' };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="px-1.5 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        <option value="give">{t.inspector.opGive}</option>
                        <option value="take">{t.inspector.opTake}</option>
                      </select>
                      <select
                        value={ef.itemId}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = { ...ef, itemId: e.target.value };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        {project.rpgConfig.items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={ef.quantity}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = {
                            ...ef,
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="w-12 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                      />
                    </>
                  )}

                  {ef.kind === 'quest' && (
                    <>
                      <select
                        value={ef.questId}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = { ...ef, questId: e.target.value };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        {project.rpgConfig.quests.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.title}
                          </option>
                        ))}
                      </select>
                      <select
                        value={ef.status}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = { ...ef, status: e.target.value as QuestStatus };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        <option value="active">{t.inspector.statusActive}</option>
                        <option value="completed">{t.inspector.statusCompleted}</option>
                        <option value="failed">{t.inspector.statusFailed}</option>
                      </select>
                    </>
                  )}

                  {ef.kind === 'faction' && (
                    <>
                      <select
                        value={ef.factionId}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = { ...ef, factionId: e.target.value };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        {project.rpgConfig.factions.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={ef.delta}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = { ...ef, delta: Number(e.target.value) || 0 };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="w-16 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                      />
                    </>
                  )}

                  {ef.kind === 'flag' && (
                    <>
                      <select
                        value={ef.flagId}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = { ...ef, flagId: e.target.value };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        {(project.rpgConfig.flags || []).map((fl) => (
                          <option key={fl.id} value={fl.id}>
                            {fl.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={ef.value ? 'true' : 'false'}
                        onChange={(e) => {
                          const next = [...passage.entryEffects];
                          next[idx] = { ...ef, value: e.target.value === 'true' };
                          onUpdatePassage(passage.id, { entryEffects: next });
                        }}
                        className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        <option value="true">{t.runtime.trueLabel}</option>
                        <option value="false">{t.runtime.falseLabel}</option>
                      </select>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePassage(passage.id, {
                        entryEffects: passage.entryEffects.filter((_, i) => i !== idx),
                      })
                    }
                    className="p-1 text-[var(--text-muted)] hover:text-red-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Dice Skill Check Block */}
        {passage.skillCheck && (
          <section className="rounded-lg border border-sky-500/35 bg-[var(--bg-canvas)] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                <Dices className="w-4 h-4" />
                <span>{t.inspector.diceSkillCheckTitle}</span>
              </div>
              <button
                type="button"
                onClick={handleOneClickToggleSkillCheck}
                className="text-xs text-[var(--text-muted)] hover:text-red-400"
              >
                {t.inspector.remove}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">{t.inspector.checkPrompt}</label>
                <input
                  type="text"
                  value={passage.skillCheck.label}
                  onChange={(e) =>
                    onUpdatePassage(passage.id, {
                      skillCheck: { ...passage.skillCheck!, label: e.target.value },
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">{t.inspector.statModifier}</label>
                <select
                  value={passage.skillCheck.statId}
                  onChange={(e) =>
                    onUpdatePassage(passage.id, {
                      skillCheck: { ...passage.skillCheck!, statId: e.target.value },
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  {project.rpgConfig.stats.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">{t.inspector.dice}</label>
                  <select
                    value={passage.skillCheck.dice}
                    onChange={(e) =>
                      onUpdatePassage(passage.id, {
                        skillCheck: {
                          ...passage.skillCheck!,
                          dice: e.target.value as SkillCheckConfig['dice'],
                        },
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  >
                    <option value="d20">d20</option>
                    <option value="2d6">2d6</option>
                    <option value="d100">d100</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">{t.inspector.targetDc}</label>
                  <input
                    type="number"
                    value={passage.skillCheck.difficulty}
                    onChange={(e) =>
                      onUpdatePassage(passage.id, {
                        skillCheck: {
                          ...passage.skillCheck!,
                          difficulty: Number(e.target.value) || 10,
                        },
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-emerald-400 mb-1">{t.inspector.onSuccess}</label>
                <select
                  value={passage.skillCheck.successPassageId}
                  onChange={(e) =>
                    onUpdatePassage(passage.id, {
                      skillCheck: { ...passage.skillCheck!, successPassageId: e.target.value },
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  {allPassages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-red-400 mb-1">{t.inspector.onFailure}</label>
                <select
                  value={passage.skillCheck.failurePassageId}
                  onChange={(e) =>
                    onUpdatePassage(passage.id, {
                      skillCheck: { ...passage.skillCheck!, failurePassageId: e.target.value },
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  {allPassages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Turn-Based Combat Encounter Block */}
        {passage.combat && (
          <section className="rounded-lg border border-red-500/35 bg-[var(--bg-canvas)] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-300">
                <Swords className="w-4 h-4" />
                <span>{t.inspector.combatEncounterTitle}</span>
              </div>
              <button
                type="button"
                onClick={handleOneClickToggleCombat}
                className="text-xs text-[var(--text-muted)] hover:text-red-400"
              >
                {t.inspector.remove}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">{t.inspector.enemyName}</label>
                <input
                  type="text"
                  value={passage.combat.enemyName}
                  onChange={(e) =>
                    onUpdatePassage(passage.id, {
                      combat: { ...passage.combat!, enemyName: e.target.value },
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">{t.inspector.portrait}</label>
                <select
                  value={passage.combat.enemyPortraitId || ''}
                  onChange={(e) =>
                    onUpdatePassage(passage.id, {
                      combat: {
                        ...passage.combat!,
                        enemyPortraitId: e.target.value || undefined,
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  <option value="">{t.common.none}</option>
                  {imageAssets.map((img) => (
                    <option key={img.id} value={img.id}>
                      {img.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">{t.inspector.enemyHp}</label>
                <input
                  type="number"
                  min={1}
                  value={passage.combat.enemyMaxHp}
                  onChange={(e) =>
                    onUpdatePassage(passage.id, {
                      combat: {
                        ...passage.combat!,
                        enemyMaxHp: Math.max(1, Number(e.target.value) || 10),
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">{t.inspector.atkMin}</label>
                  <input
                    type="number"
                    min={1}
                    value={passage.combat.enemyAttackMin}
                    onChange={(e) =>
                      onUpdatePassage(passage.id, {
                        combat: {
                          ...passage.combat!,
                          enemyAttackMin: Math.max(0, Number(e.target.value) || 1),
                        },
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">{t.inspector.atkMax}</label>
                  <input
                    type="number"
                    min={1}
                    value={passage.combat.enemyAttackMax}
                    onChange={(e) =>
                      onUpdatePassage(passage.id, {
                        combat: {
                          ...passage.combat!,
                          enemyAttackMax: Math.max(1, Number(e.target.value) || 4),
                        },
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">{t.inspector.enemyDefense}</label>
                <input
                  type="number"
                  min={0}
                  value={passage.combat.enemyDefense}
                  onChange={(e) =>
                    onUpdatePassage(passage.id, {
                      combat: {
                        ...passage.combat!,
                        enemyDefense: Math.max(0, Number(e.target.value) || 0),
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">{t.inspector.victoryLootItem}</label>
                <select
                  value={passage.combat.lootItemId || ''}
                  onChange={(e) =>
                    onUpdatePassage(passage.id, {
                      combat: { ...passage.combat!, lootItemId: e.target.value || undefined },
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  <option value="">{t.inspector.noLoot}</option>
                  {project.rpgConfig.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-emerald-400 mb-1">{t.inspector.victoryLabel}</label>
                <select
                  value={passage.combat.victoryPassageId}
                  onChange={(e) =>
                    onUpdatePassage(passage.id, {
                      combat: { ...passage.combat!, victoryPassageId: e.target.value },
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  {allPassages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-red-400 mb-1">{t.inspector.defeatLabel}</label>
                <select
                  value={passage.combat.defeatPassageId}
                  onChange={(e) =>
                    onUpdatePassage(passage.id, {
                      combat: { ...passage.combat!, defeatPassageId: e.target.value },
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  {allPassages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Branching Choices */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {t.inspector.choicesTitle} ({passage.choices.length})
            </span>
            <button
              type="button"
              onClick={handleOneClickAddChoice}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.inspector.addChoiceBtn}</span>
            </button>
          </div>

          {passage.choices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-hairline)] p-4 text-center text-xs text-[var(--text-muted)]">
              {t.inspector.noChoicesYet}
            </div>
          ) : (
            <div className="space-y-2.5">
              {passage.choices.map((choice, idx) => (
                <div
                  key={choice.id}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 space-y-2"
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={choice.label}
                      onChange={(e) => updateChoice(idx, { label: e.target.value })}
                      placeholder={t.inspector.choiceButtonPlaceholder}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => moveChoice(idx, -1)}
                      disabled={idx === 0}
                      title={t.inspector.moveUp}
                      aria-label={t.inspector.moveUp}
                      className="p-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveChoice(idx, 1)}
                      disabled={idx === passage.choices.length - 1}
                      title={t.inspector.moveDown}
                      aria-label={t.inspector.moveDown}
                      className="p-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleChoiceCondition(idx)}
                      title={t.inspector.toggleRequirement}
                      className={`p-1.5 rounded border transition-colors ${
                        choice.condition
                          ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                          : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeChoice(idx)}
                      title={t.common.delete}
                      className="p-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--text-muted)] shrink-0">{t.inspector.targetLabel}</span>
                    <select
                      value={choice.targetPassageId}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          const newId = onCreateConnectedPassage(
                            passage.id,
                            choice.label || t.sidebar.untitledPassage
                          );
                          updateChoice(idx, { targetPassageId: newId });
                        } else {
                          updateChoice(idx, { targetPassageId: e.target.value });
                        }
                      }}
                      className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                    >
                      {allPassages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                      <option value="__NEW__">{t.inspector.createConnectedPassage}</option>
                    </select>
                  </div>

                  {/* Choice Condition Editor */}
                  {choice.condition && (
                    <div className="pt-2 border-t border-[var(--border-hairline)]/70 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={choice.condition.kind}
                          onChange={(e) => {
                            const k = e.target.value as ConditionRule['kind'];
                            if (k === 'has_item') {
                              updateChoice(idx, {
                                condition: {
                                  kind: 'has_item',
                                  itemId: project.rpgConfig.items[0]?.id || '',
                                },
                              });
                            } else if (k === 'stat_gte') {
                              updateChoice(idx, {
                                condition: {
                                  kind: 'stat_gte',
                                  statId: project.rpgConfig.stats[0]?.id || 'hp',
                                  value: 5,
                                },
                              });
                            } else if (k === 'quest_status') {
                              updateChoice(idx, {
                                condition: {
                                  kind: 'quest_status',
                                  questId: project.rpgConfig.quests[0]?.id || '',
                                  status: 'active',
                                },
                              });
                            } else if (k === 'flag_is') {
                              updateChoice(idx, {
                                condition: {
                                  kind: 'flag_is',
                                  flagId: (project.rpgConfig.flags || [])[0]?.id || '',
                                  value: true,
                                },
                              });
                            } else if (k === 'visited_passage') {
                              updateChoice(idx, {
                                condition: {
                                  kind: 'visited_passage',
                                  passageId: allPassages[0]?.id || passage.id,
                                  visited: true,
                                },
                              });
                            } else {
                              updateChoice(idx, {
                                condition: {
                                  kind: 'faction_gte',
                                  factionId: project.rpgConfig.factions[0]?.id || '',
                                  value: 10,
                                },
                              });
                            }
                          }}
                          className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-sky-300"
                        >
                          <option value="has_item">{t.inspector.condHasItem}</option>
                          <option value="stat_gte">{t.inspector.condStatGte}</option>
                          <option value="quest_status">{t.inspector.condQuestStatus}</option>
                          <option value="faction_gte">{t.inspector.condFactionGte}</option>
                          <option value="flag_is">{t.inspector.condFlagIs}</option>
                          <option value="visited_passage">{t.inspector.condVisited}</option>
                        </select>

                        {choice.condition.kind === 'has_item' && (
                          <select
                            value={choice.condition.itemId}
                            onChange={(e) =>
                              updateChoice(idx, {
                                condition: { kind: 'has_item', itemId: e.target.value },
                              })
                            }
                            className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                          >
                            {project.rpgConfig.items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name}
                              </option>
                            ))}
                          </select>
                        )}

                        {choice.condition.kind === 'stat_gte' && (
                          <>
                            <select
                              value={choice.condition.statId}
                              onChange={(e) =>
                                updateChoice(idx, {
                                  condition: {
                                    kind: 'stat_gte',
                                    statId: e.target.value,
                                    value:
                                      choice.condition?.kind === 'stat_gte'
                                        ? choice.condition.value
                                        : 5,
                                  },
                                })
                              }
                              className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              {project.rpgConfig.stats.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={choice.condition.value}
                              onChange={(e) =>
                                updateChoice(idx, {
                                  condition: {
                                    kind: 'stat_gte',
                                    statId:
                                      choice.condition?.kind === 'stat_gte'
                                        ? choice.condition.statId
                                        : 'hp',
                                    value: Number(e.target.value) || 0,
                                  },
                                })
                              }
                              className="w-16 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                            />
                          </>
                        )}

                        {choice.condition.kind === 'quest_status' && (
                          <>
                            <select
                              value={choice.condition.questId}
                              onChange={(e) =>
                                updateChoice(idx, {
                                  condition: {
                                    kind: 'quest_status',
                                    questId: e.target.value,
                                    status:
                                      choice.condition?.kind === 'quest_status'
                                        ? choice.condition.status
                                        : 'active',
                                  },
                                })
                              }
                              className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              {project.rpgConfig.quests.map((q) => (
                                <option key={q.id} value={q.id}>
                                  {q.title}
                                </option>
                              ))}
                            </select>
                            <select
                              value={choice.condition.status}
                              onChange={(e) =>
                                updateChoice(idx, {
                                  condition: {
                                    kind: 'quest_status',
                                    questId:
                                      choice.condition?.kind === 'quest_status'
                                        ? choice.condition.questId
                                        : '',
                                    status: e.target.value as QuestStatus,
                                  },
                                })
                              }
                              className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              <option value="active">{t.inspector.statusActive}</option>
                              <option value="completed">{t.inspector.statusCompleted}</option>
                              <option value="failed">{t.inspector.statusFailed}</option>
                            </select>
                          </>
                        )}

                        {choice.condition.kind === 'faction_gte' && (
                          <>
                            <select
                              value={choice.condition.factionId}
                              onChange={(e) =>
                                updateChoice(idx, {
                                  condition: {
                                    kind: 'faction_gte',
                                    factionId: e.target.value,
                                    value:
                                      choice.condition?.kind === 'faction_gte'
                                        ? choice.condition.value
                                        : 10,
                                  },
                                })
                              }
                              className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              {project.rpgConfig.factions.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={choice.condition.value}
                              onChange={(e) =>
                                updateChoice(idx, {
                                  condition: {
                                    kind: 'faction_gte',
                                    factionId:
                                      choice.condition?.kind === 'faction_gte'
                                        ? choice.condition.factionId
                                        : '',
                                    value: Number(e.target.value) || 0,
                                  },
                                })
                              }
                              className="w-16 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                            />
                          </>
                        )}

                        {choice.condition.kind === 'flag_is' && (
                          <>
                            <select
                              value={choice.condition.flagId}
                              onChange={(e) =>
                                updateChoice(idx, {
                                  condition: {
                                    kind: 'flag_is',
                                    flagId: e.target.value,
                                    value:
                                      choice.condition?.kind === 'flag_is'
                                        ? choice.condition.value
                                        : true,
                                  },
                                })
                              }
                              className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              {(project.rpgConfig.flags || []).map((fl) => (
                                <option key={fl.id} value={fl.id}>
                                  {fl.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={choice.condition.value ? 'true' : 'false'}
                              onChange={(e) =>
                                updateChoice(idx, {
                                  condition: {
                                    kind: 'flag_is',
                                    flagId:
                                      choice.condition?.kind === 'flag_is'
                                        ? choice.condition.flagId
                                        : '',
                                    value: e.target.value === 'true',
                                  },
                                })
                              }
                              className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              <option value="true">{t.runtime.trueLabel}</option>
                              <option value="false">{t.runtime.falseLabel}</option>
                            </select>
                          </>
                        )}

                        {choice.condition.kind === 'visited_passage' && (
                          <>
                            <select
                              value={choice.condition.passageId}
                              onChange={(e) =>
                                updateChoice(idx, {
                                  condition: {
                                    kind: 'visited_passage',
                                    passageId: e.target.value,
                                    visited:
                                      choice.condition?.kind === 'visited_passage'
                                        ? choice.condition.visited
                                        : true,
                                  },
                                })
                              }
                              className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              {allPassages.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.title}
                                </option>
                              ))}
                            </select>
                            <select
                              value={choice.condition.visited ? 'true' : 'false'}
                              onChange={(e) =>
                                updateChoice(idx, {
                                  condition: {
                                    kind: 'visited_passage',
                                    passageId:
                                      choice.condition?.kind === 'visited_passage'
                                        ? choice.condition.passageId
                                        : passage.id,
                                    visited: e.target.value === 'true',
                                  },
                                })
                              }
                              className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              <option value="true">{t.inspector.visitedYes}</option>
                              <option value="false">{t.inspector.visitedNo}</option>
                            </select>
                          </>
                        )}
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            updateChoice(idx, { hideWhenLocked: !choice.hideWhenLocked })
                          }
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium transition-colors ${
                            choice.hideWhenLocked
                              ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                              : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <EyeOff className="w-3 h-3" />
                          <span>{t.inspector.hideIfLocked}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Choice-Level Effects Editor */}
                  <div className="pt-2 border-t border-[var(--border-hairline)]/60 space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {t.inspector.choiceEffectsLabel} ({(choice.effects || []).length})
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateChoice(idx, {
                              effects: [...(choice.effects || []), makeDefaultEffect('stat')],
                            })
                          }
                          className="text-[11px] font-medium text-amber-400 hover:text-amber-300"
                        >
                          {t.inspector.presetAdjustStat}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateChoice(idx, {
                              effects: [...(choice.effects || []), makeDefaultEffect('item')],
                            })
                          }
                          className="text-[11px] font-medium text-amber-400 hover:text-amber-300"
                        >
                          {t.inspector.presetGiveItem}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateChoice(idx, {
                              effects: [...(choice.effects || []), makeDefaultEffect('flag')],
                            })
                          }
                          className="text-[11px] font-medium text-violet-400 hover:text-violet-300"
                        >
                          {t.inspector.presetSetFlag}
                        </button>
                      </div>
                    </div>

                    {(choice.effects || []).map((cef, cefIdx) => (
                      <div
                        key={cef.id}
                        className="flex items-center gap-1.5 bg-[var(--bg-surface)]/80 border border-[var(--border-hairline)] rounded px-2 py-1.5"
                      >
                        <select
                          value={cef.kind}
                          onChange={(e) => {
                            const nextKind = e.target.value as EffectAction['kind'];
                            const nextEffects = [...(choice.effects || [])];
                            nextEffects[cefIdx] = {
                              ...makeDefaultEffect(nextKind),
                              id: cef.id,
                            };
                            updateChoice(idx, { effects: nextEffects });
                          }}
                          className="px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                        >
                          <option value="stat">{t.inspector.effectStat}</option>
                          <option value="item">{t.inspector.effectItem}</option>
                          <option value="quest">{t.inspector.effectQuest}</option>
                          <option value="faction">{t.inspector.effectFaction}</option>
                          <option value="flag">{t.inspector.effectFlag}</option>
                        </select>

                        {cef.kind === 'stat' && (
                          <>
                            <select
                              value={cef.statId}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = { ...cef, statId: e.target.value };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              {project.rpgConfig.stats.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={cef.operation}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = {
                                  ...cef,
                                  operation: e.target.value as 'add' | 'set',
                                };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="px-1 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              <option value="add">+/-</option>
                              <option value="set">{t.inspector.opSet}</option>
                            </select>
                            <input
                              type="number"
                              value={cef.value}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = {
                                  ...cef,
                                  value: Number(e.target.value) || 0,
                                };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="w-12 px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                            />
                          </>
                        )}

                        {cef.kind === 'item' && (
                          <>
                            <select
                              value={cef.operation}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = {
                                  ...cef,
                                  operation: e.target.value as 'give' | 'take',
                                };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="px-1 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              <option value="give">{t.inspector.opGive}</option>
                              <option value="take">{t.inspector.opTake}</option>
                            </select>
                            <select
                              value={cef.itemId}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = { ...cef, itemId: e.target.value };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              {project.rpgConfig.items.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={cef.quantity}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = {
                                  ...cef,
                                  quantity: Math.max(1, Number(e.target.value) || 1),
                                };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="w-10 px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                            />
                          </>
                        )}

                        {cef.kind === 'quest' && (
                          <>
                            <select
                              value={cef.questId}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = { ...cef, questId: e.target.value };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              {project.rpgConfig.quests.map((q) => (
                                <option key={q.id} value={q.id}>
                                  {q.title}
                                </option>
                              ))}
                            </select>
                            <select
                              value={cef.status}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = {
                                  ...cef,
                                  status: e.target.value as QuestStatus,
                                };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              <option value="active">{t.inspector.statusActive}</option>
                              <option value="completed">{t.inspector.statusCompleted}</option>
                              <option value="failed">{t.inspector.statusFailed}</option>
                            </select>
                          </>
                        )}

                        {cef.kind === 'faction' && (
                          <>
                            <select
                              value={cef.factionId}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = { ...cef, factionId: e.target.value };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              {project.rpgConfig.factions.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={cef.delta}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = {
                                  ...cef,
                                  delta: Number(e.target.value) || 0,
                                };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="w-12 px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                            />
                          </>
                        )}

                        {cef.kind === 'flag' && (
                          <>
                            <select
                              value={cef.flagId}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = { ...cef, flagId: e.target.value };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              {(project.rpgConfig.flags || []).map((fl) => (
                                <option key={fl.id} value={fl.id}>
                                  {fl.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={cef.value ? 'true' : 'false'}
                              onChange={(e) => {
                                const nextEffects = [...(choice.effects || [])];
                                nextEffects[cefIdx] = {
                                  ...cef,
                                  value: e.target.value === 'true',
                                };
                                updateChoice(idx, { effects: nextEffects });
                              }}
                              className="px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                            >
                              <option value="true">{t.runtime.trueLabel}</option>
                              <option value="false">{t.runtime.falseLabel}</option>
                            </select>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            updateChoice(idx, {
                              effects: (choice.effects || []).filter((_, i) => i !== cefIdx),
                            })
                          }
                          className="p-0.5 text-[var(--text-muted)] hover:text-red-400 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tags */}
        <section className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
          <label className="block text-xs font-semibold text-[var(--text-secondary)]">{t.inspector.tagsTitle}</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder={t.inspector.addTagPlaceholder}
              className="flex-1 px-2.5 py-1.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-3 py-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)]"
            >
              {t.common.add}
            </button>
          </div>
          {passage.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
              {passage.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    onUpdatePassage(passage.id, {
                      tags: passage.tags.filter((x) => x !== tag),
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-elevated)] hover:text-red-300 border border-[var(--border-hairline)]"
                >
                  <span>{tag}</span>
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
