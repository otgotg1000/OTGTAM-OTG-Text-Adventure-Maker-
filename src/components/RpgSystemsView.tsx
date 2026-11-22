import { Package, Plus, ScrollText, Shield, Sliders, ToggleRight, Trash2 } from 'lucide-react';
import { getGenreDefinition } from '../data/genreTemplates';
import { useI18n } from '../i18n/LanguageContext';
import {
  FactionDefinition,
  FlagDefinition,
  ItemCategory,
  ItemDefinition,
  QuestDefinition,
  QuestStatus,
  RpgConfig,
  StatDefinition,
  StatDisplayMode,
  StoryGenre,
} from '../types/story';

interface RpgSystemsViewProps {
  genre?: StoryGenre;
  config: RpgConfig;
  onUpdateConfig: (next: RpgConfig) => void;
}

export function RpgSystemsView({ genre, config, onUpdateConfig }: RpgSystemsViewProps) {
  const { t } = useI18n();
  const genreDef = getGenreDefinition(genre);

  // Stats handlers
  const addStat = () => {
    const next: StatDefinition = {
      id: `stat_${Date.now()}`,
      name: 'New Meter',
      initial: 5,
      min: 0,
      max: 20,
      display: 'attribute',
    };
    onUpdateConfig({ ...config, stats: [...config.stats, next] });
  };

  const updateStat = (idx: number, patch: Partial<StatDefinition>) => {
    const stats = config.stats.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onUpdateConfig({ ...config, stats });
  };

  const removeStat = (idx: number) => {
    onUpdateConfig({ ...config, stats: config.stats.filter((_, i) => i !== idx) });
  };

  // Items handlers
  const addItem = () => {
    const next: ItemDefinition = {
      id: `item_${Date.now()}`,
      name: 'New Item',
      category: 'key',
      description: 'Describe what this item unlocks or restores.',
    };
    onUpdateConfig({ ...config, items: [...config.items, next] });
  };

  const updateItem = (idx: number, patch: Partial<ItemDefinition>) => {
    const items = config.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onUpdateConfig({ ...config, items });
  };

  const removeItem = (idx: number) => {
    onUpdateConfig({ ...config, items: config.items.filter((_, i) => i !== idx) });
  };

  // Quests handlers
  const addQuest = () => {
    const next: QuestDefinition = {
      id: `quest_${Date.now()}`,
      title: 'New Objective',
      description: 'Brief summary shown in the story sheet.',
      initialStatus: 'hidden',
    };
    onUpdateConfig({ ...config, quests: [...config.quests, next] });
  };

  const updateQuest = (idx: number, patch: Partial<QuestDefinition>) => {
    const quests = config.quests.map((q, i) => (i === idx ? { ...q, ...patch } : q));
    onUpdateConfig({ ...config, quests });
  };

  const removeQuest = (idx: number) => {
    onUpdateConfig({ ...config, quests: config.quests.filter((_, i) => i !== idx) });
  };

  // Factions handlers
  const addFaction = () => {
    const next: FactionDefinition = {
      id: `fac_${Date.now()}`,
      name: 'New Faction / Character',
      description: 'Group or character tracking relationship standing.',
      initialReputation: 0,
    };
    onUpdateConfig({ ...config, factions: [...config.factions, next] });
  };

  const updateFaction = (idx: number, patch: Partial<FactionDefinition>) => {
    const factions = config.factions.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onUpdateConfig({ ...config, factions });
  };

  const removeFaction = (idx: number) => {
    onUpdateConfig({ ...config, factions: config.factions.filter((_, i) => i !== idx) });
  };

  // Story Flags handlers
  const flagsList = config.flags || [];

  const addFlag = () => {
    const next: FlagDefinition = {
      id: `flag_${Date.now()}`,
      name: 'secret_discovered',
      description: 'Boolean story switch to track events or choices.',
      initialValue: false,
    };
    onUpdateConfig({ ...config, flags: [...flagsList, next] });
  };

  const updateFlag = (idx: number, patch: Partial<FlagDefinition>) => {
    const flags = flagsList.map((fl, i) => (i === idx ? { ...fl, ...patch } : fl));
    onUpdateConfig({ ...config, flags });
  };

  const removeFlag = (idx: number) => {
    onUpdateConfig({ ...config, flags: flagsList.filter((_, i) => i !== idx) });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {t.systems.titlePrefix} — {genreDef.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {t.systems.subtitle}
          </p>
        </div>

        {/* 1. Stats & Meters */}
        <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {genreDef.hudLabels.statsTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={addStat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.systems.addStat}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)]">
                  <th className="py-2 pr-3 font-medium">{t.systems.name}</th>
                  <th className="py-2 px-3 font-medium">{t.systems.display}</th>
                  <th className="py-2 px-3 font-medium">{t.systems.start}</th>
                  <th className="py-2 px-3 font-medium">{t.systems.min}</th>
                  <th className="py-2 px-3 font-medium">{t.systems.max}</th>
                  <th className="py-2 pl-3 text-right font-medium">{t.systems.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {config.stats.map((stat, idx) => (
                  <tr key={stat.id}>
                    <td className="py-2.5 pr-3">
                      <input
                        type="text"
                        value={stat.name}
                        onChange={(e) => updateStat(idx, { name: e.target.value })}
                        className="w-full min-w-[140px] px-2.5 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={stat.display}
                        onChange={(e) =>
                          updateStat(idx, { display: e.target.value as StatDisplayMode })
                        }
                        className="px-2.5 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        <option value="bar">{t.systems.resourceBar}</option>
                        <option value="attribute">{t.systems.attribute}</option>
                        <option value="currency">{t.systems.counterCurrency}</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        value={stat.initial}
                        onChange={(e) => updateStat(idx, { initial: Number(e.target.value) || 0 })}
                        className="w-20 px-2.5 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        value={stat.min}
                        onChange={(e) => updateStat(idx, { min: Number(e.target.value) || 0 })}
                        className="w-20 px-2.5 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        value={stat.max}
                        onChange={(e) => updateStat(idx, { max: Number(e.target.value) || 100 })}
                        className="w-20 px-2.5 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                      />
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeStat(idx)}
                        disabled={config.stats.length <= 1}
                        className="p-1.5 rounded hover:bg-red-500/15 text-[var(--text-muted)] hover:text-red-400 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. Inventory / Clues / Keepsakes */}
        <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Package className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {genreDef.hudLabels.inventoryTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.systems.addItem}</span>
            </button>
          </div>

          <div className="space-y-3">
            {config.items.map((item, idx) => {
              const resolvedStatId =
                item.effectStatId && config.stats.some((s) => s.id === item.effectStatId)
                  ? item.effectStatId
                  : config.stats[0]?.id || '';
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(140px,1.2fr)_130px_minmax(170px,1.5fr)_160px_110px_auto] gap-3 items-end text-xs"
                >
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      {t.systems.name}
                    </label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      {t.systems.category}
                    </label>
                    <select
                      value={item.category}
                      onChange={(e) => {
                        const nextCat = e.target.value as ItemCategory;
                        updateItem(idx, {
                          category: nextCat,
                          effectStatId:
                            nextCat === 'consumable'
                              ? item.effectStatId || config.stats[0]?.id || ''
                              : item.effectStatId,
                          effectAmount:
                            nextCat !== 'key' && item.effectAmount === undefined
                              ? 5
                              : item.effectAmount,
                        });
                      }}
                      className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                    >
                      <option value="key">{t.systems.keyClue}</option>
                      <option value="consumable">{t.systems.consumable}</option>
                      <option value="equipment">{t.systems.equipment}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      {t.systems.description}
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1 truncate">
                      {item.category === 'equipment'
                        ? t.systems.combatStat
                        : genreDef.hudLabels.statsTitle}
                    </label>
                    {item.category === 'consumable' ? (
                      <select
                        value={resolvedStatId}
                        onChange={(e) =>
                          updateItem(idx, { effectStatId: e.target.value })
                        }
                        aria-label={`Select ${genreDef.hudLabels.statsTitle}`}
                        className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        {config.stats.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        disabled
                        value={item.category === 'equipment' ? t.systems.atkBonus : '—'}
                        className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-muted)] disabled:opacity-40"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      {item.category === 'equipment'
                        ? t.systems.atkBonus
                        : item.category === 'consumable'
                        ? t.systems.restoreBoost
                        : t.systems.bonus}
                    </label>
                    <input
                      type="number"
                      disabled={item.category === 'key'}
                      value={item.effectAmount ?? 0}
                      onChange={(e) =>
                        updateItem(idx, {
                          effectStatId:
                            item.category === 'consumable'
                              ? resolvedStatId
                              : item.effectStatId,
                          effectAmount: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular disabled:opacity-35"
                    />
                  </div>
                  <div className="flex justify-end pb-0.5">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-1.5 rounded hover:bg-red-500/15 text-[var(--text-muted)] hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Quests & Factions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {genreDef.hudLabels.questsTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={addQuest}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)]"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.common.add}</span>
              </button>
            </div>

            <div className="space-y-3">
              {config.quests.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 space-y-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={q.title}
                      onChange={(e) => updateQuest(idx, { title: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-medium"
                    />
                    <select
                      value={q.initialStatus}
                      onChange={(e) =>
                        updateQuest(idx, { initialStatus: e.target.value as QuestStatus })
                      }
                      className="px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                    >
                      <option value="hidden">{t.systems.hiddenAtStart}</option>
                      <option value="active">{t.systems.activeAtStart}</option>
                      <option value="completed">{t.systems.completed}</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeQuest(idx)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={q.description}
                    onChange={(e) => updateQuest(idx, { description: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-muted)]"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {genreDef.hudLabels.factionsTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={addFaction}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)]"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.common.add}</span>
              </button>
            </div>

            <div className="space-y-3">
              {config.factions.map((f, idx) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 space-y-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={f.name}
                      onChange={(e) => updateFaction(idx, { name: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-medium"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--text-muted)]">{t.systems.start}</span>
                      <input
                        type="number"
                        value={f.initialReputation}
                        onChange={(e) =>
                          updateFaction(idx, {
                            initialReputation: Number(e.target.value) || 0,
                          })
                        }
                        className="w-16 px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-mono-tabular"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFaction(idx)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={f.description}
                    onChange={(e) => updateFaction(idx, { description: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-muted)]"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 4. Story Flags & Switches */}
        <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <ToggleRight className="w-4 h-4 text-violet-400" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {t.systems.flagsTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={addFlag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.systems.addFlag}</span>
            </button>
          </div>

          {flagsList.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              {t.systems.subtitle}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {flagsList.map((fl, idx) => (
                <div
                  key={fl.id}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 space-y-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={fl.name}
                      onChange={(e) => updateFlag(idx, { name: e.target.value })}
                      aria-label={t.systems.name}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-medium font-mono-tabular"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {t.systems.initialState}
                      </span>
                      <select
                        value={fl.initialValue ? 'true' : 'false'}
                        onChange={(e) =>
                          updateFlag(idx, { initialValue: e.target.value === 'true' })
                        }
                        className="px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        <option value="false">{t.runtime.falseLabel}</option>
                        <option value="true">{t.runtime.trueLabel}</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFlag(idx)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={fl.description}
                    onChange={(e) => updateFlag(idx, { description: e.target.value })}
                    placeholder={t.systems.description}
                    className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-muted)]"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
