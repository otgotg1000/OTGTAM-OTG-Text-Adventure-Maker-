import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Compass,
  FolderOpen,
  PanelLeftClose,
  Plus,
  Save,
  Search,
} from 'lucide-react';
import { ChangeEvent, useRef, useState } from 'react';
import { getGenreDefinition } from '../data/genreTemplates';
import { getNodeColorMeta } from '../data/nodeColors';
import { getProjectWordStats } from '../engine/textStats';
import { useI18n } from '../i18n/LanguageContext';
import { Passage, StoryProject } from '../types/story';

interface WorldSidebarProps {
  project: StoryProject;
  selectedPassageId: string | null;
  onSelectPassage: (id: string) => void;
  onCreatePassage: () => void;
  onSaveJson: () => void;
  onImportJson: (file: File) => void;
  onUpdateTitle: (title: string) => void;
  onBackToProjects: () => void;
  onCollapse: () => void;
}

export function WorldSidebar({
  project,
  selectedPassageId,
  onSelectPassage,
  onCreatePassage,
  onSaveJson,
  onImportJson,
  onUpdateTitle,
  onBackToProjects,
  onCollapse,
}: WorldSidebarProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const genreDef = getGenreDefinition(project.meta.genre);
  const { totalWords, readingMinutes } = getProjectWordStats(project);
  const rawPassages = Object.values(project.passages);
  const indexed = rawPassages.map((p, idx) => ({ p, idx }));
  indexed.sort((a, b) => {
    const tA = a.p.createdAt ?? a.idx;
    const tB = b.p.createdAt ?? b.idx;
    if (tA !== tB) {
      return sortOrder === 'oldest' ? tA - tB : tB - tA;
    }
    return sortOrder === 'oldest' ? a.idx - b.idx : b.idx - a.idx;
  });
  const passages = indexed.map((entry) => entry.p);

  const filtered = passages.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.body.toLowerCase().includes(q)
    );
  });

  const hasBrokenLink = (p: Passage): boolean => {
    const ids = new Set(Object.keys(project.passages));
    if (p.choices.some((c) => c.targetPassageId && !ids.has(c.targetPassageId))) return true;
    if (
      p.skillCheck &&
      ((p.skillCheck.successPassageId && !ids.has(p.skillCheck.successPassageId)) ||
        (p.skillCheck.failurePassageId && !ids.has(p.skillCheck.failurePassageId)))
    ) {
      return true;
    }
    if (
      p.combat &&
      ((p.combat.victoryPassageId && !ids.has(p.combat.victoryPassageId)) ||
        (p.combat.defeatPassageId && !ids.has(p.combat.defeatPassageId)))
    ) {
      return true;
    }
    return false;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson(file);
      e.target.value = '';
    }
  };

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col h-full select-none">
      {/* Project Header */}
      <div className="p-4 border-b border-[var(--border-hairline)] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToProjects}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.sidebar.allProjects}</span>
          </button>

          <button
            type="button"
            onClick={onCollapse}
            title={t.sidebar.collapseSidebar}
            aria-label={t.sidebar.collapseSidebar}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label
              htmlFor="sidebar-story-title"
              className="text-xs font-medium text-[var(--text-muted)]"
            >
              {t.sidebar.projectTitle}
            </label>
            <span className="text-[11px] text-[var(--accent-primary)] truncate">
              {genreDef.name}
            </span>
          </div>
          <input
            id="sidebar-story-title"
            type="text"
            value={project.meta.title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-sm font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveJson}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{t.sidebar.saveJson}</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>{t.sidebar.import}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Passages Directory Header */}
      <div className="px-4 pt-4 pb-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {t.sidebar.passages} ({passages.length})
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'oldest' ? 'newest' : 'oldest'))}
              title={sortOrder === 'oldest' ? t.sidebar.oldest : t.sidebar.newest}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[11px] font-medium text-[var(--text-secondary)] transition-colors whitespace-nowrap"
            >
              <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
              <span>{sortOrder === 'oldest' ? t.sidebar.oldest : t.sidebar.newest}</span>
            </button>
            <button
              type="button"
              onClick={onCreatePassage}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--accent-primary)] transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.common.add}</span>
            </button>
          </div>
        </div>
        <div className="text-[11px] font-mono-tabular text-[var(--text-muted)]">
          {totalWords.toLocaleString()} {t.sidebar.wordsUnit}
          {readingMinutes > 0 ? ` · ~${readingMinutes} ${t.sidebar.minReadUnit}` : ''}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.sidebar.filterPlaceholder}
            className="w-full pl-8 pr-2.5 py-1.5 rounded-md bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>
      </div>

      {/* Passage List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
            {t.sidebar.noMatchingPassages}
          </div>
        ) : (
          filtered.map((p) => {
            const isSelected = p.id === selectedPassageId;
            const isStart = p.id === project.meta.startPassageId;
            const broken = hasBrokenLink(p);
            const colorMeta = getNodeColorMeta(p.color, project.customColors);
            const count =
              p.choices.length + (p.skillCheck ? 2 : 0) + (p.combat ? 2 : 0);

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPassage(p.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-[var(--bg-elevated)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'bg-transparent border-transparent hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.color && p.color !== 'none' && (
                      <span
                        style={colorMeta.isCustom ? { backgroundColor: colorMeta.hex } : undefined}
                        className={`w-2 h-2 rounded-full shrink-0 ${colorMeta.swatchClass}`}
                      />
                    )}
                    <span className="text-sm font-medium truncate">
                      {p.title || t.sidebar.untitledPassage}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isStart && (
                      <Compass
                        className="w-3.5 h-3.5 text-[var(--accent-primary)]"
                        aria-label={t.canvas.startTag}
                      />
                    )}
                    {broken && (
                      <AlertTriangle
                        className="w-3.5 h-3.5 text-red-500"
                        aria-label={t.canvas.issueBrokenLink}
                      />
                    )}
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)] truncate">
                  <span className="font-mono-tabular">
                    {count} {t.sidebar.linksUnit}
                  </span>
                  {p.color && p.color !== 'none' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span
                        style={colorMeta.isCustom ? { color: colorMeta.hex } : undefined}
                        className={colorMeta.textClass}
                      >
                        {colorMeta.label}
                      </span>
                    </>
                  )}
                  {p.tags.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{p.tags.join(', ')}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
