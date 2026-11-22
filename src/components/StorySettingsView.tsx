import {
  Check,
  Globe,
  Layout,
  Palette,
  Plus,
  Trash2,
  Type,
} from 'lucide-react';
import { useState } from 'react';
import {
  buildCustomStoryTheme,
  getAllStoryThemes,
  getDefaultLayoutForGenre,
  STORY_FONTS,
  STORY_FONT_SIZES,
  STORY_LAYOUTS,
} from '../data/themes';
import { useI18n } from '../i18n/LanguageContext';
import { LANGUAGE_OPTIONS } from '../i18n/translations';
import {
  AppLanguage,
  CustomStoryTheme,
  StoryFontId,
  StoryFontSizeId,
  StoryLayoutId,
  StoryProject,
  StudioThemeId,
} from '../types/story';

interface StorySettingsViewProps {
  project: StoryProject;
  defaultStoryTheme: StudioThemeId;
  defaultStoryLayout: StoryLayoutId;
  defaultStoryFont: StoryFontId;
  defaultStoryFontSize: StoryFontSizeId;
  customThemes: CustomStoryTheme[];
  onCreateCustomTheme: (theme: CustomStoryTheme) => void;
  onDeleteCustomTheme: (themeId: string) => void;
  onUpdateMeta: (patch: Partial<StoryProject['meta']>) => void;
}

export function StorySettingsView({
  project,
  defaultStoryTheme,
  defaultStoryLayout,
  defaultStoryFont,
  defaultStoryFontSize,
  customThemes,
  onCreateCustomTheme,
  onDeleteCustomTheme,
  onUpdateMeta,
}: StorySettingsViewProps) {
  const { t } = useI18n();
  const [showThemeCreator, setShowThemeCreator] = useState(false);
  const [cName, setCName] = useState('');
  const [cBg, setCBg] = useState('#101419');
  const [cSurface, setCSurface] = useState('#182028');
  const [cText, setCText] = useState('#F1F5F9');
  const [cAccent, setCAccent] = useState('#E11D48');

  const activeStoryTheme = project.meta.storyTheme || defaultStoryTheme;
  const activeStoryLayout =
    project.meta.storyLayout ||
    getDefaultLayoutForGenre(project.meta.genre) ||
    defaultStoryLayout;
  const activeStoryFont = project.meta.storyFont || defaultStoryFont;
  const activeStoryFontSize = project.meta.storyFontSize || defaultStoryFontSize;

  const allThemes = getAllStoryThemes(customThemes, project.meta.customStoryTheme);

  const handleSaveCustomTheme = () => {
    if (!cName.trim()) return;
    const created = buildCustomStoryTheme({
      name: cName,
      bg: cBg,
      surface: cSurface,
      text: cText,
      accent: cAccent,
    });
    onCreateCustomTheme(created);
    onUpdateMeta({ storyTheme: created.id, customStoryTheme: created });
    setCName('');
    setShowThemeCreator(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {t.storySettings.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {t.storySettings.subtitle} &ldquo;{project.meta.title}&rdquo;.
          </p>
        </div>

        {/* Per-Project Story Interface Theme (Playtest & HTML Export Only) */}
        <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-6">
          <div className="border-b border-[var(--border-hairline)] pb-3 space-y-1">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {t.storySettings.cardTitle}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {t.storySettings.cardSubtitle}
            </p>
          </div>

          {/* Layout Cards */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <Layout className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t.storySettings.readerLayout}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {STORY_LAYOUTS.map((layout) => {
                const selected = activeStoryLayout === layout.id;
                const lCopy = t.storyLayouts[layout.id];
                return (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => onUpdateMeta({ storyLayout: layout.id })}
                    className={`text-left rounded-xl border p-3.5 flex flex-col justify-between gap-2.5 transition-colors ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          {lCopy.name}
                        </span>
                        {selected && (
                          <Check className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                        {lCopy.description}
                      </p>
                    </div>
                    <div className="text-[11px] text-[var(--accent-primary)]">
                      {t.storySettings.bestFor}: {lCopy.bestFor}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Story Font Family */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-hairline)]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <Type className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t.storySettings.fontFamily}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {STORY_FONTS.map((font) => {
                const selected = activeStoryFont === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => onUpdateMeta({ storyFont: font.id })}
                    className={`text-left rounded-lg border px-3 py-2.5 space-y-1 transition-colors ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div
                      style={{ fontFamily: font.cssFamily }}
                      className="text-xs font-semibold text-[var(--text-primary)] truncate"
                    >
                      {font.name}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate">
                      {t.storyFonts[font.id].description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Story Font Size */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-hairline)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                <Type className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{t.storySettings.fontSize}</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                {t.storySettings.fontSizeHint}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {STORY_FONT_SIZES.map((sz) => {
                const selected = activeStoryFontSize === sz.id;
                return (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => onUpdateMeta({ storyFontSize: sz.id })}
                    className={`text-left rounded-lg border px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-primary)]">
                        {t.storyFontSizes[sz.id].name}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-[var(--text-muted)]">
                        {sz.label}
                      </div>
                    </div>
                    {selected && (
                      <Check className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reader Color Palette Cards + Custom Theme Builder */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-hairline)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                <Palette className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{t.storySettings.colorPalette}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowThemeCreator((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--accent-primary)]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.storySettings.newCustomTheme}</span>
              </button>
            </div>

            {showThemeCreator && (
              <div className="rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--bg-canvas)] p-4 space-y-3">
                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  {t.storySettings.createCustomTheme}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      {t.storySettings.themeName}
                    </label>
                    <input
                      type="text"
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      placeholder={t.home.customThemeNamePlaceholder}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      {t.storySettings.mainBg}
                    </label>
                    <input
                      type="color"
                      value={cBg}
                      onChange={(e) => setCBg(e.target.value)}
                      className="w-full h-8 rounded cursor-pointer bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      {t.storySettings.passageSurface}
                    </label>
                    <input
                      type="color"
                      value={cSurface}
                      onChange={(e) => setCSurface(e.target.value)}
                      className="w-full h-8 rounded cursor-pointer bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      {t.storySettings.storyText}
                    </label>
                    <input
                      type="color"
                      value={cText}
                      onChange={(e) => setCText(e.target.value)}
                      className="w-full h-8 rounded cursor-pointer bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      {t.storySettings.accentChoices}
                    </label>
                    <input
                      type="color"
                      value={cAccent}
                      onChange={(e) => setCAccent(e.target.value)}
                      className="w-full h-8 rounded cursor-pointer bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-0.5"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowThemeCreator(false)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] text-xs text-[var(--text-muted)]"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomTheme}
                    disabled={!cName.trim()}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-[var(--accent-contrast)] text-xs font-semibold"
                  >
                    {t.storySettings.saveStoryTheme}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {allThemes.map((theme) => {
                const selected = activeStoryTheme === theme.id;
                return (
                  <div
                    key={theme.id}
                    className={`rounded-lg border px-3 py-2.5 flex flex-col justify-between gap-2 transition-colors ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateMeta({
                            storyTheme: theme.id,
                            customStoryTheme: theme.isCustom
                              ? (theme as CustomStoryTheme)
                              : undefined,
                          })
                        }
                        className="flex-1 min-w-0 text-left flex items-center justify-between gap-1.5"
                      >
                        <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {theme.isCustom
                            ? theme.name
                            : t.studioThemes[theme.id]?.name || theme.name}
                        </span>
                        {selected && (
                          <Check className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                        )}
                      </button>
                      {theme.isCustom && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomTheme(theme.id)}
                          title={`${t.common.delete}: ${theme.name}`}
                          className="p-0.5 rounded text-[var(--text-muted)] hover:text-red-400 shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateMeta({
                          storyTheme: theme.id,
                          customStoryTheme: theme.isCustom
                            ? (theme as CustomStoryTheme)
                            : undefined,
                        })
                      }
                      className="flex items-center gap-1.5"
                    >
                      {theme.swatches.map((hex, i) => (
                        <span
                          key={i}
                          style={{ backgroundColor: hex }}
                          className="w-3 h-3 rounded-full border border-white/20"
                        />
                      ))}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-Project Story Reader & Export Language */}
          <div className="space-y-2.5 pt-4 border-t border-[var(--border-hairline)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                  <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{t.storySettings.storyLanguageTitle}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {t.storySettings.storyLanguageDesc}
                </p>
              </div>
              <select
                aria-label={t.storySettings.storyLanguageTitle}
                value={project.meta.storyLanguage || ''}
                onChange={(e) =>
                  onUpdateMeta({
                    storyLanguage: (e.target.value || undefined) as
                      | AppLanguage
                      | undefined,
                  })
                }
                className="px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                <option value="">{t.storySettings.matchStudioLang}</option>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.nativeName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
