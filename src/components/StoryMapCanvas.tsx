import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Dices,
  Flag,
  Grid3X3,
  Image as ImageIcon,
  LayoutGrid,
  Maximize2,
  Minus,
  Palette,
  Play,
  Plus,
  Redo2,
  Search,
  Sparkles,
  Swords,
  Undo2,
  Volume2,
  X,
} from 'lucide-react';
import {
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  WheelEvent,
} from 'react';
import { getAllNodeColors, getNodeColorMeta } from '../data/nodeColors';
import {
  getPassageConnections,
  parseBodyBlocks,
  PassageConnection,
} from '../engine/rpgEngine';
import { StoryIssue, validateStoryProject } from '../engine/storyValidator';
import { useI18n } from '../i18n/LanguageContext';
import { NodeColor, Passage, StoryProject } from '../types/story';

interface StoryMapCanvasProps {
  project: StoryProject;
  selectedPassageId: string | null;
  defaultSnapToGrid?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onSelectPassage: (id: string) => void;
  onMovePassage: (id: string, x: number, y: number) => void;
  onCreatePassageAt: (x: number, y: number) => void;
  onAutoLayout: () => void;
  onAutoLayoutByColor: () => void;
  onSnapAllToGrid: (gridSize: number) => void;
  onPlayFromPassage: (id: string) => void;
  onOpenFindReplace?: () => void;
}

const NODE_WIDTH = 248;
const NODE_HEIGHT = 132;
const GRID_SIZE = 24;

function snapCoord(val: number, enabled: boolean): number {
  if (!enabled) return Math.round(val);
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

export function StoryMapCanvas({
  project,
  selectedPassageId,
  defaultSnapToGrid = true,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onSelectPassage,
  onMovePassage,
  onCreatePassageAt,
  onAutoLayout,
  onAutoLayoutByColor,
  onSnapAllToGrid,
  onPlayFromPassage,
  onOpenFindReplace,
}: StoryMapCanvasProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(0.92);
  const [snapToGrid, setSnapToGrid] = useState(defaultSnapToGrid);
  const [colorFilter, setColorFilter] = useState<NodeColor | 'all'>('all');
  const [showValidator, setShowValidator] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });

  const [dragNode, setDragNode] = useState<{
    id: string;
    startMouseX: number;
    startMouseY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const passages = Object.values(project.passages);
  const issues = useMemo(() => validateStoryProject(project), [project]);
  const issuesByPassage = useMemo(() => {
    const map = new Map<string, StoryIssue[]>();
    for (const iss of issues) {
      if (!iss.passageId) continue;
      const arr = map.get(iss.passageId) || [];
      arr.push(iss);
      map.set(iss.passageId, arr);
    }
    return map;
  }, [issues]);

  const focusPassageOnCanvas = useCallback(
    (passageId: string) => {
      onSelectPassage(passageId);
      const target = project.passages[passageId];
      const container = containerRef.current;
      if (!target || !container) return;
      const rect = container.getBoundingClientRect();
      const cx = target.x + NODE_WIDTH / 2;
      const cy = target.y + NODE_HEIGHT / 2;
      setPan({
        x: rect.width / 2 - cx * zoom,
        y: rect.height / 2 - cy * zoom,
      });
    },
    [onSelectPassage, project.passages, zoom]
  );

  const getIssueDescription = (iss: StoryIssue): string => {
    switch (iss.kind) {
      case 'broken_link':
        return `${t.canvas.issueBrokenLink}${iss.detailText ? `: ${iss.detailText}` : ''}`;
      case 'unreachable':
        return t.canvas.issueUnreachable;
      case 'dead_end':
        return t.canvas.issueDeadEnd;
      case 'empty_body':
        return t.canvas.issueEmptyBody;
      case 'missing_start':
        return t.canvas.issueMissingStart;
    }
  };

  const fitToView = useCallback(() => {
    const container = containerRef.current;
    if (!container || passages.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of passages) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_WIDTH);
      maxY = Math.max(maxY, p.y + NODE_HEIGHT);
    }

    const rect = container.getBoundingClientRect();
    const pad = 70;
    const contentW = Math.max(200, maxX - minX);
    const contentH = Math.max(200, maxY - minY);
    const nextZoom = Math.max(
      0.42,
      Math.min(1.1, Math.min((rect.width - pad * 2) / contentW, (rect.height - pad * 2) / contentH))
    );

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(nextZoom);
    setPan({
      x: rect.width / 2 - centerX * nextZoom,
      y: rect.height / 2 - centerY * nextZoom,
    });
  }, [passages]);

  useEffect(() => {
    setSnapToGrid(defaultSnapToGrid);
  }, [defaultSnapToGrid]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fitToView();
    }, 60);
    return () => window.clearTimeout(timer);
    // Fit on mount or project switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const handleCanvasMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-passage-node="true"]')) return;
    setIsPanning(true);
    panStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (dragNode) {
      const dx = (e.clientX - dragNode.startMouseX) / zoom;
      const dy = (e.clientY - dragNode.startMouseY) / zoom;
      onMovePassage(
        dragNode.id,
        snapCoord(dragNode.origX + dx, snapToGrid),
        snapCoord(dragNode.origY + dy, snapToGrid)
      );
      return;
    }

    if (isPanning) {
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDragNode(null);
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.09 : 0.92;
    const nextZoom = Math.max(0.35, Math.min(1.5, zoom * factor));
    const worldX = (mouseX - pan.x) / zoom;
    const worldY = (mouseY - pan.y) / zoom;

    setZoom(nextZoom);
    setPan({
      x: mouseX - worldX * nextZoom,
      y: mouseY - worldY * nextZoom,
    });
  };

  const handleDoubleClickCanvas = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-passage-node="true"]')) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const worldX = snapCoord((e.clientX - rect.left - pan.x) / zoom - NODE_WIDTH / 2, snapToGrid);
    const worldY = snapCoord((e.clientY - rect.top - pan.y) / zoom - NODE_HEIGHT / 2, snapToGrid);
    onCreatePassageAt(worldX, worldY);
  };

  const toggleSnapToGrid = () => {
    const next = !snapToGrid;
    setSnapToGrid(next);
    if (next) {
      onSnapAllToGrid(GRID_SIZE);
    }
  };

  const allConnections: PassageConnection[] = [];
  for (const p of passages) {
    allConnections.push(...getPassageConnections(p));
  }

  const getStrokeForKind = (kind: PassageConnection['kind']) => {
    switch (kind) {
      case 'check_pass':
      case 'combat_win':
        return { stroke: '#10B981', marker: 'url(#arrow-emerald)', dashed: false };
      case 'check_fail':
      case 'combat_loss':
        return { stroke: '#EF4444', marker: 'url(#arrow-crimson)', dashed: true };
      case 'conditional':
        return { stroke: '#38BDF8', marker: 'url(#arrow-sky)', dashed: true };
      default:
        return { stroke: '#F59E0B', marker: 'url(#arrow-amber)', dashed: false };
    }
  };

  const renderConnection = (conn: PassageConnection, idx: number) => {
    const from = project.passages[conn.fromId];
    const to = project.passages[conn.toId];
    if (!from || !to) return null;

    const dimmedByFilter =
      colorFilter !== 'all' &&
      (from.color || 'none') !== colorFilter &&
      (to.color || 'none') !== colorFilter;

    if (conn.fromId === conn.toId) {
      const sx = from.x + NODE_WIDTH;
      const sy = from.y + 40;
      const d = `M ${sx} ${sy} C ${sx + 70} ${sy - 70}, ${sx + 70} ${sy + 70}, ${sx} ${sy + 30}`;
      const style = getStrokeForKind(conn.kind);
      return (
        <path
          key={`${conn.fromId}-${conn.toId}-${idx}`}
          d={d}
          fill="none"
          stroke={style.stroke}
          strokeWidth={2}
          strokeOpacity={dimmedByFilter ? 0.15 : 0.7}
          strokeDasharray={style.dashed ? '6 5' : undefined}
          markerEnd={style.marker}
        />
      );
    }

    const fromCenterX = from.x + NODE_WIDTH / 2;
    const toCenterX = to.x + NODE_WIDTH / 2;
    const goRight = toCenterX >= fromCenterX;

    const startX = goRight ? from.x + NODE_WIDTH : from.x;
    const startY = from.y + NODE_HEIGHT / 2;
    const endX = goRight ? to.x : to.x + NODE_WIDTH;
    const endY = to.y + NODE_HEIGHT / 2;

    const dx = Math.max(64, Math.abs(endX - startX) * 0.48);
    const c1x = goRight ? startX + dx : startX - dx;
    const c2x = goRight ? endX - dx : endX + dx;

    const d = `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`;
    const style = getStrokeForKind(conn.kind);
    const isHighlighted =
      selectedPassageId === conn.fromId || selectedPassageId === conn.toId;

    return (
      <g key={`${conn.fromId}-${conn.toId}-${idx}`}>
        <path
          d={d}
          fill="none"
          stroke={style.stroke}
          strokeWidth={isHighlighted ? 2.4 : 1.7}
          strokeOpacity={dimmedByFilter ? 0.12 : isHighlighted ? 0.92 : 0.45}
          strokeDasharray={style.dashed ? '6 5' : undefined}
          markerEnd={style.marker}
        />
      </g>
    );
  };

  const renderNode = (p: Passage) => {
    const isSelected = p.id === selectedPassageId;
    const isStart = p.id === project.meta.startPassageId;
    const linkCount = p.choices.length;
    const colorMeta = getNodeColorMeta(p.color, project.customColors);
    const localizedColorLabel =
      t.nodeColors[colorMeta.id]?.label ?? colorMeta.label;
    const localizedColorHint =
      t.nodeColors[colorMeta.id]?.meaningHint ?? colorMeta.meaningHint;
    const hasInlineImg = parseBodyBlocks(p.body).some((b) => b.type === 'image');
    const previewText = p.body.replace(/\[\[img:[^\]]+\]\]/gi, '[Image]').trim();
    const dimmed = colorFilter !== 'all' && (p.color || 'none') !== colorFilter;

    return (
      <div
        key={p.id}
        data-passage-node="true"
        style={{
          transform: `translate(${p.x}px, ${p.y}px)`,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          ...(colorMeta.isCustom
            ? {
                borderColor: isSelected ? 'var(--accent-primary)' : colorMeta.hex,
                backgroundColor: `color-mix(in srgb, ${colorMeta.hex} 12%, var(--bg-surface))`,
              }
            : {}),
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelectPassage(p.id);
          if (e.button === 0) {
            setDragNode({
              id: p.id,
              startMouseX: e.clientX,
              startMouseY: e.clientY,
              origX: p.x,
              origY: p.y,
            });
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onPlayFromPassage(p.id);
        }}
        className={`group absolute top-0 left-0 rounded-xl border p-3.5 flex flex-col justify-between cursor-grab active:cursor-grabbing transition-colors select-none ${
          colorMeta.isCustom ? '' : colorMeta.cardClass
        } ${dimmed ? 'opacity-30' : 'opacity-100'} ${
          isSelected
            ? 'ring-2 ring-[var(--accent-primary)] border-[var(--accent-primary)] shadow-lg shadow-black/25'
            : 'hover:border-[var(--text-muted)]'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {p.color && p.color !== 'none' && (
                <span
                  aria-label={`Color tag: ${localizedColorLabel}`}
                  title={`${localizedColorLabel} (${localizedColorHint})`}
                  style={colorMeta.isCustom ? { backgroundColor: colorMeta.hex } : undefined}
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorMeta.swatchClass}`}
                />
              )}
              <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {p.title || t.sidebar.untitledPassage}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isStart && (
                <Compass
                  className="w-3.5 h-3.5 text-[var(--accent-primary)]"
                  aria-label={t.canvas.startTag}
                />
              )}
              {p.isEnding && (
                <Flag
                  className="w-3.5 h-3.5 text-emerald-400"
                  aria-label={t.inspector.endingNode}
                />
              )}
              {(issuesByPassage.get(p.id)?.length ?? 0) > 0 && (
                <span
                  title={issuesByPassage
                    .get(p.id)!
                    .map(getIssueDescription)
                    .join('\n')}
                >
                  <AlertTriangle
                    className={`w-3.5 h-3.5 ${
                      issuesByPassage.get(p.id)!.some((i) => i.severity === 'error')
                        ? 'text-red-400'
                        : 'text-amber-400'
                    }`}
                  />
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayFromPassage(p.id);
                }}
                title={t.inspector.playFromHere}
                className="opacity-0 group-hover:opacity-100 p-1 rounded bg-[var(--bg-elevated)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] text-[var(--text-secondary)] transition-opacity"
              >
                <Play className="w-3 h-3 fill-current" />
              </button>
            </div>
          </div>

          <p className="mt-1.5 text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
            {previewText || t.canvas.emptyPassageHint}
          </p>
        </div>

        {/* Bottom feature affordance indicators + clean unboxed metadata */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-hairline)]">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            {(p.imageId || hasInlineImg) && (
              <span title={t.canvas.badgeImage}>
                <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
              </span>
            )}
            {(p.ambientAudioId || p.entrySfxId) && (
              <span title={t.canvas.badgeAudio}>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              </span>
            )}
            {p.skillCheck && (
              <span title={t.canvas.badgeDice}>
                <Dices className="w-3.5 h-3.5 text-sky-400" />
              </span>
            )}
            {p.combat && (
              <span title={t.canvas.badgeCombat}>
                <Swords className="w-3.5 h-3.5 text-red-400" />
              </span>
            )}
            {p.entryEffects.length > 0 && (
              <span title={t.canvas.badgeEffects}>
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              </span>
            )}
          </div>

          <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular whitespace-nowrap">
            {isStart ? `${t.canvas.startTag} · ` : ''}
            {p.isEnding ? `${t.inspector.endingNode} · ` : ''}
            {p.color && p.color !== 'none' ? (
              <span
                style={colorMeta.isCustom ? { color: colorMeta.hex } : undefined}
                className={colorMeta.textClass}
              >
                {localizedColorLabel} ·{' '}
              </span>
            ) : null}
            {linkCount} {linkCount === 1 ? t.canvas.choiceSingular : t.canvas.choicePlural}
          </div>
        </div>
      </div>
    );
  };

  const allColors = getAllNodeColors(project.customColors);

  return (
    <div className="relative flex-1 min-w-0 h-full overflow-hidden bg-[var(--bg-canvas)] studio-dot-grid">
      {/* Canvas Toolbar Overlay */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)]/95 border border-[var(--border-hairline)] backdrop-blur-sm">
          <button
            type="button"
            onClick={() => {
              const container = containerRef.current;
              const cx = container
                ? (container.clientWidth / 2 - pan.x) / zoom - NODE_WIDTH / 2
                : 200;
              const cy = container
                ? (container.clientHeight / 2 - pan.y) / zoom - NODE_HEIGHT / 2
                : 200;
              onCreatePassageAt(snapCoord(cx, snapToGrid), snapCoord(cy, snapToGrid));
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.canvas.newPassage}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onAutoLayout();
              window.setTimeout(fitToView, 50);
            }}
            title={t.canvas.autoLayout}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>{t.canvas.autoLayout}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onAutoLayoutByColor();
              window.setTimeout(fitToView, 50);
            }}
            title={t.canvas.layoutByColor}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
          >
            <Palette className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{t.canvas.layoutByColor}</span>
          </button>

            <button
              type="button"
              onClick={toggleSnapToGrid}
              title={snapToGrid ? t.canvas.snapOn : t.canvas.snapOff}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors whitespace-nowrap ${
                snapToGrid
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-500'
                  : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>{snapToGrid ? t.canvas.snapOn : t.canvas.snapOff}</span>
            </button>

            {/* Editor Undo / Redo */}
            {(onUndo || onRedo) && (
              <div className="flex items-center gap-1 pl-2 border-l border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  title={`${t.canvas.undo} (Ctrl+Z)`}
                  aria-label={t.canvas.undo}
                  className="p-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[var(--text-primary)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  title={`${t.canvas.redo} (Ctrl+Y)`}
                  aria-label={t.canvas.redo}
                  className="p-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[var(--text-primary)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {onOpenFindReplace && (
              <button
                type="button"
                onClick={onOpenFindReplace}
                title={`${t.canvas.findReplace} (Ctrl+H)`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{t.canvas.findReplace}</span>
              </button>
            )}

            {/* Story Validator Check */}
            <button
              type="button"
              onClick={() => setShowValidator((v) => !v)}
              title={t.canvas.validatorTitle}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors whitespace-nowrap ${
                issues.length === 0
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                  : issues.some((i) => i.severity === 'error')
                  ? 'bg-red-500/15 border-red-500/50 text-red-400 hover:bg-red-500/25'
                  : 'bg-amber-500/15 border-amber-500/50 text-amber-400 hover:bg-amber-500/25'
              }`}
            >
              {issues.length === 0 ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t.canvas.storyHealthy}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="font-mono-tabular">
                    {issues.length} {t.canvas.issuesCount}
                  </span>
                </>
              )}
            </button>

            {/* Color Tag Filter */}
            <div className="flex items-center gap-1 pl-2 border-l border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setColorFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  colorFilter === 'all'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.common.all}
              </button>
              {allColors
                .filter((c) => c.id !== 'none')
                .map((c) => {
                  const cLabel = t.nodeColors[c.id]?.label ?? c.label;
                  const cHint = t.nodeColors[c.id]?.meaningHint ?? c.meaningHint;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColorFilter(colorFilter === c.id ? 'all' : c.id)}
                      title={`${cLabel} (${cHint})`}
                      className={`p-1 rounded transition-transform ${
                        colorFilter === c.id
                          ? 'ring-1 ring-[var(--text-primary)] scale-110'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    >
                      <span
                        style={c.isCustom ? { backgroundColor: c.hex } : undefined}
                        className={`block w-2.5 h-2.5 rounded-full ${c.swatchClass}`}
                      />
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Zoom & Help */}
          <div className="pointer-events-auto inline-flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)]/95 border border-[var(--border-hairline)] backdrop-blur-sm">
            <div className="hidden xl:flex items-center gap-3 text-xs text-[var(--text-muted)] pr-2 border-r border-[var(--border-hairline)]">
              <span>{t.canvas.doubleClickHint}</span>
              <span aria-hidden="true">·</span>
              <span>{t.canvas.dragPanHint}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.12).toFixed(2))))}
                aria-label={t.canvas.zoomOut}
                title={t.canvas.zoomOut}
                className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="px-2 py-0.5 text-xs font-mono-tabular text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.12).toFixed(2))))}
                aria-label={t.canvas.zoomIn}
                title={t.canvas.zoomIn}
                className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={fitToView}
                aria-label={t.canvas.fitToScreen}
                title={t.canvas.fitToScreen}
                className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] ml-1"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Floating Story Health Validator Panel */}
        {showValidator && (
          <div className="absolute top-16 right-4 z-20 w-80 max-h-96 flex flex-col rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-sm shadow-xl overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-[var(--border-hairline)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                {issues.length === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span>{t.canvas.validatorTitle}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowValidator(false)}
                className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-y-auto p-3 space-y-2 text-xs">
              {issues.length === 0 ? (
                <div className="py-6 text-center text-emerald-400 font-medium">
                  {t.canvas.storyHealthy}
                </div>
              ) : (
                issues.map((iss) => (
                  <div
                    key={iss.id}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div
                        className={`font-semibold truncate ${
                          iss.severity === 'error' ? 'text-red-400' : 'text-amber-400'
                        }`}
                      >
                        {iss.passageTitle || t.sidebar.untitledPassage}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {getIssueDescription(iss)}
                      </div>
                    </div>
                    {iss.passageId && (
                      <button
                        type="button"
                        onClick={() => focusPassageOnCanvas(iss.passageId!)}
                        className="px-2 py-1 rounded bg-[var(--bg-elevated)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] border border-[var(--border-hairline)] text-[11px] font-medium shrink-0 transition-colors"
                      >
                        {t.canvas.jumpToPassage}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      {/* Interactive Pan/Zoom Surface */}
      <div
        ref={containerRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClickCanvas}
        className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="relative w-full h-full"
        >
          {/* Connection Curves Layer */}
          <svg
            className="absolute top-0 left-0 overflow-visible pointer-events-none"
            width="1"
            height="1"
          >
            <defs>
              <marker
                id="arrow-amber"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#F59E0B" />
              </marker>
              <marker
                id="arrow-emerald"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
              </marker>
              <marker
                id="arrow-crimson"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
              </marker>
              <marker
                id="arrow-sky"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8" />
              </marker>
            </defs>
            {allConnections.map((conn, idx) => renderConnection(conn, idx))}
          </svg>

          {/* Passage Nodes Layer */}
          {passages.map(renderNode)}
        </div>
      </div>
    </div>
  );
}
