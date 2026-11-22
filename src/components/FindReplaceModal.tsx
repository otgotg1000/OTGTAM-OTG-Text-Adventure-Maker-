import { ArrowRight, Replace, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { Passage, StoryProject } from '../types/story';

interface FindReplaceModalProps {
  project: StoryProject;
  onSelectPassage: (id: string) => void;
  onReplaceInPassage: (
    passageId: string,
    find: string,
    replace: string,
    matchCase: boolean
  ) => number;
  onReplaceAll: (
    find: string,
    replace: string,
    matchCase: boolean
  ) => number;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(
  text: string,
  find: string,
  matchCase: boolean
): number {
  if (!find || !text) return 0;
  const regex = new RegExp(escapeRegExp(find), matchCase ? 'g' : 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function getSnippet(
  passage: Passage,
  find: string,
  matchCase: boolean
): string {
  const haystacks = [
    passage.body,
    passage.title,
    ...passage.choices.map((c) => c.label),
  ];
  const needle = matchCase ? find : find.toLowerCase();

  for (const h of haystacks) {
    if (!h) continue;
    const source = matchCase ? h : h.toLowerCase();
    const idx = source.indexOf(needle);
    if (idx !== -1) {
      const start = Math.max(0, idx - 32);
      const end = Math.min(h.length, idx + find.length + 48);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < h.length ? '...' : '';
      return `${prefix}${h.slice(start, end).replace(/\s+/g, ' ')}${suffix}`;
    }
  }
  return '';
}

function HighlightedText({
  text,
  find,
  matchCase,
}: {
  text: string;
  find: string;
  matchCase: boolean;
}) {
  if (!find) return <>{text}</>;
  const regex = new RegExp(`(${escapeRegExp(find)})`, matchCase ? 'g' : 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, idx) => {
        const isMatch = matchCase
          ? part === find
          : part.toLowerCase() === find.toLowerCase();
        return isMatch ? (
          <mark
            key={idx}
            className="bg-amber-500/30 text-amber-200 rounded px-0.5 font-semibold"
          >
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        );
      })}
    </>
  );
}

export function FindReplaceModal({
  project,
  onSelectPassage,
  onReplaceInPassage,
  onReplaceAll,
  onClose,
  onNotify,
}: FindReplaceModalProps) {
  const { t } = useI18n();
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    findInputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const matches = useMemo(() => {
    const q = findQuery;
    if (!q) return [];
    const results: Array<{
      passage: Passage;
      count: number;
      snippet: string;
    }> = [];
    for (const p of Object.values(project.passages)) {
      const count =
        countOccurrences(p.title, q, matchCase) +
        countOccurrences(p.body, q, matchCase) +
        p.choices.reduce(
          (sum, c) => sum + countOccurrences(c.label, q, matchCase),
          0
        );
      if (count > 0) {
        results.push({
          passage: p,
          count,
          snippet: getSnippet(p, q, matchCase),
        });
      }
    }
    return results;
  }, [project.passages, findQuery, matchCase]);

  const totalMatches = useMemo(
    () => matches.reduce((sum, item) => sum + item.count, 0),
    [matches]
  );

  const handleReplacePassage = (passageId: string) => {
    if (!findQuery) return;
    const replaced = onReplaceInPassage(
      passageId,
      findQuery,
      replaceQuery,
      matchCase
    );
    if (replaced > 0) {
      onNotify(`${t.canvas.replacedCount} ${replaced}`);
    }
  };

  const handleReplaceAll = () => {
    if (!findQuery || totalMatches === 0) return;
    const replaced = onReplaceAll(findQuery, replaceQuery, matchCase);
    if (replaced > 0) {
      onNotify(`${t.canvas.replacedCount} ${replaced}`);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.canvas.findReplace}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/55 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden flex flex-col max-h-[78vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border-hairline)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Search className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>{t.canvas.findReplace}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="p-1.5 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="p-4 border-b border-[var(--border-hairline)] space-y-3 bg-[var(--bg-canvas)]/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={findInputRef}
                type="text"
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                placeholder={t.canvas.findPlaceholder}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="relative">
              <Replace className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder={t.canvas.replacePlaceholder}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="rounded border-[var(--border-hairline)] accent-[var(--accent-primary)]"
              />
              <span>{t.canvas.matchCase}</span>
            </label>

            <div className="flex items-center gap-3">
              {findQuery && (
                <span className="text-xs font-mono-tabular text-[var(--text-muted)]">
                  {totalMatches} {t.canvas.matchesCount}
                </span>
              )}
              <button
                type="button"
                disabled={!findQuery || totalMatches === 0}
                onClick={handleReplaceAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--accent-contrast)] text-xs font-semibold transition-colors"
              >
                <Replace className="w-3.5 h-3.5" />
                <span>
                  {t.canvas.replaceAll}
                  {totalMatches > 0 ? ` (${totalMatches})` : ''}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!findQuery ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              {t.canvas.findPlaceholder}
            </div>
          ) : matches.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-muted)]">
              {t.canvas.noMatches}
            </div>
          ) : (
            matches.map(({ passage, count, snippet }) => (
              <div
                key={passage.id}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPassage(passage.id);
                        onClose();
                      }}
                      className="text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)] truncate text-left"
                    >
                      {passage.title || t.sidebar.untitledPassage}
                    </button>
                    <span className="text-[11px] font-mono-tabular px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-secondary)] shrink-0">
                      {count}
                    </span>
                  </div>
                  {snippet && (
                    <div className="text-xs text-[var(--text-muted)] line-clamp-2 break-words">
                      <HighlightedText
                        text={snippet}
                        find={findQuery}
                        matchCase={matchCase}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPassage(passage.id);
                      onClose();
                    }}
                    title={t.canvas.jumpToPassage}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[11px] font-medium text-[var(--text-secondary)]"
                  >
                    <span>{t.canvas.jumpToPassage}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReplacePassage(passage.id)}
                    className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] border border-[var(--border-hairline)] text-[11px] font-medium text-[var(--text-primary)] transition-colors"
                  >
                    {t.canvas.replacePassage}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
