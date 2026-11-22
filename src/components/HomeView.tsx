import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Cpu,
  FilePlus2,
  FolderOpen,
  Globe,
  HardDrive,
  Heart,
  Layout,
  Palette,
  Play,
  Plus,
  Search,
  Settings2,
  Skull,
  Smartphone,
  Swords,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { GENRE_DEFINITIONS, getGenreDefinition } from '../data/genreTemplates';
import {
  buildCustomStoryTheme,
  getAllStoryThemes,
  getDefaultLayoutForGenre,
  getStoryFontOption,
  getStoryFontSizeOption,
  getStoryLayoutOption,
  getStudioThemeOption,
  STORY_FONTS,
  STORY_FONT_SIZES,
  STORY_LAYOUTS,
  STUDIO_THEMES,
} from '../data/themes';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { useI18n } from '../i18n/LanguageContext';
import { LANGUAGE_OPTIONS } from '../i18n/translations';
import {
  estimateStorageUsage,
  formatBytes,
  StorageEstimateInfo,
} from '../storage/projectStorage';
import {
  AppLanguage,
  CustomStoryTheme,
  StoryFontId,
  StoryFontSizeId,
  StoryGenre,
  StoryLayoutId,
  StoryProject,
  StudioSettings,
  StudioThemeId,
} from '../types/story';
import { PWAInstallButton } from './PWAInstallButton';

export type HomeSubPage = 'landing' | 'new' | 'continue' | 'settings';

interface CreateStoryInput {
  genre: StoryGenre;
  title?: string;
  author?: string;
  subtitle?: string;
  storyTheme?: StudioThemeId;
  customStoryTheme?: CustomStoryTheme;
  storyLayout?: StoryLayoutId;
  storyFont?: StoryFontId;
  storyFontSize?: StoryFontSizeId;
}

interface HomeViewProps {
  projects: StoryProject[];
  activeProjectId: string;
  settings: StudioSettings;
  onUpdateSettings: (patch: Partial<StudioSettings>) => void;
  onCreateCustomTheme: (theme: CustomStoryTheme) => void;
  onDeleteCustomTheme: (themeId: string) => void;
  onCreateFromGenre: (input: CreateStoryInput) => void;
  onOpenProject: (projectId: string) => void;
  onPlayProject: (projectId: string) => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onExportJson: (project: StoryProject) => void;
  onImportJson: (file: File) => void;
}

const GENRE_ICONS: Record<StoryGenre, typeof Swords> = {
  rpg: Swords,
  mystery: Search,
  scifi: Cpu,
  horror: Skull,
  romance: Heart,
  interactive: BookOpen,
};

export function HomeView({
  projects,
  activeProjectId,
  settings,
  onUpdateSettings,
  onCreateCustomTheme,
  onDeleteCustomTheme,
  onCreateFromGenre,
  onOpenProject,
  onPlayProject,
  onDuplicateProject,
  onDeleteProject,
  onExportJson,
  onImportJson,
}: HomeViewProps) {
  const { language, setLanguage, t } = useI18n();
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS } = usePWAInstall();
  const [subPage, setSubPage] = useState<HomeSubPage>('landing');
  const [selectedGenre, setSelectedGenre] = useState<StoryGenre>('rpg');
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState(settings.defaultAuthor);
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newStoryTheme, setNewStoryTheme] = useState<StudioThemeId>(settings.storyTheme);
  const [newStoryLayout, setNewStoryLayout] = useState<StoryLayoutId>(
    settings.defaultStoryLayout || 'rpg-split'
  );
  const [newStoryFont, setNewStoryFont] = useState<StoryFontId>(
    settings.defaultStoryFont || 'serif-editorial'
  );
  const [newStoryFontSize, setNewStoryFontSize] = useState<StoryFontSizeId>(
    settings.defaultStoryFontSize || 'md'
  );
  const [showCustomThemeCreator, setShowCustomThemeCreator] = useState(false);
  const [customThemeName, setCustomThemeName] = useState('');
  const [customBgHex, setCustomBgHex] = useState('#101419');
  const [customSurfaceHex, setCustomSurfaceHex] = useState('#182028');
  const [customTextHex, setCustomTextHex] = useState('#F1F5F9');
  const [customAccentHex, setCustomAccentHex] = useState('#E11D48');
  const [projectQuery, setProjectQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allStoryThemes = getAllStoryThemes(settings.customStoryThemes || []);

  useEffect(() => {
    if (subPage !== 'settings') return;
    let active = true;
    estimateStorageUsage(projects).then((info) => {
      if (active) setStorageInfo(info);
    });
    return () => {
      active = false;
    };
  }, [subPage, projects]);

  useEffect(() => {
    setNewAuthor(settings.defaultAuthor);
  }, [settings.defaultAuthor]);

  useEffect(() => {
    setNewStoryTheme(settings.storyTheme);
  }, [settings.storyTheme]);

  useEffect(() => {
    setNewStoryFont(settings.defaultStoryFont || 'serif-editorial');
  }, [settings.defaultStoryFont]);

  useEffect(() => {
    setNewStoryFontSize(settings.defaultStoryFontSize || 'md');
  }, [settings.defaultStoryFontSize]);

  const handleSaveCustomTheme = (applyToNewProject = false) => {
    if (!customThemeName.trim()) return;
    const created = buildCustomStoryTheme({
      name: customThemeName,
      bg: customBgHex,
      surface: customSurfaceHex,
      text: customTextHex,
      accent: customAccentHex,
    });
    onCreateCustomTheme(created);
    if (applyToNewProject) {
      setNewStoryTheme(created.id);
    } else {
      onUpdateSettings({ storyTheme: created.id });
    }
    setCustomThemeName('');
    setShowCustomThemeCreator(false);
  };

  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  const filteredProjects = projects.filter((proj) => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return true;
    const genreName = (
      t.genres[proj.meta.genre]?.name || getGenreDefinition(proj.meta.genre).name
    ).toLowerCase();
    return (
      (proj.meta.title || '').toLowerCase().includes(q) ||
      (proj.meta.author || '').toLowerCase().includes(q) ||
      genreName.includes(q)
    );
  });

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson(file);
      e.target.value = '';
    }
  };

  // 1. Landing Screen: Three Buttons in One Row (No TopBar or Playtest button)
  if (subPage === 'landing') {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] flex flex-col px-6 py-8 lg:px-12">
        <div className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-end gap-2.5 pb-4">
          <PWAInstallButton variant="compact" />
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
            <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
            <label htmlFor="landing-language-select" className="text-xs text-[var(--text-muted)]">
              {t.common.languageLabel}:
            </label>
            <select
              id="landing-language-select"
              aria-label={t.home.interfaceLanguageTitle}
              value={language}
              onChange={(e) => setLanguage(e.target.value as AppLanguage)}
              className="bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option
                  key={opt.id}
                  value={opt.id}
                  className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                >
                  {opt.nativeName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="max-w-5xl w-full mx-auto space-y-10">
            <div className="text-center space-y-2.5">
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-[var(--text-primary)]">
                OTGTAM
              </h1>
              <p className="text-sm lg:text-base text-[var(--text-muted)] max-w-xl mx-auto">
                {t.home.heroSubtitle}
              </p>
            </div>

            {/* Three Grids in One Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                type="button"
                onClick={() => {
                  setSelectedGenre('rpg');
                  setNewTitle('');
                  setNewAuthor(settings.defaultAuthor);
                  setNewSubtitle('');
                  setNewStoryTheme(settings.storyTheme);
                  setNewStoryLayout(settings.defaultStoryLayout || 'rpg-split');
                  setNewStoryFont(settings.defaultStoryFont || 'serif-editorial');
                  setNewStoryFontSize(settings.defaultStoryFontSize || 'md');
                  setSubPage('new');
                }}
                className="group text-left rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] p-7 flex flex-col justify-between gap-8 transition-colors"
              >
                <div className="space-y-4">
                  <div className="w-11 h-11 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent-primary)]">
                    <FilePlus2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                      {t.home.newProject}
                    </h2>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      {t.home.newProjectDesc}
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-primary)]">
                  <span>{t.home.startCreating}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSubPage('continue')}
                className="group text-left rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] p-7 flex flex-col justify-between gap-8 transition-colors"
              >
                <div className="space-y-4">
                  <div className="w-11 h-11 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent-primary)]">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                      {t.home.continueProject}
                    </h2>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      {activeProject
                        ? `${activeProject.meta.title} (${projects.length})`
                        : t.home.continueProjectDescFallback}
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-primary)]">
                  <span>
                    {t.home.openProjects} ({projects.length})
                  </span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSubPage('settings')}
                className="group text-left rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] p-7 flex flex-col justify-between gap-8 transition-colors"
              >
                <div className="space-y-4">
                  <div className="w-11 h-11 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent-primary)]">
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                      {t.home.settings}
                    </h2>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      {t.home.settingsDesc}
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-primary)]">
                  <span>{t.home.customizeStudio}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Shared Back Header for Home Sub-Pages (still no workspace tabs or Playtest button)
  const renderSubPageHeader = (title: string, subtitle: string) => (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setSubPage('landing')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t.home.backToHome}</span>
        </button>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          {title}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>
      </div>
      <span className="text-sm font-bold tracking-tight text-[var(--text-muted)]">
        OTGTAM
      </span>
    </div>
  );

  // 2. New Project Page (Genre + All Story Details)
  if (subPage === 'new') {
    const activeGenreDef = getGenreDefinition(selectedGenre);
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] px-6 py-8 lg:px-10 lg:py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          {renderSubPageHeader(t.home.newProject, t.home.newProjectSubtitle)}

          {/* Step 1: Genre Picker */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {t.home.step1Genre}
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                {t.home.step1Hint}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {GENRE_DEFINITIONS.map((genre) => {
                const Icon = GENRE_ICONS[genre.id];
                const isChosen = selectedGenre === genre.id;
                const gCopy = t.genres[genre.id];
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => {
                      setSelectedGenre(genre.id);
                      setNewStoryLayout(getDefaultLayoutForGenre(genre.id));
                    }}
                    className={`text-left rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                      isChosen
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {gCopy.name}
                          </span>
                        </div>
                        {isChosen && (
                          <Check className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {gCopy.tagline}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      {gCopy.defaultSystemSummary}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 2: Story Details Form */}
          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-5">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {t.home.step2Details}
              </h2>
              <span className="text-xs text-[var(--accent-primary)] font-medium">
                {t.genres[selectedGenre].name}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="new-story-title"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
                >
                  {t.home.storyTitle}
                </label>
                <input
                  id="new-story-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t.genres[selectedGenre].titlePlaceholder}
                  className="w-full px-3.5 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label
                  htmlFor="new-story-author"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
                >
                  {t.home.authorName}
                </label>
                <input
                  id="new-story-author"
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder={t.home.authorPlaceholder}
                  className="w-full px-3.5 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="new-story-subtitle"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
                >
                  {t.home.storySynopsis}
                </label>
                <textarea
                  id="new-story-subtitle"
                  rows={3}
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  placeholder={t.genres[selectedGenre].tagline}
                  className="w-full px-3.5 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] resize-y"
                />
              </div>

              <div className="md:col-span-2 space-y-2.5 pt-2 border-t border-[var(--border-hairline)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {t.home.storyLayoutLabel}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t.home.storyLayoutHint}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {STORY_LAYOUTS.map((layout) => {
                    const selected = newStoryLayout === layout.id;
                    const lCopy = t.storyLayouts[layout.id];
                    return (
                      <button
                        key={layout.id}
                        type="button"
                        onClick={() => setNewStoryLayout(layout.id)}
                        className={`text-left rounded-lg border px-3 py-2.5 flex flex-col justify-between gap-1.5 transition-colors ${
                          selected
                            ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {lCopy.name}
                          </span>
                          {selected && (
                            <Check className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] line-clamp-2">
                          {lCopy.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {t.home.storyFontLabel}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t.home.storyFontHint}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {STORY_FONTS.map((font) => {
                    const selected = newStoryFont === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => setNewStoryFont(font.id)}
                        className={`text-left rounded-lg border px-3 py-2 space-y-0.5 transition-colors ${
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

              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {t.home.storyFontSizeLabel}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t.home.storyFontSizeHint}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {STORY_FONT_SIZES.map((sz) => {
                    const selected = newStoryFontSize === sz.id;
                    return (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => setNewStoryFontSize(sz.id)}
                        className={`text-left rounded-lg border px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
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
                          <Check className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-2 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {t.home.storyPaletteLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCustomThemeCreator((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-primary)] hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.home.newCustomTheme}</span>
                  </button>
                </div>

                {showCustomThemeCreator && (
                  <div className="rounded-lg border border-[var(--accent-primary)]/40 bg-[var(--bg-canvas)] p-3.5 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                      <div className="sm:col-span-2 lg:col-span-1">
                        <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                          {t.home.themeNamePlaceholder}
                        </label>
                        <input
                          type="text"
                          value={customThemeName}
                          onChange={(e) => setCustomThemeName(e.target.value)}
                          placeholder={t.home.customThemeNamePlaceholder}
                          className="w-full px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                          {t.home.bgLabel}
                        </label>
                        <input
                          type="color"
                          value={customBgHex}
                          onChange={(e) => setCustomBgHex(e.target.value)}
                          className="w-full h-8 rounded cursor-pointer bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-0.5"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                          {t.home.surfaceLabel}
                        </label>
                        <input
                          type="color"
                          value={customSurfaceHex}
                          onChange={(e) => setCustomSurfaceHex(e.target.value)}
                          className="w-full h-8 rounded cursor-pointer bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-0.5"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                          {t.home.textLabel}
                        </label>
                        <input
                          type="color"
                          value={customTextHex}
                          onChange={(e) => setCustomTextHex(e.target.value)}
                          className="w-full h-8 rounded cursor-pointer bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-0.5"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                          {t.home.accentLabel}
                        </label>
                        <input
                          type="color"
                          value={customAccentHex}
                          onChange={(e) => setCustomAccentHex(e.target.value)}
                          className="w-full h-8 rounded cursor-pointer bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-0.5"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCustomThemeCreator(false)}
                        className="px-2.5 py-1 rounded bg-[var(--bg-elevated)] text-[11px] text-[var(--text-muted)]"
                      >
                        {t.common.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveCustomTheme(true)}
                        disabled={!customThemeName.trim()}
                        className="px-3 py-1 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-[var(--accent-contrast)] text-[11px] font-semibold"
                      >
                        {t.home.saveTheme}
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {allStoryThemes.map((theme) => {
                    const selected = newStoryTheme === theme.id;
                    const themeLabel = theme.isCustom
                      ? theme.name
                      : t.studioThemes[theme.id]?.name || theme.name;
                    return (
                      <div
                        key={theme.id}
                        className={`rounded-lg border px-3 py-2 flex flex-col justify-between gap-2 transition-colors ${
                          selected
                            ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => setNewStoryTheme(theme.id)}
                            className="flex-1 min-w-0 text-left text-xs font-semibold text-[var(--text-primary)] truncate"
                          >
                            {themeLabel}
                          </button>
                          {theme.isCustom && (
                            <button
                              type="button"
                              onClick={() => onDeleteCustomTheme(theme.id)}
                              title={`${t.common.delete} "${theme.name}"`}
                              className="p-0.5 text-[var(--text-muted)] hover:text-red-400 shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewStoryTheme(theme.id)}
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
            </div>

            <div className="pt-3 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors"
              >
                <FolderOpen className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{t.home.importJsonProject}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => {
                  const chosen = allStoryThemes.find((th) => th.id === newStoryTheme);
                  onCreateFromGenre({
                    genre: selectedGenre,
                    title: newTitle,
                    author: newAuthor,
                    subtitle: newSubtitle,
                    storyTheme: newStoryTheme,
                    customStoryTheme: chosen?.isCustom
                      ? (chosen as CustomStoryTheme)
                      : undefined,
                    storyLayout: newStoryLayout,
                    storyFont: newStoryFont,
                    storyFontSize: newStoryFontSize,
                  });
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {t.home.createProjectPrefix} ({t.genres[selectedGenre].name})
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // 3. Continue Project Page (Saved Library & Resume)
  if (subPage === 'continue') {
    return (
      <div className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] px-6 py-8 lg:px-10 lg:py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          {renderSubPageHeader(t.home.continueProject, t.home.continueSubtitle)}

          {/* Active Project Spotlight */}
          {activeProject && (
            <section className="rounded-xl border border-[var(--accent-primary)]/60 bg-[var(--bg-surface)] p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="text-xs font-semibold text-[var(--accent-primary)]">
                  {t.home.lastActiveProject}
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] truncate">
                  {activeProject.meta.title}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {t.genres[activeProject.meta.genre]?.name ||
                    getGenreDefinition(activeProject.meta.genre).name}{' '}
                  ·{' '}
                  <span className="font-mono-tabular">
                    {Object.keys(activeProject.passages).length} {t.home.passagesUnit}
                  </span>{' '}
                  · {t.home.byLabel} {activeProject.meta.author || t.home.authorPlaceholder}
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onPlayProject(activeProject.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)]"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-emerald-500" />
                  <span>{t.common.play}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenProject(activeProject.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-xs font-semibold"
                >
                  <span>{t.home.resumeInEditor}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </section>
          )}

          {/* Search & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={projectQuery}
                onChange={(e) => setProjectQuery(e.target.value)}
                placeholder={t.home.searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)]"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{t.home.importJson}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => setSubPage('new')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--accent-primary)]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.home.newProject}</span>
              </button>
            </div>
          </div>

          {/* Project Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map((proj) => {
              const genreDef = getGenreDefinition(proj.meta.genre);
              const passageCount = Object.keys(proj.passages).length;
              const updatedDate = proj.updatedAt
                ? new Date(proj.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent';

              return (
                <div
                  key={proj.id}
                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">
                        {proj.meta.title || t.genres[proj.meta.genre]?.titlePlaceholder}
                      </h3>
                      <span className="text-[11px] text-[var(--accent-primary)] shrink-0">
                        {t.genres[proj.meta.genre]?.name || genreDef.name}
                      </span>
                    </div>
                    {proj.meta.subtitle && (
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                        {proj.meta.subtitle}
                      </p>
                    )}
                    <div className="text-[11px] text-[var(--text-muted)] flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="font-mono-tabular">
                        {passageCount} {t.home.passagesUnit}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {
                          t.storyLayouts[
                            proj.meta.storyLayout || getDefaultLayoutForGenre(proj.meta.genre)
                          ]?.name ||
                          getStoryLayoutOption(
                            proj.meta.storyLayout || getDefaultLayoutForGenre(proj.meta.genre)
                          ).name
                        }
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {getStoryFontOption(proj.meta.storyFont || settings.defaultStoryFont).name}{' '}
                        ({getStoryFontSizeOption(proj.meta.storyFontSize || settings.defaultStoryFontSize).label})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {(() => {
                          const opt = getStudioThemeOption(
                            proj.meta.storyTheme || settings.storyTheme,
                            settings.customStoryThemes || [],
                            proj.meta.customStoryTheme
                          );
                          return opt.isCustom
                            ? opt.name
                            : t.studioThemes[opt.id]?.name || opt.name;
                        })()}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.home.updatedLabel} {updatedDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-hairline)]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenProject(proj.id)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-xs font-semibold"
                      >
                        {t.common.open}
                      </button>
                      <button
                        type="button"
                        onClick={() => onPlayProject(proj.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)]"
                      >
                        <Play className="w-3 h-3 fill-current text-emerald-500" />
                        <span>{t.common.play}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onDuplicateProject(proj.id)}
                        title={t.home.duplicateProject}
                        className="p-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onExportJson(proj)}
                        title={t.home.exportJsonBackup}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        JSON
                      </button>
                      {confirmDeleteId === proj.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteProject(proj.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold"
                          >
                            {t.common.delete}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)] text-xs"
                          >
                            {t.common.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(proj.id)}
                          disabled={projects.length <= 1}
                          title={t.home.deleteProject}
                          className="p-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-red-500/20 border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-red-400 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 4. Settings Page (Language, Color Themes & Studio Preferences)
  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] px-6 py-8 lg:px-10 lg:py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {renderSubPageHeader(t.home.settings, t.home.settingsSubtitle)}

        {/* Interface Language Section */}
        <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {t.home.interfaceLanguageTitle}
                </h2>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {t.home.interfaceLanguageDesc}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {LANGUAGE_OPTIONS.map((opt) => {
                const active = language === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLanguage(opt.id)}
                    className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    {opt.nativeName}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Story Maker Software Theme */}
          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="border-b border-[var(--border-hairline)] pb-3 space-y-1">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {t.home.softwareThemeTitle}
                </h2>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {t.home.softwareThemeDesc}
              </p>
            </div>

            <div className="space-y-2.5">
              {STUDIO_THEMES.map((theme) => {
                const active = settings.theme === theme.id;
                const thCopy = t.studioThemes[theme.id];
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onUpdateSettings({ theme: theme.id })}
                    className={`w-full text-left rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {thCopy?.name || theme.name}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] line-clamp-1">
                        {thCopy?.description || theme.description}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {theme.swatches.map((hex, i) => (
                        <span
                          key={i}
                          style={{ backgroundColor: hex }}
                          className="w-3.5 h-3.5 rounded-full border border-white/20"
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Default Story Interface (Playtest & HTML) */}
          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="border-b border-[var(--border-hairline)] pb-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layout className="w-4 h-4 text-[var(--accent-primary)]" />
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    {t.home.defaultInterfaceTitle}
                  </h2>
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {t.home.defaultInterfaceDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label
                  htmlFor="settings-default-layout"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  {t.home.defaultReaderLayout}
                </label>
                <select
                  id="settings-default-layout"
                  value={settings.defaultStoryLayout || 'rpg-split'}
                  onChange={(e) =>
                    onUpdateSettings({
                      defaultStoryLayout: e.target.value as StoryLayoutId,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  {STORY_LAYOUTS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {t.storyLayouts[l.id].name} ({t.storyLayouts[l.id].bestFor})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="settings-default-font"
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  <Type className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{t.home.defaultStoryFont}</span>
                </label>
                <select
                  id="settings-default-font"
                  value={settings.defaultStoryFont || 'serif-editorial'}
                  onChange={(e) =>
                    onUpdateSettings({
                      defaultStoryFont: e.target.value as StoryFontId,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  {STORY_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} — {t.storyFonts[f.id].description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="settings-default-font-size"
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  <Type className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{t.home.defaultStoryFontSize}</span>
                </label>
                <select
                  id="settings-default-font-size"
                  value={settings.defaultStoryFontSize || 'md'}
                  onChange={(e) =>
                    onUpdateSettings({
                      defaultStoryFontSize: e.target.value as StoryFontSizeId,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  {STORY_FONT_SIZES.map((sz) => (
                    <option key={sz.id} value={sz.id}>
                      {t.storyFontSizes[sz.id].name} ({sz.label})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Story Theme Creator */}
            <div className="pt-2 border-t border-[var(--border-hairline)] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  {t.home.storyThemesTitle}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomThemeCreator((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-primary)] hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t.home.newCustomTheme}</span>
                </button>
              </div>

              {showCustomThemeCreator && (
                <div className="rounded-lg border border-[var(--accent-primary)]/40 bg-[var(--bg-canvas)] p-3 space-y-2.5 text-xs">
                  <input
                    type="text"
                    value={customThemeName}
                    onChange={(e) => setCustomThemeName(e.target.value)}
                    placeholder={t.home.customThemeNamePlaceholder}
                    className="w-full px-2.5 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                      <span>{t.home.bgLabel}</span>
                      <input
                        type="color"
                        value={customBgHex}
                        onChange={(e) => setCustomBgHex(e.target.value)}
                        className="w-9 h-6 rounded cursor-pointer bg-transparent border border-[var(--border-hairline)]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                      <span>{t.home.surfaceLabel}</span>
                      <input
                        type="color"
                        value={customSurfaceHex}
                        onChange={(e) => setCustomSurfaceHex(e.target.value)}
                        className="w-9 h-6 rounded cursor-pointer bg-transparent border border-[var(--border-hairline)]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                      <span>{t.home.textLabel}</span>
                      <input
                        type="color"
                        value={customTextHex}
                        onChange={(e) => setCustomTextHex(e.target.value)}
                        className="w-9 h-6 rounded cursor-pointer bg-transparent border border-[var(--border-hairline)]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                      <span>{t.home.accentLabel}</span>
                      <input
                        type="color"
                        value={customAccentHex}
                        onChange={(e) => setCustomAccentHex(e.target.value)}
                        className="w-9 h-6 rounded cursor-pointer bg-transparent border border-[var(--border-hairline)]"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowCustomThemeCreator(false)}
                      className="px-2.5 py-1 rounded bg-[var(--bg-elevated)] text-[11px] text-[var(--text-muted)]"
                    >
                      {t.common.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveCustomTheme(false)}
                      disabled={!customThemeName.trim()}
                      className="px-2.5 py-1 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-[var(--accent-contrast)] text-[11px] font-semibold"
                    >
                      {t.home.saveTheme}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                {allStoryThemes.map((theme) => {
                  const active = settings.storyTheme === theme.id;
                  const thCopy = theme.isCustom ? null : t.studioThemes[theme.id];
                  return (
                    <div
                      key={theme.id}
                      className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                        active
                          ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ storyTheme: theme.id })}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {thCopy?.name || theme.name}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] line-clamp-1">
                          {thCopy?.description || theme.description}
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {theme.swatches.map((hex, i) => (
                          <span
                            key={i}
                            style={{ backgroundColor: hex }}
                            className="w-3 h-3 rounded-full border border-white/20"
                          />
                        ))}
                        {theme.isCustom && (
                          <button
                            type="button"
                            onClick={() => onDeleteCustomTheme(theme.id)}
                            title={`${t.common.delete}: ${theme.name}`}
                            className="ml-1 p-1 rounded text-[var(--text-muted)] hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Studio Preferences */}
          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-5">
            <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-3">
              <Settings2 className="w-4 h-4 text-[var(--accent-primary)]" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {t.home.editorAudioTitle}
              </h2>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {t.home.autoSnapNodes}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {t.home.autoSnapDesc}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    defaultSnapToGrid: !settings.defaultSnapToGrid,
                  })
                }
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                  settings.defaultSnapToGrid
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-500'
                    : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-muted)]'
                }`}
              >
                {settings.defaultSnapToGrid ? t.common.enabled : t.common.disabled}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--border-hairline)]">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {t.home.autoCompressImages}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {t.home.autoCompressImagesDesc}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    autoCompressImages: !(settings.autoCompressImages ?? true),
                  })
                }
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                  (settings.autoCompressImages ?? true)
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-500'
                    : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-muted)]'
                }`}
              >
                {(settings.autoCompressImages ?? true) ? t.common.enabled : t.common.disabled}
              </button>
            </div>

            <div className="space-y-2 pt-3 border-t border-[var(--border-hairline)]">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[var(--text-primary)]">
                  {t.home.masterVolume}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ muted: !settings.muted })}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {settings.muted ? (
                    <>
                      <VolumeX className="w-4 h-4" />
                      <span>{t.home.muted}</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      <span className="font-mono-tabular">
                        {Math.round(settings.masterVolume * 100)}%
                      </span>
                    </>
                  )}
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.muted ? 0 : settings.masterVolume}
                onChange={(e) =>
                  onUpdateSettings({
                    masterVolume: Number(e.target.value),
                    muted: Number(e.target.value) === 0,
                  })
                }
                aria-label={t.home.masterVolume}
                className="w-full accent-[var(--accent-primary)]"
              />
            </div>

            <div className="pt-3 border-t border-[var(--border-hairline)]">
              <label
                htmlFor="settings-default-author"
                className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
              >
                {t.home.defaultAuthorName}
              </label>
              <input
                id="settings-default-author"
                type="text"
                value={settings.defaultAuthor}
                onChange={(e) => onUpdateSettings({ defaultAuthor: e.target.value })}
                placeholder={t.home.authorPlaceholder}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
          </section>
        </div>

        {/* IndexedDB Storage & Quota Safety Indicator */}
        <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {t.home.storageTitle}
                </h2>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {t.home.storageDesc}
              </p>
            </div>
            <span className="text-xs font-mono-tabular px-2.5 py-1 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-secondary)]">
              {storageInfo?.backend === 'indexeddb' ? 'IndexedDB' : 'localStorage'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 space-y-1">
              <div className="text-[var(--text-muted)]">{t.home.librarySize}</div>
              <div className="text-base font-semibold font-mono-tabular text-[var(--text-primary)]">
                {storageInfo ? formatBytes(storageInfo.libraryBytes) : '—'}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 space-y-1">
              <div className="text-[var(--text-muted)]">{t.home.storageEngine}</div>
              <div className="text-base font-semibold text-emerald-400">
                {storageInfo?.backend === 'indexeddb' ? 'IndexedDB' : 'localStorage'}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Auto-sync enabled
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-muted)]">{t.home.browserQuotaUsed}</span>
                <span className="font-mono-tabular text-[var(--text-primary)] font-medium">
                  {storageInfo && storageInfo.usageBytes !== null && storageInfo.quotaBytes
                    ? `${formatBytes(storageInfo.usageBytes)} / ${formatBytes(storageInfo.quotaBytes)}`
                    : '—'}
                </span>
              </div>
              {storageInfo && storageInfo.usageBytes !== null && storageInfo.quotaBytes ? (
                <div className="w-full h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden border border-[var(--border-hairline)]">
                  <div
                    className="h-full bg-[var(--accent-primary)] transition-transform origin-left"
                    style={{
                      transform: `scaleX(${Math.max(
                        0.02,
                        Math.min(1, storageInfo.usageBytes / storageInfo.quotaBytes)
                      )})`,
                    }}
                  />
                </div>
              ) : (
                <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
                  Quota API unavailable
                </div>
              )}
            </div>
          </div>
        </section>

        {/* App Installation & Offline Mode */}
        <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {t.pwa.settingsTitle}
                </h2>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {t.pwa.settingsDesc}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border ${
                  isOnline
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                }`}
              >
                {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span>{isOnline ? t.pwa.statusOnline : t.pwa.statusOffline}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 text-xs">
              <div className="font-semibold text-[var(--text-primary)]">
                {isInstalled
                  ? t.pwa.statusInstalled
                  : isInstallable
                    ? t.pwa.statusInstallable
                    : t.pwa.statusOfflineReady}
              </div>
              {!isInstalled && !isInstallable && !isIOS && (
                <p className="text-[var(--text-muted)] max-w-xl">
                  {t.pwa.manualInstallHint}
                </p>
              )}
            </div>
            <PWAInstallButton variant="primary" />
          </div>
        </section>
      </div>
    </div>
  );
}
