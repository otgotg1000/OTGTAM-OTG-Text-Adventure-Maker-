import {
  Download,
  FileCode2,
  FolderOpen,
  Layers,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import { ChangeEvent, useRef, useState } from 'react';
import { GENRE_DEFINITIONS } from '../data/genreTemplates';
import {
  getDefaultLayoutForGenre,
  getStoryFontOption,
  getStoryFontSizeOption,
  getStoryLayoutOption,
  getStudioThemeOption,
} from '../data/themes';
import { compileStandaloneHtml } from '../engine/htmlExporter';
import { getProjectWordStats } from '../engine/textStats';
import { useI18n } from '../i18n/LanguageContext';
import {
  CustomStoryTheme,
  StoryFontId,
  StoryFontSizeId,
  StoryGenre,
  StoryLayoutId,
  StoryProject,
  StudioThemeId,
} from '../types/story';

interface ExportViewProps {
  project: StoryProject;
  defaultStoryTheme: StudioThemeId;
  defaultStoryLayout: StoryLayoutId;
  defaultStoryFont: StoryFontId;
  defaultStoryFontSize: StoryFontSizeId;
  customThemes: CustomStoryTheme[];
  onUpdateMeta: (patch: Partial<StoryProject['meta']>) => void;
  onSaveJson: () => void;
  onImportJson: (file: File) => void;
  onOpenProjectsHome: () => void;
  onOpenStorySettings: () => void;
  onNotify: (msg: string) => void;
}

export function ExportView({
  project,
  defaultStoryTheme,
  defaultStoryLayout,
  defaultStoryFont,
  defaultStoryFontSize,
  customThemes,
  onUpdateMeta,
  onSaveJson,
  onImportJson,
  onOpenProjectsHome,
  onOpenStorySettings,
  onNotify,
}: ExportViewProps) {
  const { language, t } = useI18n();
  const [compiling, setCompiling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const passages = Object.values(project.passages);
  const { totalWords, readingMinutes } = getProjectWordStats(project);
  const uploadedCount = project.assets.filter((a) => a.source === 'upload').length;
  const activeStoryTheme = project.meta.storyTheme || defaultStoryTheme;
  const activeStoryLayout =
    project.meta.storyLayout ||
    getDefaultLayoutForGenre(project.meta.genre) ||
    defaultStoryLayout;
  const activeStoryFont = project.meta.storyFont || defaultStoryFont;
  const activeStoryFontSize = project.meta.storyFontSize || defaultStoryFontSize;

  const activeLayoutInfo = getStoryLayoutOption(activeStoryLayout);
  const activeFontInfo = getStoryFontOption(activeStoryFont);
  const activeFontSizeInfo = getStoryFontSizeOption(activeStoryFontSize);
  const activeThemeInfo = getStudioThemeOption(
    activeStoryTheme,
    customThemes,
    project.meta.customStoryTheme
  );

  const handleExportHtml = async () => {
    setCompiling(true);
    try {
      const html = await compileStandaloneHtml(
        project,
        activeStoryTheme,
        activeStoryLayout,
        activeStoryFont,
        activeStoryFontSize,
        customThemes,
        project.meta.storyLanguage || language
      );
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const slug = (project.meta.title || 'otgtam-story')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug || 'story'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('Exported standalone playable HTML game.');
    } catch {
      onNotify('Failed to compile HTML export.');
    } finally {
      setCompiling(false);
    }
  };

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson(file);
      e.target.value = '';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {t.exportView.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {t.exportView.subtitle}
          </p>
        </div>

        {/* Project Details */}
        <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {t.exportView.metadataTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label
                htmlFor="meta-title"
                className="block text-xs text-[var(--text-muted)] mb-1.5"
              >
                {t.exportView.storyTitle}
              </label>
              <input
                id="meta-title"
                type="text"
                value={project.meta.title}
                onChange={(e) => onUpdateMeta({ title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="meta-author"
                className="block text-xs text-[var(--text-muted)] mb-1.5"
              >
                {t.exportView.authorName}
              </label>
              <input
                id="meta-author"
                type="text"
                value={project.meta.author}
                onChange={(e) => onUpdateMeta({ author: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="meta-subtitle"
                className="block text-xs text-[var(--text-muted)] mb-1.5"
              >
                {t.exportView.description}
              </label>
              <input
                id="meta-subtitle"
                type="text"
                value={project.meta.subtitle}
                onChange={(e) => onUpdateMeta({ subtitle: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="meta-genre"
                className="block text-xs text-[var(--text-muted)] mb-1.5"
              >
                {t.exportView.storyGenre}
              </label>
              <select
                id="meta-genre"
                value={project.meta.genre || 'rpg'}
                onChange={(e) =>
                  onUpdateMeta({ genre: e.target.value as StoryGenre })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                {GENRE_DEFINITIONS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {t.genres[g.id]?.name ?? g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="meta-start"
                className="block text-xs text-[var(--text-muted)] mb-1.5"
              >
                {t.exportView.startingPassage}
              </label>
              <select
                id="meta-start"
                value={project.meta.startPassageId}
                onChange={(e) => onUpdateMeta({ startPassageId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                {passages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Export Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <FileCode2 className="w-5 h-5 text-[var(--accent-primary)]" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {t.exportView.playableHtmlTitle}
                </h2>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {t.exportView.playableHtmlDesc}
              </p>
              <div className="pt-2 text-xs text-[var(--text-muted)] font-mono-tabular">
                {passages.length} {t.home.passagesUnit} · {totalWords.toLocaleString()} {t.sidebar.wordsUnit}
                {readingMinutes > 0 ? ` (~${readingMinutes} ${t.sidebar.minReadUnit})` : ''} ·{' '}
                {project.rpgConfig.stats.length} stats · {project.rpgConfig.items.length} items · {uploadedCount} assets
              </div>
              <div className="pt-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs">
                <span className="text-[var(--text-secondary)] truncate">
                  {t.storyLayouts[activeLayoutInfo.id]?.name ?? activeLayoutInfo.name} ·{' '}
                  {activeThemeInfo.isCustom
                    ? activeThemeInfo.name
                    : t.studioThemes[activeThemeInfo.id]?.name ?? activeThemeInfo.name}{' '}
                  · {activeFontInfo.name} ({activeFontSizeInfo.label})
                </span>
                <button
                  type="button"
                  onClick={onOpenStorySettings}
                  className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline font-medium shrink-0"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>{t.nav.storySettings}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportHtml}
              disabled={compiling}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--accent-contrast)] text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>
                {compiling ? t.exportView.compilingHtml : t.exportView.downloadPlayableHtml}
              </span>
            </button>
          </section>

          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <Save className="w-5 h-5 text-sky-400" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {t.exportView.jsonArchiveTitle}
                </h2>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {t.exportView.jsonArchiveDesc}
              </p>
              <div className="pt-2 text-xs text-[var(--text-muted)]">
                {t.exportView.jsonArchiveNote}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onSaveJson}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-sm font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
              >
                <Save className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{t.exportView.exportJson}</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-sm font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
              >
                <FolderOpen className="w-4 h-4 text-[var(--text-muted)]" />
                <span>{t.exportView.importJson}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
          </section>
        </div>

        {/* Multi-project Library Link */}
        <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t.exportView.createAnotherTitle}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {t.exportView.createAnotherDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenProjectsHome}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{t.exportView.openProjectsPicker}</span>
          </button>
        </section>
      </div>
    </div>
  );
}
