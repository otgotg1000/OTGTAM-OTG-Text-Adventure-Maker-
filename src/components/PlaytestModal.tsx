import {
  Dices,
  FolderOpen,
  Image as ImageIcon,
  Lock,
  Package,
  RotateCcw,
  Save,
  ScrollText,
  Shield,
  Swords,
  Undo2,
  UserCheck,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react';
import { ChangeEvent, Fragment, ReactNode, useEffect, useRef, useState } from 'react';
import { synthEngine } from '../audio/synthEngine';
import { getGenreDefinition } from '../data/genreTemplates';
import { useI18n } from '../i18n/LanguageContext';
import { getTranslations } from '../i18n/translations';
import {
  getAllStoryThemes,
  getStoryFontOption,
  getStoryFontSizeOption,
  getStudioThemeOption,
  getThemeCssVars,
  READER_DARK_TOKENS,
  READER_LIGHT_TOKENS,
  STORY_FONTS,
  STORY_FONT_SIZES,
  STORY_LAYOUTS,
} from '../data/themes';
import {
  applyEffects,
  createInitialSession,
  createSaveGamePayload,
  enterPassage,
  evaluateCondition,
  executeSkillCheck,
  formatConditionLabel,
  getEquipmentAttackBonus,
  parseBodyBlocks,
  parseSaveGamePayload,
  performCombatAction,
  undoLastChoice,
} from '../engine/rpgEngine';
import {
  interpolateStoryText,
  parseInlineFormatting,
  parseRichLines,
} from '../engine/richText';
import {
  CustomStoryTheme,
  PassageChoice,
  PlaySession,
  StoryFontId,
  StoryFontSizeId,
  StoryLayoutId,
  StoryProject,
  StudioThemeId,
} from '../types/story';

interface PlaytestModalProps {
  project: StoryProject;
  storyTheme: StudioThemeId;
  storyLayout: StoryLayoutId;
  storyFont: StoryFontId;
  storyFontSize: StoryFontSizeId;
  customThemes: CustomStoryTheme[];
  startPassageId?: string;
  onUpdateStoryInterface?: (patch: {
    storyLayout?: StoryLayoutId;
    storyTheme?: StudioThemeId;
    customStoryTheme?: CustomStoryTheme;
    storyFont?: StoryFontId;
    storyFontSize?: StoryFontSizeId;
  }) => void;
  onClose: () => void;
}

export function PlaytestModal({
  project,
  storyTheme,
  storyLayout,
  storyFont,
  storyFontSize,
  customThemes,
  startPassageId,
  onUpdateStoryInterface,
  onClose,
}: PlaytestModalProps) {
  const { t } = useI18n();
  const readerT = project.meta.storyLanguage
    ? getTranslations(project.meta.storyLanguage)
    : t;
  const [session, setSession] = useState<PlaySession>(() =>
    createInitialSession(project, startPassageId, readerT.runtime)
  );
  const [muted, setMuted] = useState(() => synthEngine.isMuted());
  const [volume, setVolume] = useState(() => synthEngine.getVolume());
  const [showHudDrawer, setShowHudDrawer] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);
  const [readerMode, setReaderMode] = useState<'default' | 'light' | 'dark'>('default');
  const [imgError, setImgError] = useState<Record<string, boolean>>({});
  const [playerBanner, setPlayerBanner] = useState<string | null>(null);
  const skipEntrySfxRef = useRef(false);
  const loadInputRef = useRef<HTMLInputElement>(null);

  const currentPassage = project.passages[session.currentPassageId];
  const genreDef = getGenreDefinition(project.meta.genre);
  const localizedGenreName = readerT.genres[project.meta.genre]?.name ?? genreDef.name;

  const allThemes = getAllStoryThemes(customThemes, project.meta.customStoryTheme);
  const resolvedTheme = getStudioThemeOption(
    storyTheme,
    customThemes,
    project.meta.customStoryTheme
  );
  const effectiveTheme =
    readerMode === 'light'
      ? { ...resolvedTheme, tokens: READER_LIGHT_TOKENS }
      : readerMode === 'dark'
      ? { ...resolvedTheme, tokens: READER_DARK_TOKENS }
      : resolvedTheme;
  const themeStyle = getThemeCssVars(effectiveTheme);
  const fontOption = getStoryFontOption(storyFont);
  const fontSizeOption = getStoryFontSizeOption(storyFontSize);

  useEffect(() => {
    setShowHudDrawer(false);
  }, [storyLayout]);

  useEffect(() => {
    if (!playerBanner) return;
    const t = window.setTimeout(() => setPlayerBanner(null), 2600);
    return () => window.clearTimeout(t);
  }, [playerBanner]);

  // Sync audio when passage changes
  useEffect(() => {
    if (!currentPassage) return;
    const ambAsset = currentPassage.ambientAudioId
      ? project.assets.find((a) => a.id === currentPassage.ambientAudioId)
      : undefined;
    synthEngine.playAmbient(ambAsset, currentPassage.ambientLoop ?? true);

    if (skipEntrySfxRef.current) {
      skipEntrySfxRef.current = false;
      return;
    }

    if (currentPassage.entrySfxId) {
      const sfxAsset = project.assets.find((a) => a.id === currentPassage.entrySfxId);
      synthEngine.playSfx(sfxAsset);
    }
  }, [
    currentPassage?.id,
    currentPassage?.ambientAudioId,
    currentPassage?.ambientLoop,
    currentPassage?.entrySfxId,
    project.assets,
  ]);

  // Clean up ambient sound when closing playtest
  useEffect(() => {
    return () => {
      synthEngine.stopAmbient();
    };
  }, []);

  const handleRestart = () => {
    setSession(createInitialSession(project, startPassageId, readerT.runtime));
    setPlayerBanner(readerT.runtime.restarted);
  };

  const handleUndoChoice = () => {
    if (!session.undoStack || session.undoStack.length === 0) return;
    skipEntrySfxRef.current = true;
    setSession((prev) => undoLastChoice(prev, readerT.runtime));
  };

  const handleSaveGameJson = () => {
    const payload = createSaveGamePayload(project, session);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const slug = (project.meta.title || 'otgtam-story')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'story'}.save.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setPlayerBanner(readerT.runtime.savedGame);
  };

  const handleLoadGameJson = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const restored = parseSaveGamePayload(
        project,
        String(reader.result),
        readerT.runtime
      );
      if (!restored) {
        setPlayerBanner(readerT.runtime.invalidSave);
        return;
      }
      skipEntrySfxRef.current = true;
      setSession(restored);
      setPlayerBanner(readerT.runtime.loadedGame);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    synthEngine.setMuted(next);
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    synthEngine.setVolume(val);
    if (muted && val > 0) {
      setMuted(false);
      synthEngine.setMuted(false);
    }
  };

  const handleSelectChoice = (choice: PassageChoice) => {
    if (!evaluateCondition(session, choice.condition)) return;
    if (choice.sfxId) {
      const sfx = project.assets.find((a) => a.id === choice.sfxId);
      synthEngine.playSfx(sfx);
    }
    let next = session;
    if (choice.effects.length > 0) {
      next = applyEffects(project.rpgConfig, next, choice.effects, readerT.runtime);
    }
    next = enterPassage(project, next, choice.targetPassageId, false, readerT.runtime);
    setSession(next);
  };

  const handleRollSkillCheck = () => {
    if (!currentPassage?.skillCheck) return;
    synthEngine.triggerSynthSfx('sfx_dice_roll');
    const result = executeSkillCheck(
      project,
      session,
      currentPassage.skillCheck,
      readerT.runtime
    );
    if (result.roll.passed) {
      window.setTimeout(() => synthEngine.triggerSynthSfx('sfx_discovery'), 220);
    } else {
      window.setTimeout(() => synthEngine.triggerSynthSfx('sfx_damage_hit'), 220);
    }
    setSession(result.session);
  };

  const handleCombatAction = (
    action: 'attack' | 'defend' | 'flee' | { kind: 'use_item'; itemId: string }
  ) => {
    const res = performCombatAction(project, session, action, readerT.runtime);
    if (res.event === 'victory') synthEngine.triggerSynthSfx('sfx_quest_complete');
    else if (res.event === 'hit') synthEngine.triggerSynthSfx('sfx_sword_slash');
    else if (res.event === 'heal') synthEngine.triggerSynthSfx('sfx_potion_heal');
    else if (res.event === 'defeat') synthEngine.triggerSynthSfx('sfx_damage_hit');
    setSession(res.session);
  };

  const handleUseConsumable = (itemId: string) => {
    const item = project.rpgConfig.items.find((i) => i.id === itemId);
    const count = session.inventory[itemId] ?? 0;
    if (!item || count <= 0) return;

    const targetStatId = item.effectStatId || project.rpgConfig.stats[0]?.id || 'hp';
    const statDef = project.rpgConfig.stats.find((s) => s.id === targetStatId);
    const amount = item.effectAmount ?? 10;
    const current = session.stats[targetStatId] ?? statDef?.initial ?? 0;
    const nextVal = statDef
      ? Math.max(statDef.min, Math.min(statDef.max, current + amount))
      : current + amount;

    const nextInv = { ...session.inventory };
    if (count <= 1) delete nextInv[itemId];
    else nextInv[itemId] = count - 1;

    synthEngine.triggerSynthSfx('sfx_potion_heal');
    setSession({
      ...session,
      stats: { ...session.stats, [targetStatId]: nextVal },
      inventory: nextInv,
      notifications: [
        ...session.notifications,
        `${readerT.runtime.used} ${item.name} (+${amount} ${statDef?.name ?? targetStatId})`,
      ],
    });
  };

  if (!currentPassage) {
    return (
      <div
        data-theme={storyTheme}
        style={themeStyle}
        className="fixed inset-0 z-50 bg-[var(--bg-canvas)]/95 text-[var(--text-primary)] flex items-center justify-center p-6"
      >
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 max-w-md text-center space-y-4">
          <p className="text-sm text-[var(--text-primary)]">Target passage does not exist.</p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={handleRestart}
              className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-xs font-semibold"
            >
              {readerT.playtest.restartStory}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
            >
              {readerT.playtest.exit}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderInlineSegments = (text: string): ReactNode =>
    parseInlineFormatting(text).map((seg, i) => {
      if (seg.kind === 'bold') {
        return <strong key={i} className="font-semibold">{seg.text}</strong>;
      }
      if (seg.kind === 'italic') {
        return <em key={i} className="italic">{seg.text}</em>;
      }
      if (seg.kind === 'code') {
        return (
          <code
            key={i}
            className="font-mono-tabular text-[0.88em] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-hairline)]"
          >
            {seg.text}
          </code>
        );
      }
      return <Fragment key={i}>{seg.text}</Fragment>;
    });

  const sceneImage = currentPassage.imageId
    ? project.assets.find((a) => a.id === currentPassage.imageId)
    : undefined;
  const bodyBlocks = parseBodyBlocks(currentPassage.body);
  const combat = session.combat;
  const combatOngoing = combat && combat.resolved === 'ongoing';
  const gearBonus = getEquipmentAttackBonus(project.rpgConfig, session);
  const consumables = project.rpgConfig.items.filter(
    (it) => it.category === 'consumable' && (session.inventory[it.id] ?? 0) > 0
  );
  const visibleQuests = project.rpgConfig.quests.filter(
    (q) => session.quests[q.id] && session.quests[q.id] !== 'hidden'
  );
  const canUndo = (session.undoStack?.length ?? 0) > 0;

  const isDrawerLayout =
    storyLayout === 'blog-journal' || storyLayout === 'cinematic-stage';
  const isTerminal = storyLayout === 'terminal-hud';
  const isDossier = storyLayout === 'dossier-left';
  const isBlog = storyLayout === 'blog-journal';
  const isCinematic = storyLayout === 'cinematic-stage';

  // Reusable Story HUD Content
  const renderHudSections = (horizontal = false) => (
    <div
      className={
        horizontal
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'
          : 'space-y-6'
      }
    >
      {/* Stats */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] border-b border-[var(--border-hairline)] pb-2">
          <UserCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{genreDef.hudLabels.statsTitle}</span>
        </div>
        <div className="space-y-2.5">
          {project.rpgConfig.stats.map((stat) => {
            const val = session.stats[stat.id] ?? stat.initial;
            if (stat.display === 'bar') {
              const pct = Math.max(0, Math.min(1, val / Math.max(1, stat.max)));
              return (
                <div key={stat.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">{stat.name}</span>
                    <span className="font-mono-tabular text-[var(--text-primary)]">
                      {val} / {stat.max}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--bg-canvas)] overflow-hidden border border-[var(--border-hairline)]">
                    <div
                      className="h-full bg-emerald-500 transition-transform duration-200 origin-left"
                      style={{ transform: `scaleX(${pct})` }}
                    />
                  </div>
                </div>
              );
            }
            return (
              <div
                key={stat.id}
                className="flex items-center justify-between text-xs py-0.5"
              >
                <span className="text-[var(--text-muted)]">{stat.name}</span>
                <span className="font-mono-tabular text-[var(--text-primary)] font-medium">
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] border-b border-[var(--border-hairline)] pb-2">
          <Package className="w-3.5 h-3.5 text-sky-400" />
          <span>{genreDef.hudLabels.inventoryTitle}</span>
        </div>
        {Object.keys(session.inventory).length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{readerT.playtest.nothingCollected}</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(session.inventory).map(([itemId, qty]) => {
              const item = project.rpgConfig.items.find((i) => i.id === itemId);
              return (
                <div
                  key={itemId}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="text-[var(--text-primary)] font-medium truncate">
                      {item?.name ?? itemId}{' '}
                      <span className="font-mono-tabular text-[var(--text-muted)]">
                        x{qty}
                      </span>
                    </div>
                    {item?.description && (
                      <div className="text-[11px] text-[var(--text-muted)] truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                  {item?.category === 'consumable' && !combatOngoing && (
                    <button
                      type="button"
                      onClick={() => handleUseConsumable(item.id)}
                      className="px-2 py-1 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[11px] text-emerald-300 shrink-0"
                    >
                      {readerT.common.use}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quests */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] border-b border-[var(--border-hairline)] pb-2">
          <ScrollText className="w-3.5 h-3.5 text-emerald-400" />
          <span>{genreDef.hudLabels.questsTitle}</span>
        </div>
        {visibleQuests.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{readerT.playtest.noneActive}</p>
        ) : (
          <div className="space-y-2.5">
            {visibleQuests.map((q) => {
              const st = session.quests[q.id];
              return (
                <div key={q.id} className="space-y-0.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[var(--text-primary)]">{q.title}</span>
                    <span
                      className={`font-mono-tabular capitalize ${
                        st === 'completed'
                          ? 'text-emerald-400'
                          : st === 'failed'
                          ? 'text-red-400'
                          : 'text-[var(--accent-primary)]'
                      }`}
                    >
                      {st}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">{q.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Factions */}
      {project.rpgConfig.factions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] border-b border-[var(--border-hairline)] pb-2">
            <Shield className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{genreDef.hudLabels.factionsTitle}</span>
          </div>
          <div className="space-y-2">
            {project.rpgConfig.factions.map((f) => {
              const rep = session.factions[f.id] ?? 0;
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-[var(--text-secondary)]">{f.name}</span>
                  <span
                    className={`font-mono-tabular font-medium ${
                      rep > 0
                        ? 'text-emerald-400'
                        : rep < 0
                        ? 'text-red-400'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {rep > 0 ? `+${rep}` : rep}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Reusable Narrative Stage
  const renderNarrativeStage = () => (
    <section
      className={`border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden ${
        isDossier || isTerminal ? 'rounded-md' : 'rounded-xl'
      } ${
        isDossier
          ? 'lg:col-span-8 lg:order-2'
          : !isDrawerLayout && !isTerminal
          ? 'lg:col-span-8'
          : ''
      }`}
    >
      {sceneImage?.url && !imgError[sceneImage.id] ? (
        <div
          className={`relative w-full bg-[#090C11] overflow-hidden ${
            isCinematic ? 'aspect-[16/8] max-h-96' : 'aspect-[16/7] max-h-80'
          }`}
        >
          <img
            src={sceneImage.url}
            alt={sceneImage.name}
            referrerPolicy="no-referrer"
            onError={() =>
              setImgError((prev) => ({ ...prev, [sceneImage.id]: true }))
            }
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-[var(--bg-surface)]/45 to-transparent" />
          <div
            className={`absolute bottom-4 left-6 right-6 ${
              isCinematic ? 'text-center' : ''
            }`}
          >
            {isDossier && (
              <div className="text-[11px] font-mono-tabular text-[var(--accent-primary)] mb-1">
                Casefile Entry · {localizedGenreName}
              </div>
            )}
            <h1
              style={{ fontFamily: fontOption.cssFamily }}
              className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]"
            >
              {interpolateStoryText(currentPassage.title, project, session)}
            </h1>
          </div>
        </div>
      ) : (
        <div
          className={`px-6 pt-6 ${
            isCinematic ? 'text-center' : ''
          } ${isBlog ? 'sm:px-10 sm:pt-9' : ''}`}
        >
          {isDossier && (
            <div className="text-[11px] font-mono-tabular text-[var(--accent-primary)] mb-1">
              Casefile Entry · {localizedGenreName}
            </div>
          )}
          {isBlog && (
            <div className="text-xs text-[var(--text-muted)] mb-1.5">
              {project.meta.author || 'Author'} · {localizedGenreName}
            </div>
          )}
          <h1
            style={{ fontFamily: fontOption.cssFamily }}
            className={`font-bold text-[var(--text-primary)] ${
              isBlog || isCinematic ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
            }`}
          >
            {interpolateStoryText(currentPassage.title, project, session)}
          </h1>
        </div>
      )}

      <div className={`space-y-6 ${isBlog ? 'p-6 sm:p-10' : 'p-6'}`}>
        {/* Entry Notifications */}
        {session.notifications.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono-tabular text-[var(--accent-primary)] border-b border-[var(--border-hairline)] pb-3">
            {session.notifications.map((note, idx) => (
              <span key={idx}>{note}</span>
            ))}
          </div>
        )}

        {/* Blog-Style Interleaved Prose, Rich Formatting & Centered Proportional Inline Images */}
        <div className="space-y-5">
          {bodyBlocks.map((block, idx) => {
            if (block.type === 'text') {
              const interpolated = interpolateStoryText(
                block.content,
                project,
                session
              );
              const richLines = parseRichLines(interpolated);
              if (richLines.length === 0) return null;
              return (
                <div
                  key={idx}
                  style={{
                    fontFamily: fontOption.cssFamily,
                    fontSize: fontSizeOption.cssSize,
                    lineHeight: fontSizeOption.lineHeight,
                  }}
                  className="space-y-3 text-[var(--text-primary)] text-left"
                >
                  {richLines.map((line, lIdx) => {
                    if (line.type === 'hr') {
                      return (
                        <hr
                          key={lIdx}
                          className="border-0 border-t border-[var(--border-hairline)] my-4"
                        />
                      );
                    }
                    if (line.type === 'quote') {
                      return (
                        <blockquote
                          key={lIdx}
                          className="border-l-2 border-[var(--accent-primary)] pl-3.5 py-0.5 italic text-[var(--text-secondary)] whitespace-pre-wrap"
                        >
                          {renderInlineSegments(line.text)}
                        </blockquote>
                      );
                    }
                    return (
                      <p key={lIdx} className="whitespace-pre-wrap">
                        {renderInlineSegments(line.text)}
                      </p>
                    );
                  })}
                </div>
              );
            }
            const inlineAsset = project.assets.find((a) => a.id === block.assetId);
            const widthPercent = block.size ?? 75;
            const renderedCaption = block.caption
              ? interpolateStoryText(block.caption, project, session)
              : '';
            return (
              <figure
                key={idx}
                style={{ width: `${widthPercent}%`, containerType: 'inline-size' }}
                className="mx-auto max-w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              >
                {inlineAsset?.url && !imgError[inlineAsset.id] ? (
                  <img
                    src={inlineAsset.url}
                    alt={renderedCaption || inlineAsset.name}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setImgError((prev) => ({ ...prev, [inlineAsset.id]: true }))
                    }
                    className={`w-full h-auto block ${
                      renderedCaption ? 'rounded-t-xl' : 'rounded-xl'
                    }`}
                  />
                ) : (
                  <div
                    className={`h-36 flex flex-col items-center justify-center text-[var(--text-muted)] ${
                      renderedCaption ? 'rounded-t-xl' : 'rounded-xl'
                    }`}
                  >
                    <ImageIcon className="w-6 h-6 mb-1" />
                    <span className="text-xs">{inlineAsset?.name ?? 'Image'}</span>
                  </div>
                )}
                {renderedCaption && (
                  <figcaption
                    style={{
                      fontSize: 'clamp(9.5px, calc(7px + 1.3cqi), 14px)',
                      padding: 'clamp(4px, 1.8cqi, 8px) clamp(6px, 2.5cqi, 14px)',
                      lineHeight: 1.4,
                    }}
                    className="text-center text-[var(--text-muted)] border-t border-[var(--border-hairline)] whitespace-normal break-words overflow-visible"
                  >
                    {renderedCaption}
                  </figcaption>
                )}
              </figure>
            );
          })}
        </div>

        {/* Turn-Based Combat Arena */}
        {combat && (
          <div className="rounded-xl border border-red-500/35 bg-[var(--bg-canvas)] p-5 space-y-4">
            <div className="flex items-center gap-4">
              {combat.enemyPortraitId &&
                (() => {
                  const portrait = project.assets.find(
                    (a) => a.id === combat.enemyPortraitId
                  );
                  return portrait?.url && !imgError[portrait.id] ? (
                    <img
                      src={portrait.url}
                      alt={combat.enemyName}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setImgError((prev) => ({ ...prev, [portrait.id]: true }))
                      }
                      className="w-18 h-18 rounded-lg object-cover border border-[var(--border-hairline)] shrink-0"
                    />
                  ) : null;
                })()}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-red-400" />
                    <span className="text-base font-semibold text-[var(--text-primary)]">
                      {combat.enemyName}
                    </span>
                  </div>
                  <span className="text-xs font-mono-tabular text-red-300">
                    {combat.enemyHp} / {combat.enemyMaxHp} HP
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[var(--bg-surface)] overflow-hidden border border-[var(--border-hairline)]">
                  <div
                    className="h-full bg-red-500 transition-transform duration-200 origin-left"
                    style={{
                      transform: `scaleX(${Math.max(
                        0,
                        combat.enemyHp / combat.enemyMaxHp
                      )})`,
                    }}
                  />
                </div>
                <div className="text-xs text-[var(--text-muted)] font-mono-tabular">
                  {readerT.runtime.attackLabel}: {combat.enemyAttackMin}–{combat.enemyAttackMax} ·{' '}
                  {readerT.runtime.defenseLabel}: {combat.enemyDefense}
                  {gearBonus > 0 && ` · ${readerT.runtime.gearBonus}: +${gearBonus}`}
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-3 max-h-36 overflow-y-auto space-y-1 text-xs text-[var(--text-secondary)]">
              {combat.log.map((entry, idx) => (
                <div key={idx}>{entry}</div>
              ))}
            </div>

            {combatOngoing ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleCombatAction('attack')}
                  className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-xs font-semibold transition-colors"
                >
                  {readerT.playtest.attack}
                </button>
                <button
                  type="button"
                  onClick={() => handleCombatAction('defend')}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors"
                >
                  {readerT.playtest.defend}
                </button>
                {consumables.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      handleCombatAction({ kind: 'use_item', itemId: item.id })
                    }
                    className="px-3.5 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-xs font-medium text-emerald-300 transition-colors"
                  >
                    {readerT.common.use} {item.name} ({session.inventory[item.id]})
                  </button>
                ))}
                {combat.fleePassageId && (
                  <button
                    type="button"
                    onClick={() => handleCombatAction('flee')}
                    className="px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-secondary)] transition-colors"
                  >
                    {readerT.playtest.flee}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    const targetId =
                      combat.resolved === 'victory'
                        ? combat.victoryPassageId
                        : combat.resolved === 'defeat'
                        ? combat.defeatPassageId
                        : combat.fleePassageId;
                    if (targetId) {
                      setSession(
                        enterPassage(project, session, targetId, false, readerT.runtime)
                      );
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-xs font-semibold"
                >
                  {combat.resolved === 'victory'
                    ? readerT.playtest.claimVictory
                    : combat.resolved === 'defeat'
                    ? readerT.playtest.continueLabel
                    : readerT.playtest.retreatSafety}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dice Skill Check */}
        {currentPassage.skillCheck && !combatOngoing && (
          <div className="rounded-xl border border-sky-500/35 bg-[var(--bg-canvas)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
                <Dices className="w-4 h-4" />
                <span>{currentPassage.skillCheck.label}</span>
              </div>
              <span className="text-xs font-mono-tabular text-[var(--text-muted)]">
                {currentPassage.skillCheck.dice} +{' '}
                {project.rpgConfig.stats.find(
                  (s) => s.id === currentPassage.skillCheck?.statId
                )?.name ?? currentPassage.skillCheck.statId}{' '}
                vs DC {currentPassage.skillCheck.difficulty}
              </span>
            </div>

            {!session.lastRoll ? (
              <button
                type="button"
                onClick={handleRollSkillCheck}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-[#0B0E14] text-xs font-semibold transition-colors"
              >
                <Dices className="w-4 h-4" />
                <span>
                  {readerT.playtest.roll} {currentPassage.skillCheck.dice}
                </span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-mono-tabular text-[var(--text-primary)]">
                  {readerT.runtime.rolled} [{session.lastRoll.rawRolls.join(' + ')}] +{' '}
                  {session.lastRoll.modifier} ({session.lastRoll.statName}) ={' '}
                  <strong className="text-white">{session.lastRoll.total}</strong> vs{' '}
                  {session.lastRoll.difficulty}{' '}
                  <span
                    className={
                      session.lastRoll.passed
                        ? 'text-emerald-400 font-semibold'
                        : 'text-red-400 font-semibold'
                    }
                  >
                    — {session.lastRoll.passed ? readerT.runtime.passed : readerT.runtime.failed}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSession(
                      enterPassage(
                        project,
                        session,
                        session.lastRoll!.nextPassageId,
                        false,
                        readerT.runtime
                      )
                    )
                  }
                  className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-xs font-semibold"
                >
                  {readerT.playtest.proceed}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Standard Choices (Theme Accent Underlay) + Undo Choice on Passage */}
        {!combatOngoing && (
          <div className={`space-y-3 pt-2 ${isCinematic ? 'max-w-xl mx-auto' : ''}`}>
            {currentPassage.choices.length === 0 &&
            !currentPassage.skillCheck &&
            !combat ? (
              <div className="pt-2 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-[var(--text-muted)]">
                  {readerT.playtest.endOfBranch}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUndoChoice}
                    disabled={!canUndo}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>{readerT.playtest.undoChoice}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-xs font-semibold"
                  >
                    {readerT.playtest.playAgain}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2.5">
                  {currentPassage.choices
                    .filter(
                      (choice) =>
                        !choice.hideWhenLocked ||
                        evaluateCondition(session, choice.condition)
                    )
                    .map((choice) => {
                      const unlocked = evaluateCondition(session, choice.condition);
                      const condText = formatConditionLabel(
                        project.rpgConfig,
                        choice.condition,
                        project.passages,
                        readerT.runtime
                      );
                      const labelText = interpolateStoryText(
                        choice.label,
                        project,
                        session
                      );
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          disabled={!unlocked}
                          onClick={() => handleSelectChoice(choice)}
                          className={`w-full text-left px-4 py-3 border flex items-center justify-between gap-4 transition-colors ${
                            isDossier || isTerminal ? 'rounded-md' : 'rounded-lg'
                          } ${
                            unlocked
                              ? 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] border-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold shadow-sm'
                              : 'bg-[var(--bg-elevated)]/60 border-[var(--border-hairline)] text-[var(--text-muted)] cursor-not-allowed'
                          }`}
                        >
                          <span
                            className={`text-sm ${
                              unlocked ? 'font-semibold' : 'font-medium'
                            } ${isTerminal ? 'font-mono-tabular' : ''}`}
                          >
                            {isTerminal ? `> ${labelText}` : labelText}
                          </span>
                          {choice.condition && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono-tabular shrink-0 opacity-90">
                              <Lock className="w-3.5 h-3.5" />
                              <span>{condText}</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>

                {/* Undo Choice button right on the passage */}
                <div className="pt-2 border-t border-[var(--border-hairline)]/70 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleUndoChoice}
                    disabled={!canUndo}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>{readerT.playtest.undoChoice}</span>
                  </button>
                  <span className="text-[11px] font-mono-tabular text-[var(--text-muted)]">
                    {readerT.common.step} {session.history.length}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div
      data-theme={storyTheme}
      style={themeStyle}
      className="fixed inset-0 z-50 bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col"
    >
      {/* Player Top Bar */}
      <header className="min-h-14 py-2 shrink-0 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base font-bold text-[var(--text-primary)] truncate">
            {project.meta.title}
          </span>
          <span className="hidden xl:inline text-xs text-[var(--text-muted)] whitespace-nowrap">
            {localizedGenreName} · {t.nav.playtest}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Reader Light / Dark Override (Matches Exported HTML) */}
          <select
            aria-label={readerT.playtest.readerModeDefault}
            value={readerMode}
            onChange={(e) =>
              setReaderMode(e.target.value as 'default' | 'light' | 'dark')
            }
            className="px-2 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
          >
            <option value="default">{readerT.playtest.readerModeDefault}</option>
            <option value="light">{readerT.playtest.readerModeLight}</option>
            <option value="dark">{readerT.playtest.readerModeDark}</option>
          </select>

          {/* Live Story Interface Switcher */}
          {onUpdateStoryInterface && (
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label={readerT.storySettings.readerLayout}
                value={storyLayout}
                onChange={(e) =>
                  onUpdateStoryInterface({
                    storyLayout: e.target.value as StoryLayoutId,
                  })
                }
                className="px-2 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                {STORY_LAYOUTS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {readerT.playtest.layoutPrefix}: {readerT.storyLayouts[l.id]?.name ?? l.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={readerT.storySettings.colorPalette}
                value={storyTheme}
                onChange={(e) => {
                  const chosenId = e.target.value;
                  const found = allThemes.find((th) => th.id === chosenId);
                  setReaderMode('default');
                  onUpdateStoryInterface({
                    storyTheme: chosenId,
                    customStoryTheme: found?.isCustom
                      ? (found as CustomStoryTheme)
                      : undefined,
                  });
                }}
                className="px-2 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                {allThemes.map((th) => (
                  <option key={th.id} value={th.id}>
                    {readerT.playtest.themePrefix}:{' '}
                    {th.isCustom ? th.name : readerT.studioThemes[th.id]?.name ?? th.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={readerT.storySettings.fontFamily}
                value={storyFont}
                onChange={(e) =>
                  onUpdateStoryInterface({
                    storyFont: e.target.value as StoryFontId,
                  })
                }
                className="px-2 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                {STORY_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {readerT.playtest.fontPrefix}: {f.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={readerT.storySettings.fontSize}
                value={storyFontSize}
                onChange={(e) =>
                  onUpdateStoryInterface({
                    storyFontSize: e.target.value as StoryFontSizeId,
                  })
                }
                className="px-2 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                {STORY_FONT_SIZES.map((sz) => (
                  <option key={sz.id} value={sz.id}>
                    {readerT.playtest.sizePrefix}:{' '}
                    {readerT.storyFontSizes[sz.id]?.name ?? sz.name} ({sz.label})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Save & Load Game JSON */}
          <button
            type="button"
            onClick={handleSaveGameJson}
            title={readerT.playtest.saveGame}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="hidden sm:inline">{readerT.playtest.saveGame}</span>
          </button>

          <button
            type="button"
            onClick={() => loadInputRef.current?.click()}
            title={readerT.playtest.loadGame}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] whitespace-nowrap"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span className="hidden sm:inline">{readerT.playtest.loadGame}</span>
          </button>
          <input
            ref={loadInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleLoadGameJson}
            className="hidden"
          />

          {/* Volume & Mute */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={muted ? readerT.playtest.soundOff : readerT.playtest.soundOn}
              className="text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-[var(--text-muted)]" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              aria-label={t.home.masterVolume}
              className="w-14 accent-[var(--accent-primary)] hidden xl:block"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowDebugger((v) => !v)}
            title={t.playtest.debuggerTitle}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
              showDebugger
                ? 'bg-[var(--bg-elevated)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{t.playtest.debuggerTitle}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHudDrawer((v) => !v)}
            className={`${
              isDrawerLayout ? 'inline-flex' : 'lg:hidden inline-flex'
            } px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
              showHudDrawer
                ? 'bg-[var(--bg-elevated)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-primary)]'
            }`}
          >
            {readerT.playtest.storySheet}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{readerT.playtest.restart}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-xs font-semibold whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>{readerT.playtest.exit}</span>
          </button>
        </div>
      </header>

      {/* Main Play Viewport */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {showDebugger && (
          <div className="max-w-5xl mx-auto mb-5 rounded-xl border border-[var(--accent-primary)]/50 bg-[var(--bg-surface)] p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-primary)]">
                <Wrench className="w-3.5 h-3.5" />
                <span>{t.playtest.debuggerTitle}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">
                  {t.playtest.jumpToLabel}:
                </span>
                <select
                  value={session.currentPassageId}
                  onChange={(e) =>
                    setSession(
                      enterPassage(
                        project,
                        session,
                        e.target.value,
                        false,
                        readerT.runtime
                      )
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  {Object.values(project.passages).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || p.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowDebugger(false)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  aria-label={t.common.close}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Live Stats */}
              <div className="space-y-2">
                <div className="font-semibold text-[var(--text-secondary)]">
                  {t.playtest.liveStats}
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {project.rpgConfig.stats.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-[var(--text-muted)] truncate">
                        {st.name}
                      </span>
                      <input
                        type="number"
                        value={session.stats[st.id] ?? st.initial}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setSession((prev) => ({
                            ...prev,
                            stats: {
                              ...prev.stats,
                              [st.id]: Number.isFinite(v) ? v : 0,
                            },
                          }));
                        }}
                        className="w-18 px-2 py-1 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs font-mono-tabular text-[var(--text-primary)] text-right"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Flags */}
              <div className="space-y-2">
                <div className="font-semibold text-[var(--text-secondary)]">
                  {t.playtest.liveFlags}
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {(project.rpgConfig.flags || []).length === 0 ? (
                    <p className="text-[var(--text-muted)]">—</p>
                  ) : (
                    (project.rpgConfig.flags || []).map((fl) => {
                      const val = Boolean(session.flags?.[fl.id]);
                      return (
                        <div
                          key={fl.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-[var(--text-muted)] truncate">
                            {fl.name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSession((prev) => ({
                                ...prev,
                                flags: {
                                  ...(prev.flags || {}),
                                  [fl.id]: !val,
                                },
                              }))
                            }
                            className={`px-2 py-0.5 rounded border text-[11px] font-mono-tabular ${
                              val
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-muted)]'
                            }`}
                          >
                            {val
                              ? readerT.runtime.trueLabel
                              : readerT.runtime.falseLabel}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Live Inventory */}
              <div className="space-y-2">
                <div className="font-semibold text-[var(--text-secondary)]">
                  {t.playtest.liveInventory}
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {project.rpgConfig.items.length === 0 ? (
                    <p className="text-[var(--text-muted)]">—</p>
                  ) : (
                    project.rpgConfig.items.map((it) => {
                      const qty = session.inventory[it.id] ?? 0;
                      return (
                        <div
                          key={it.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-[var(--text-muted)] truncate">
                            {it.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setSession((prev) => {
                                  const nextInv = { ...prev.inventory };
                                  const nextQty = Math.max(
                                    0,
                                    (nextInv[it.id] ?? 0) - 1
                                  );
                                  if (nextQty === 0) delete nextInv[it.id];
                                  else nextInv[it.id] = nextQty;
                                  return { ...prev, inventory: nextInv };
                                })
                              }
                              className="w-5 h-5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-mono-tabular text-[var(--text-primary)]">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setSession((prev) => ({
                                  ...prev,
                                  inventory: {
                                    ...prev.inventory,
                                    [it.id]: (prev.inventory[it.id] ?? 0) + 1,
                                  },
                                }))
                              }
                              className="w-5 h-5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Live Quests */}
              <div className="space-y-2">
                <div className="font-semibold text-[var(--text-secondary)]">
                  {t.playtest.liveQuests}
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {project.rpgConfig.quests.length === 0 ? (
                    <p className="text-[var(--text-muted)]">—</p>
                  ) : (
                    project.rpgConfig.quests.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-[var(--text-muted)] truncate">
                          {q.title}
                        </span>
                        <select
                          value={session.quests[q.id] ?? q.initialStatus}
                          onChange={(e) =>
                            setSession((prev) => ({
                              ...prev,
                              quests: {
                                ...prev.quests,
                                [q.id]: e.target.value as
                                  | 'hidden'
                                  | 'active'
                                  | 'completed'
                                  | 'failed',
                              },
                            }))
                          }
                          className="px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-primary)]"
                        >
                          <option value="hidden">hidden</option>
                          <option value="active">active</option>
                          <option value="completed">completed</option>
                          <option value="failed">failed</option>
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {playerBanner && (
          <div className="max-w-5xl mx-auto mb-4 px-3.5 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--accent-primary)]/60 text-xs text-[var(--text-primary)] flex items-center justify-between">
            <span>{playerBanner}</span>
            <button
              type="button"
              onClick={() => setPlayerBanner(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isTerminal ? (
          <div className="max-w-5xl mx-auto space-y-5">
            <aside className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
              {renderHudSections(true)}
            </aside>
            {renderNarrativeStage()}
          </div>
        ) : isDrawerLayout ? (
          <div
            className={`${
              isCinematic ? 'max-w-4xl' : 'max-w-3xl'
            } mx-auto space-y-6`}
          >
            {showHudDrawer && (
              <aside className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
                {renderHudSections(true)}
              </aside>
            )}
            {renderNarrativeStage()}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {renderNarrativeStage()}

            <aside
              className={`lg:col-span-4 border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 ${
                isDossier ? 'rounded-md lg:order-1' : 'rounded-xl'
              } ${showHudDrawer ? 'block' : 'hidden lg:block'}`}
            >
              {renderHudSections(false)}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
