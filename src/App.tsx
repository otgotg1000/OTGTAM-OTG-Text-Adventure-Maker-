import { PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { synthEngine } from './audio/synthEngine';
import { ExportView } from './components/ExportView';
import { FindReplaceModal } from './components/FindReplaceModal';
import { HomeView } from './components/HomeView';
import { MediaVaultView } from './components/MediaVaultView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PassageInspector } from './components/PassageInspector';
import { PlaytestModal } from './components/PlaytestModal';
import { RpgSystemsView } from './components/RpgSystemsView';
import { StoryMapCanvas } from './components/StoryMapCanvas';
import { StorySettingsView } from './components/StorySettingsView';
import { TopBar } from './components/TopBar';
import { WorldSidebar } from './components/WorldSidebar';
import { createProjectFromGenre } from './data/genreTemplates';
import { getAllNodeColors } from './data/nodeColors';
import { BUILTIN_ASSETS, createStarterProject } from './data/starterProject';
import { getDefaultLayoutForGenre } from './data/themes';
import { getPassageConnections } from './engine/rpgEngine';
import { LanguageProvider } from './i18n/LanguageContext';
import { getTranslations } from './i18n/translations';
import { processUploadedImage } from './media/imageCompress';
import {
  loadLibraryFromIdb,
  saveLibraryToIdb,
  StoredLibrary,
} from './storage/projectStorage';
import {
  CustomNodeColor,
  CustomStoryTheme,
  MediaAsset,
  Passage,
  RpgConfig,
  StoryFontId,
  StoryFontSizeId,
  StoryGenre,
  StoryLayoutId,
  StoryProject,
  StudioSettings,
  StudioThemeId,
  WorkspaceTab,
} from './types/story';

const PROJECTS_STORAGE_KEY = 'loomforge_projects_v2';
const LEGACY_DRAFT_KEY = 'loomforge_draft_v1';
const SETTINGS_STORAGE_KEY = 'otgtam_settings_v1';

const DEFAULT_SETTINGS: StudioSettings = {
  language: 'en',
  theme: 'obsidian-amber',
  storyTheme: 'obsidian-amber',
  defaultStoryLayout: 'rpg-split',
  defaultStoryFont: 'serif-editorial',
  defaultStoryFontSize: 'md',
  customStoryThemes: [],
  defaultSnapToGrid: true,
  autoCompressImages: true,
  masterVolume: 0.65,
  muted: false,
  defaultAuthor: 'Author',
};

function loadInitialSettings(): StudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StudioSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    }
  } catch {
    // Ignore storage read issues
  }
  return DEFAULT_SETTINGS;
}

const BUILTIN_AUDIO_ASSETS = BUILTIN_ASSETS.filter((a) => a.kind === 'audio');

function mergeNewAudioPresets(proj: StoryProject): StoryProject {
  const existingIds = new Set(proj.assets.map((a) => a.id));
  const missingAudio = BUILTIN_AUDIO_ASSETS.filter((a) => !existingIds.has(a.id));
  if (missingAudio.length === 0) return proj;
  return {
    ...proj,
    assets: [...proj.assets, ...missingAudio],
  };
}

function loadInitialLibrary(): StoredLibrary {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredLibrary;
      if (parsed && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        const projects = parsed.projects.map(mergeNewAudioPresets);
        return {
          projects,
          activeProjectId:
            parsed.activeProjectId &&
            projects.some((p) => p.id === parsed.activeProjectId)
              ? parsed.activeProjectId
              : projects[0].id,
        };
      }
    }

    // Migrate single-project draft if present from v1
    const legacy = localStorage.getItem(LEGACY_DRAFT_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy) as StoryProject;
      if (parsedLegacy?.meta && parsedLegacy?.passages) {
        const normalized: StoryProject = mergeNewAudioPresets({
          ...parsedLegacy,
          meta: { ...parsedLegacy.meta, genre: parsedLegacy.meta.genre || 'rpg' },
        });
        return {
          projects: [normalized],
          activeProjectId: normalized.id,
        };
      }
    }
  } catch {
    // Ignore storage read issues
  }

  const starter = createStarterProject();
  return {
    projects: [starter],
    activeProjectId: starter.id,
  };
}

export default function App() {
  const [initialLib] = useState<StoredLibrary>(loadInitialLibrary);
  const [projects, setProjects] = useState<StoryProject[]>(initialLib.projects);
  const [activeProjectId, setActiveProjectId] = useState<string>(initialLib.activeProjectId);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('home');
  const [settings, setSettings] = useState<StudioSettings>(loadInitialSettings);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  const project =
    projects.find((p) => p.id === activeProjectId) || projects[0];

  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(
    () => project?.meta.startPassageId || Object.keys(project?.passages || {})[0] || null
  );
  const [playtestProjectId, setPlaytestProjectId] = useState<string | null>(null);
  const [playtestStartId, setPlaytestStartId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  type EditorSnapshot = Pick<
    StoryProject,
    'meta' | 'rpgConfig' | 'passages' | 'customColors' | 'assets'
  >;
  const [undoPast, setUndoPast] = useState<Record<string, EditorSnapshot[]>>({});
  const [redoFuture, setRedoFuture] = useState<Record<string, EditorSnapshot[]>>({});
  const lastHistoryPushRef = useRef<{ projectId: string; ts: number }>({
    projectId: '',
    ts: 0,
  });
  const idbHydratedRef = useRef(false);

  const notify = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  // Hydrate from IndexedDB on mount (migrating localStorage library if IDB is empty)
  useEffect(() => {
    let active = true;
    (async () => {
      const fromIdb = await loadLibraryFromIdb();
      if (!active) return;
      if (fromIdb && Array.isArray(fromIdb.projects) && fromIdb.projects.length > 0) {
        const normalized = fromIdb.projects.map(mergeNewAudioPresets);
        const nextActiveId =
          fromIdb.activeProjectId &&
          normalized.some((p) => p.id === fromIdb.activeProjectId)
            ? fromIdb.activeProjectId
            : normalized[0].id;
        const activeProj =
          normalized.find((p) => p.id === nextActiveId) || normalized[0];
        setProjects(normalized);
        setActiveProjectId(nextActiveId);
        setSelectedPassageId(
          activeProj?.meta.startPassageId ||
            Object.keys(activeProj?.passages || {})[0] ||
            null
        );
      } else {
        await saveLibraryToIdb({
          projects: initialLib.projects,
          activeProjectId: initialLib.activeProjectId,
        });
      }
      idbHydratedRef.current = true;
    })();
    return () => {
      active = false;
    };
  }, [initialLib]);

  const handleUpdateSettings = useCallback((patch: Partial<StudioSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleCreateCustomTheme = useCallback(
    (theme: CustomStoryTheme) => {
      setSettings((prev) => ({
        ...prev,
        customStoryThemes: [...(prev.customStoryThemes || []), theme],
      }));
      notify(`Created custom story theme "${theme.name}".`);
    },
    [notify]
  );

  const handleDeleteCustomTheme = useCallback(
    (themeId: string) => {
      setSettings((prev) => ({
        ...prev,
        storyTheme: prev.storyTheme === themeId ? 'obsidian-amber' : prev.storyTheme,
        customStoryThemes: (prev.customStoryThemes || []).filter((t) => t.id !== themeId),
      }));
      setProjects((prevList) =>
        prevList.map((p) =>
          p.meta.storyTheme === themeId
            ? {
                ...p,
                updatedAt: new Date().toISOString(),
                meta: {
                  ...p.meta,
                  storyTheme: 'obsidian-amber',
                  customStoryTheme: undefined,
                },
              }
            : p
        )
      );
      notify('Deleted custom story theme.');
    },
    [notify]
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.lang = settings.language || 'en';
    synthEngine.setVolume(settings.masterVolume);
    synthEngine.setMuted(settings.muted);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage write issues
    }
  }, [settings]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Persist entire multi-project library to IndexedDB + localStorage fallback
  useEffect(() => {
    const payload: StoredLibrary = { projects, activeProjectId };
    if (idbHydratedRef.current) {
      void saveLibraryToIdb(payload);
    }
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // IndexedDB handles larger media libraries cleanly
    }
  }, [projects, activeProjectId]);

  const updateActiveProject = useCallback(
    (updater: (prev: StoryProject) => StoryProject, forceHistory = false) => {
      const current = projects.find((p) => p.id === activeProjectId);
      if (current) {
        const now = Date.now();
        const shouldPush =
          forceHistory ||
          lastHistoryPushRef.current.projectId !== activeProjectId ||
          now - lastHistoryPushRef.current.ts > 850;
        if (shouldPush) {
          const snapshot: EditorSnapshot = JSON.parse(
            JSON.stringify({
              meta: current.meta,
              rpgConfig: current.rpgConfig,
              passages: current.passages,
              customColors: current.customColors,
              assets: current.assets,
            })
          );
          setUndoPast((prev) => ({
            ...prev,
            [activeProjectId]: [...(prev[activeProjectId] || []), snapshot].slice(-40),
          }));
          setRedoFuture((prev) =>
            prev[activeProjectId]?.length ? { ...prev, [activeProjectId]: [] } : prev
          );
          lastHistoryPushRef.current = { projectId: activeProjectId, ts: now };
        }
      }
      setProjects((prevList) =>
        prevList.map((p) => (p.id === activeProjectId ? updater(p) : p))
      );
    },
    [activeProjectId, projects]
  );

  const canUndo = (undoPast[activeProjectId]?.length ?? 0) > 0;
  const canRedo = (redoFuture[activeProjectId]?.length ?? 0) > 0;

  const handleEditorUndo = useCallback(() => {
    const past = undoPast[activeProjectId] || [];
    const current = projects.find((p) => p.id === activeProjectId);
    if (past.length === 0 || !current) return;

    const targetSnapshot = past[past.length - 1];
    const currentSnapshot: EditorSnapshot = JSON.parse(
      JSON.stringify({
        meta: current.meta,
        rpgConfig: current.rpgConfig,
        passages: current.passages,
        customColors: current.customColors,
        assets: current.assets,
      })
    );

    setUndoPast((prev) => ({
      ...prev,
      [activeProjectId]: past.slice(0, -1),
    }));
    setRedoFuture((prev) => ({
      ...prev,
      [activeProjectId]: [...(prev[activeProjectId] || []), currentSnapshot].slice(-40),
    }));
    setProjects((prevList) =>
      prevList.map((p) =>
        p.id === activeProjectId
          ? {
              ...p,
              ...targetSnapshot,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
    setSelectedPassageId((cur) =>
      cur && targetSnapshot.passages[cur]
        ? cur
        : targetSnapshot.meta.startPassageId ||
          Object.keys(targetSnapshot.passages)[0] ||
          null
    );
    notify('Undo applied.');
  }, [undoPast, activeProjectId, projects, notify]);

  const handleEditorRedo = useCallback(() => {
    const future = redoFuture[activeProjectId] || [];
    const current = projects.find((p) => p.id === activeProjectId);
    if (future.length === 0 || !current) return;

    const targetSnapshot = future[future.length - 1];
    const currentSnapshot: EditorSnapshot = JSON.parse(
      JSON.stringify({
        meta: current.meta,
        rpgConfig: current.rpgConfig,
        passages: current.passages,
        customColors: current.customColors,
        assets: current.assets,
      })
    );

    setRedoFuture((prev) => ({
      ...prev,
      [activeProjectId]: future.slice(0, -1),
    }));
    setUndoPast((prev) => ({
      ...prev,
      [activeProjectId]: [...(prev[activeProjectId] || []), currentSnapshot].slice(-40),
    }));
    setProjects((prevList) =>
      prevList.map((p) =>
        p.id === activeProjectId
          ? {
              ...p,
              ...targetSnapshot,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
    setSelectedPassageId((cur) =>
      cur && targetSnapshot.passages[cur]
        ? cur
        : targetSnapshot.meta.startPassageId ||
          Object.keys(targetSnapshot.passages)[0] ||
          null
    );
    notify('Redo applied.');
  }, [redoFuture, activeProjectId, projects, notify]);

  const [findReplaceOpen, setFindReplaceOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTab === 'home' || playtestProjectId) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'h' && activeTab === 'map') {
        e.preventDefault();
        setFindReplaceOpen((prev) => !prev);
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleEditorUndo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        handleEditorRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, playtestProjectId, handleEditorUndo, handleEditorRedo]);

  const selectedPassage =
    (selectedPassageId && project?.passages[selectedPassageId]) || null;

  const handleOpenProject = useCallback(
    (id: string) => {
      const target = projects.find((p) => p.id === id);
      if (!target) return;
      setActiveProjectId(id);
      setSelectedPassageId(
        target.meta.startPassageId || Object.keys(target.passages)[0] || null
      );
      setActiveTab('map');
    },
    [projects]
  );

  const handleCreateFromGenre = useCallback(
    (input: {
      genre: StoryGenre;
      title?: string;
      author?: string;
      subtitle?: string;
      storyTheme?: StudioThemeId;
      customStoryTheme?: CustomStoryTheme;
      storyLayout?: StoryLayoutId;
      storyFont?: StoryFontId;
      storyFontSize?: StoryFontSizeId;
    }) => {
      const baseCreated = createProjectFromGenre(
        input.genre,
        input.title,
        input.author || settings.defaultAuthor,
        input.subtitle,
        input.storyTheme ?? settings.storyTheme,
        input.storyLayout ?? getDefaultLayoutForGenre(input.genre)
      );
      const created: StoryProject = {
        ...baseCreated,
        meta: {
          ...baseCreated.meta,
          storyFont: input.storyFont ?? settings.defaultStoryFont,
          storyFontSize: input.storyFontSize ?? settings.defaultStoryFontSize,
          customStoryTheme: input.customStoryTheme,
        },
      };
      setProjects((prev) => [created, ...prev]);
      setActiveProjectId(created.id);
      setSelectedPassageId(created.meta.startPassageId);
      setActiveTab('map');
      notify(`Created "${created.meta.title}"`);
    },
    [
      notify,
      settings.defaultAuthor,
      settings.storyTheme,
      settings.defaultStoryFont,
      settings.defaultStoryFontSize,
    ]
  );

  const handleDuplicateProject = useCallback(
    (id: string) => {
      const source = projects.find((p) => p.id === id);
      if (!source) return;
      const copy: StoryProject = {
        ...JSON.parse(JSON.stringify(source)),
        id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        updatedAt: new Date().toISOString(),
        meta: {
          ...source.meta,
          title: `${source.meta.title} (Copy)`,
        },
      };
      setProjects((prev) => [copy, ...prev]);
      notify(`Duplicated "${source.meta.title}"`);
    },
    [projects, notify]
  );

  const handleDeleteProject = useCallback(
    (id: string) => {
      if (projects.length <= 1) return;
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      if (activeProjectId === id && remaining[0]) {
        setActiveProjectId(remaining[0].id);
        setSelectedPassageId(remaining[0].meta.startPassageId);
      }
      notify('Project deleted.');
    },
    [projects, activeProjectId, notify]
  );

  const updatePassage = useCallback(
    (id: string, patch: Partial<Passage>) => {
      updateActiveProject((prev) => {
        const existing = prev.passages[id];
        if (!existing) return prev;
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          passages: {
            ...prev.passages,
            [id]: { ...existing, ...patch },
          },
        };
      });
    },
    [updateActiveProject]
  );

  const movePassage = useCallback(
    (id: string, x: number, y: number) => {
      updateActiveProject((prev) => {
        const existing = prev.passages[id];
        if (!existing) return prev;
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          passages: {
            ...prev.passages,
            [id]: { ...existing, x, y },
          },
        };
      });
    },
    [updateActiveProject]
  );

  const snapAllNodesToGrid = useCallback(
    (gridSize: number) => {
      updateActiveProject((prev) => {
        const nextPassages: Record<string, Passage> = {};
        for (const [key, p] of Object.entries(prev.passages)) {
          nextPassages[key] = {
            ...p,
            x: Math.round(p.x / gridSize) * gridSize,
            y: Math.round(p.y / gridSize) * gridSize,
          };
        }
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          passages: nextPassages,
        };
      });
      notify('Snapped all passage nodes to grid.');
    },
    [updateActiveProject, notify]
  );

  const createPassageAt = useCallback(
    (x: number, y: number, title?: string) => {
      const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      updateActiveProject((prev) => {
        const count = Object.keys(prev.passages).length + 1;
        const newPassage: Passage = {
          id,
          title: title || `Passage ${count}`,
          tags: [],
          color: 'none',
          x,
          y,
          createdAt: Date.now(),
          body: '',
          entryEffects: [],
          choices: [],
        };
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          passages: {
            ...prev.passages,
            [id]: newPassage,
          },
        };
      });
      setSelectedPassageId(id);
      return id;
    },
    [updateActiveProject]
  );

  const createConnectedPassage = useCallback(
    (fromPassageId: string, initialTitle?: string): string => {
      const from = project.passages[fromPassageId];
      const offsetY = (from?.choices.length ?? 0) * 168;
      const nextX = Math.round(((from?.x ?? 96) + 336) / 24) * 24;
      const nextY = Math.round(((from?.y ?? 168) + offsetY) / 24) * 24;
      return createPassageAt(nextX, nextY, initialTitle || 'New Branch');
    },
    [project.passages, createPassageAt]
  );

  const deletePassage = useCallback(
    (id: string) => {
      updateActiveProject((prev) => {
        const ids = Object.keys(prev.passages);
        if (ids.length <= 1) return prev;

        const nextPassages: Record<string, Passage> = {};
        const fallbackId = ids.find((k) => k !== id) || '';

        for (const key of ids) {
          if (key === id) continue;
          const p = prev.passages[key];
          nextPassages[key] = {
            ...p,
            choices: p.choices.filter((c) => c.targetPassageId !== id),
            skillCheck: p.skillCheck
              ? {
                  ...p.skillCheck,
                  successPassageId:
                    p.skillCheck.successPassageId === id
                      ? fallbackId
                      : p.skillCheck.successPassageId,
                  failurePassageId:
                    p.skillCheck.failurePassageId === id
                      ? fallbackId
                      : p.skillCheck.failurePassageId,
                }
              : undefined,
            combat: p.combat
              ? {
                  ...p.combat,
                  victoryPassageId:
                    p.combat.victoryPassageId === id
                      ? fallbackId
                      : p.combat.victoryPassageId,
                  defeatPassageId:
                    p.combat.defeatPassageId === id
                      ? fallbackId
                      : p.combat.defeatPassageId,
                  fleePassageId:
                    p.combat.fleePassageId === id ? undefined : p.combat.fleePassageId,
                }
              : undefined,
          };
        }

        const nextStart =
          prev.meta.startPassageId === id ? fallbackId : prev.meta.startPassageId;

        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          meta: { ...prev.meta, startPassageId: nextStart },
          passages: nextPassages,
        };
      });

      setSelectedPassageId((cur) => {
        if (cur !== id) return cur;
        const remaining = Object.keys(project.passages).filter((k) => k !== id);
        return remaining[0] || null;
      });
      notify('Passage removed.');
    },
    [updateActiveProject, project.passages, notify]
  );

  const autoLayoutPassages = useCallback(() => {
    updateActiveProject((prev) => {
      const passages = prev.passages;
      const startId = prev.meta.startPassageId;
      const visited = new Set<string>();
      const levels: string[][] = [];

      const queue: Array<{ id: string; depth: number }> = [];
      if (passages[startId]) {
        queue.push({ id: startId, depth: 0 });
        visited.add(startId);
      }

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (!levels[current.depth]) levels[current.depth] = [];
        levels[current.depth].push(current.id);

        const p = passages[current.id];
        if (!p) continue;
        for (const conn of getPassageConnections(p)) {
          if (conn.toId && passages[conn.toId] && !visited.has(conn.toId)) {
            visited.add(conn.toId);
            queue.push({ id: conn.toId, depth: current.depth + 1 });
          }
        }
      }

      const orphans = Object.keys(passages).filter((id) => !visited.has(id));
      if (orphans.length > 0) {
        levels.push(orphans);
      }

      const nextPassages: Record<string, Passage> = { ...passages };
      levels.forEach((col, colIdx) => {
        const totalHeight = col.length * 168;
        const startY = Math.max(72, 312 - totalHeight / 2);
        col.forEach((id, rowIdx) => {
          nextPassages[id] = {
            ...nextPassages[id],
            x: Math.round((72 + colIdx * 336) / 24) * 24,
            y: Math.round((startY + rowIdx * 168) / 24) * 24,
          };
        });
      });

      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        passages: nextPassages,
      };
    });
    notify('Organized passages into grid-aligned columns.');
  }, [updateActiveProject, notify]);

  const autoLayoutByColor = useCallback(() => {
    updateActiveProject((prev) => {
      const allColors = getAllNodeColors(prev.customColors);
      const colorOrder = allColors.map((c) => c.id);
      const groups = new Map<string, Passage[]>();

      for (const p of Object.values(prev.passages)) {
        const key = p.color && colorOrder.includes(p.color) ? p.color : 'none';
        const list = groups.get(key) || [];
        list.push(p);
        groups.set(key, list);
      }

      const orderedKeys = colorOrder.filter((k) => (groups.get(k)?.length ?? 0) > 0);
      const nextPassages: Record<string, Passage> = { ...prev.passages };

      orderedKeys.forEach((key, colIdx) => {
        const items = (groups.get(key) || []).slice().sort((a, b) => {
          const tA = a.createdAt ?? 0;
          const tB = b.createdAt ?? 0;
          if (tA !== tB) return tA - tB;
          return a.title.localeCompare(b.title);
        });
        const totalHeight = items.length * 168;
        const startY = Math.max(72, 312 - totalHeight / 2);
        items.forEach((p, rowIdx) => {
          nextPassages[p.id] = {
            ...p,
            x: Math.round((72 + colIdx * 312) / 24) * 24,
            y: Math.round((startY + rowIdx * 168) / 24) * 24,
          };
        });
      });

      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        passages: nextPassages,
      };
    });
    notify('Organized passages by color tag.');
  }, [updateActiveProject, notify]);

  const handleCreateCustomColor = useCallback(
    (color: Omit<CustomNodeColor, 'id'>): string => {
      const id = `cc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const entry: CustomNodeColor = { id, ...color };
      updateActiveProject((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        customColors: [...(prev.customColors || []), entry],
      }));
      notify(`Added custom passage color "${color.label}".`);
      return id;
    },
    [updateActiveProject, notify]
  );

  const handleDeleteCustomColor = useCallback(
    (colorId: string) => {
      updateActiveProject((prev) => {
        const nextPassages: Record<string, Passage> = {};
        for (const [k, p] of Object.entries(prev.passages)) {
          nextPassages[k] = p.color === colorId ? { ...p, color: 'none' } : p;
        }
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          customColors: (prev.customColors || []).filter((c) => c.id !== colorId),
          passages: nextPassages,
        };
      });
      notify('Deleted custom passage color.');
    },
    [updateActiveProject, notify]
  );

  const handleUploadMediaAsset = useCallback(
    async (
      file: File,
      kind: 'image' | 'audio',
      audioRole: 'sfx' | 'ambient' = 'sfx'
    ): Promise<MediaAsset | null> => {
      let dataUrl: string | null = null;
      let description = `${Math.max(1, Math.round(file.size / 1024))} KB`;
      let compressedNotice = '';

      if (kind === 'image') {
        const processed = await processUploadedImage(
          file,
          settings.autoCompressImages ?? true
        );
        if (processed) {
          dataUrl = processed.dataUrl;
          if (processed.compressed && processed.finalKb < processed.originalKb) {
            description = `${processed.finalKb} KB (${processed.originalKb} KB → ${processed.finalKb} KB)`;
            compressedNotice = ` (${processed.originalKb} KB → ${processed.finalKb} KB)`;
          } else {
            description = `${processed.finalKb} KB`;
          }
        }
      } else {
        dataUrl = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      }

      if (!dataUrl) {
        notify('Could not read uploaded file.');
        return null;
      }

      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const asset: MediaAsset = {
        id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: cleanName || 'Uploaded Media',
        kind,
        source: 'upload',
        url: dataUrl,
        audioRole: kind === 'audio' ? audioRole : undefined,
        description,
      };

      updateActiveProject((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        assets: [asset, ...prev.assets],
      }));
      notify(`Added "${asset.name}" to Media Vault${compressedNotice}.`);
      return asset;
    },
    [updateActiveProject, notify, settings.autoCompressImages]
  );

  const replaceInText = (
    source: string,
    find: string,
    replace: string,
    matchCase: boolean
  ): { text: string; count: number } => {
    if (!find || !source) return { text: source, count: 0 };
    const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, matchCase ? 'g' : 'gi');
    let count = 0;
    const text = source.replace(regex, () => {
      count += 1;
      return replace;
    });
    return { text, count };
  };

  const handleReplaceInPassage = useCallback(
    (
      passageId: string,
      find: string,
      replace: string,
      matchCase: boolean
    ): number => {
      const target = project?.passages[passageId];
      if (!target || !find) return 0;

      const tRes = replaceInText(target.title, find, replace, matchCase);
      const bRes = replaceInText(target.body, find, replace, matchCase);
      let cCount = 0;
      const nextChoices = target.choices.map((ch) => {
        const res = replaceInText(ch.label, find, replace, matchCase);
        cCount += res.count;
        return res.count > 0 ? { ...ch, label: res.text } : ch;
      });
      const total = tRes.count + bRes.count + cCount;
      if (total === 0) return 0;

      updateActiveProject(
        (prev) => {
          const p = prev.passages[passageId];
          if (!p) return prev;
          return {
            ...prev,
            updatedAt: new Date().toISOString(),
            passages: {
              ...prev.passages,
              [passageId]: {
                ...p,
                title: tRes.text,
                body: bRes.text,
                choices: nextChoices,
              },
            },
          };
        },
        true
      );
      return total;
    },
    [project?.passages, updateActiveProject]
  );

  const handleReplaceAll = useCallback(
    (find: string, replace: string, matchCase: boolean): number => {
      if (!project || !find) return 0;
      let total = 0;
      const nextPassages: Record<string, Passage> = {};
      for (const [id, p] of Object.entries(project.passages)) {
        const tRes = replaceInText(p.title, find, replace, matchCase);
        const bRes = replaceInText(p.body, find, replace, matchCase);
        let cCount = 0;
        const nextChoices = p.choices.map((ch) => {
          const res = replaceInText(ch.label, find, replace, matchCase);
          cCount += res.count;
          return res.count > 0 ? { ...ch, label: res.text } : ch;
        });
        const pTotal = tRes.count + bRes.count + cCount;
        total += pTotal;
        nextPassages[id] =
          pTotal > 0
            ? {
                ...p,
                title: tRes.text,
                body: bRes.text,
                choices: nextChoices,
              }
            : p;
      }
      if (total === 0) return 0;
      updateActiveProject(
        (prev) => ({
          ...prev,
          updatedAt: new Date().toISOString(),
          passages: nextPassages,
        }),
        true
      );
      return total;
    },
    [project, updateActiveProject]
  );

  const handleDeleteAsset = useCallback(
    (assetId: string) => {
      updateActiveProject((prev) => {
        const nextPassages: Record<string, Passage> = {};
        for (const [k, p] of Object.entries(prev.passages)) {
          nextPassages[k] = {
            ...p,
            imageId: p.imageId === assetId ? undefined : p.imageId,
            ambientAudioId: p.ambientAudioId === assetId ? undefined : p.ambientAudioId,
            entrySfxId: p.entrySfxId === assetId ? undefined : p.entrySfxId,
            combat: p.combat
              ? {
                  ...p.combat,
                  enemyPortraitId:
                    p.combat.enemyPortraitId === assetId ? undefined : p.combat.enemyPortraitId,
                }
              : undefined,
          };
        }
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          assets: prev.assets.filter((a) => a.id !== assetId),
          passages: nextPassages,
        };
      });
      notify('Removed asset from Media Vault.');
    },
    [updateActiveProject, notify]
  );

  const handleAttachAssetToSelected = useCallback(
    (asset: MediaAsset) => {
      if (!selectedPassageId) return;
      if (asset.kind === 'image') {
        updatePassage(selectedPassageId, { imageId: asset.id });
        notify(`Attached "${asset.name}" cover image.`);
      } else if (asset.audioRole === 'ambient') {
        updatePassage(selectedPassageId, { ambientAudioId: asset.id });
        notify(`Attached "${asset.name}" ambient track.`);
      } else {
        updatePassage(selectedPassageId, { entrySfxId: asset.id });
        notify(`Set "${asset.name}" as passage entry SFX.`);
      }
    },
    [selectedPassageId, updatePassage, notify]
  );

  const handleSaveJson = useCallback(
    (targetProject: StoryProject = project) => {
      const blob = new Blob([JSON.stringify(targetProject, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const slug = (targetProject.meta.title || 'otgtam-project')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug || 'project'}.otgtam.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify(`Saved "${targetProject.meta.title}" JSON.`);
    },
    [project, notify]
  );

  const handleImportJson = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result)) as StoryProject;
          if (!parsed?.meta || !parsed?.passages || !parsed?.rpgConfig) {
            notify('Invalid OTGTAM JSON file.');
            return;
          }
          // Assign a fresh ID if colliding so existing projects are never overwritten
          const imported: StoryProject = {
            ...parsed,
            id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            updatedAt: new Date().toISOString(),
            meta: {
              ...parsed.meta,
              genre: parsed.meta.genre || 'rpg',
            },
          };
          setProjects((prev) => [imported, ...prev]);
          setActiveProjectId(imported.id);
          setSelectedPassageId(
            imported.meta.startPassageId || Object.keys(imported.passages)[0] || null
          );
          setActiveTab('map');
          notify(`Imported "${imported.meta.title}" into your library.`);
        } catch {
          notify('Could not parse JSON file.');
        }
      };
      reader.readAsText(file);
    },
    [notify]
  );

  const handleUpdateRpgConfig = useCallback(
    (nextConfig: RpgConfig) => {
      updateActiveProject((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        rpgConfig: nextConfig,
      }));
    },
    [updateActiveProject]
  );

  const playtestProject =
    (playtestProjectId && projects.find((p) => p.id === playtestProjectId)) || project;

  return (
    <LanguageProvider
      language={settings.language || 'en'}
      onChangeLanguage={(language) => handleUpdateSettings({ language })}
    >
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {activeTab !== 'home' && (
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onPlaytest={() => {
            setPlaytestProjectId(project.id);
            setPlaytestStartId(project.meta.startPassageId);
          }}
        />
      )}

      <main className="flex-1 min-h-0 flex overflow-hidden">
        {activeTab === 'home' && (
          <HomeView
            projects={projects}
            activeProjectId={activeProjectId}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onCreateCustomTheme={handleCreateCustomTheme}
            onDeleteCustomTheme={handleDeleteCustomTheme}
            onCreateFromGenre={handleCreateFromGenre}
            onOpenProject={handleOpenProject}
            onPlayProject={(id) => {
              const target = projects.find((p) => p.id === id);
              if (target) {
                setPlaytestProjectId(target.id);
                setPlaytestStartId(target.meta.startPassageId);
              }
            }}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={handleDeleteProject}
            onExportJson={(p) => handleSaveJson(p)}
            onImportJson={handleImportJson}
          />
        )}

        {activeTab === 'map' && (
          <>
            {leftSidebarOpen ? (
              <WorldSidebar
                project={project}
                selectedPassageId={selectedPassageId}
                onSelectPassage={setSelectedPassageId}
                onCreatePassage={() => {
                  const count = Object.keys(project.passages).length;
                  const x = Math.round((144 + (count % 4) * 96) / 24) * 24;
                  const y = Math.round((144 + (count % 3) * 96) / 24) * 24;
                  createPassageAt(x, y);
                }}
                onSaveJson={() => handleSaveJson(project)}
                onImportJson={handleImportJson}
                onUpdateTitle={(title) =>
                  updateActiveProject((prev) => ({
                    ...prev,
                    updatedAt: new Date().toISOString(),
                    meta: { ...prev.meta, title },
                  }))
                }
                onBackToProjects={() => setActiveTab('home')}
                onCollapse={() => setLeftSidebarOpen(false)}
              />
            ) : (
              <div className="w-10 shrink-0 border-r border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col items-center py-3">
                <button
                  type="button"
                  onClick={() => setLeftSidebarOpen(true)}
                  title={getTranslations(settings.language || 'en').sidebar.expandSidebar}
                  aria-label={getTranslations(settings.language || 'en').sidebar.expandSidebar}
                  className="p-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              </div>
            )}

            <StoryMapCanvas
              project={project}
              selectedPassageId={selectedPassageId}
              defaultSnapToGrid={settings.defaultSnapToGrid}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleEditorUndo}
              onRedo={handleEditorRedo}
              onSelectPassage={setSelectedPassageId}
              onMovePassage={movePassage}
              onCreatePassageAt={(x, y) => createPassageAt(x, y)}
              onAutoLayout={autoLayoutPassages}
              onAutoLayoutByColor={autoLayoutByColor}
              onSnapAllToGrid={snapAllNodesToGrid}
              onPlayFromPassage={(id) => {
                setPlaytestProjectId(project.id);
                setPlaytestStartId(id);
              }}
              onOpenFindReplace={() => setFindReplaceOpen(true)}
            />

            {rightSidebarOpen ? (
              <PassageInspector
                project={project}
                passage={selectedPassage}
                onUpdatePassage={updatePassage}
                onDeletePassage={deletePassage}
                onSetStartPassage={(id) => {
                  updateActiveProject((prev) => ({
                    ...prev,
                    updatedAt: new Date().toISOString(),
                    meta: { ...prev.meta, startPassageId: id },
                  }));
                  notify('Updated starting passage.');
                }}
                onPlayFromPassage={(id) => {
                  setPlaytestProjectId(project.id);
                  setPlaytestStartId(id);
                }}
                onCreateConnectedPassage={createConnectedPassage}
                onUploadMediaAsset={handleUploadMediaAsset}
                onCreateCustomColor={handleCreateCustomColor}
                onDeleteCustomColor={handleDeleteCustomColor}
                onCollapse={() => setRightSidebarOpen(false)}
              />
            ) : (
              <div className="w-10 shrink-0 border-l border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col items-center py-3">
                <button
                  type="button"
                  onClick={() => setRightSidebarOpen(true)}
                  title={getTranslations(settings.language || 'en').inspector.expandInspector}
                  aria-label={getTranslations(settings.language || 'en').inspector.expandInspector}
                  className="p-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <PanelRightOpen className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'rpg' && (
          <RpgSystemsView
            genre={project.meta.genre}
            config={project.rpgConfig}
            onUpdateConfig={handleUpdateRpgConfig}
          />
        )}

        {activeTab === 'media' && (
          <MediaVaultView
            assets={project.assets}
            selectedPassage={selectedPassage}
            onUploadMediaAsset={handleUploadMediaAsset}
            onDeleteAsset={handleDeleteAsset}
            onAttachToPassage={handleAttachAssetToSelected}
          />
        )}

        {activeTab === 'story-settings' && (
          <StorySettingsView
            project={project}
            defaultStoryTheme={settings.storyTheme}
            defaultStoryLayout={settings.defaultStoryLayout}
            defaultStoryFont={settings.defaultStoryFont || 'serif-editorial'}
            defaultStoryFontSize={settings.defaultStoryFontSize || 'md'}
            customThemes={settings.customStoryThemes || []}
            onCreateCustomTheme={handleCreateCustomTheme}
            onDeleteCustomTheme={handleDeleteCustomTheme}
            onUpdateMeta={(patch) =>
              updateActiveProject((prev) => ({
                ...prev,
                updatedAt: new Date().toISOString(),
                meta: { ...prev.meta, ...patch },
              }))
            }
          />
        )}

        {activeTab === 'export' && (
          <ExportView
            project={project}
            defaultStoryTheme={settings.storyTheme}
            defaultStoryLayout={settings.defaultStoryLayout}
            defaultStoryFont={settings.defaultStoryFont || 'serif-editorial'}
            defaultStoryFontSize={settings.defaultStoryFontSize || 'md'}
            customThemes={settings.customStoryThemes || []}
            onUpdateMeta={(patch) =>
              updateActiveProject((prev) => ({
                ...prev,
                updatedAt: new Date().toISOString(),
                meta: { ...prev.meta, ...patch },
              }))
            }
            onSaveJson={() => handleSaveJson(project)}
            onImportJson={handleImportJson}
            onOpenProjectsHome={() => setActiveTab('home')}
            onOpenStorySettings={() => setActiveTab('story-settings')}
            onNotify={notify}
          />
        )}
      </main>

      {/* Playtest Overlay */}
      {playtestProjectId && playtestProject && (
        <PlaytestModal
          project={playtestProject}
          storyTheme={playtestProject.meta.storyTheme || settings.storyTheme}
          storyLayout={
            playtestProject.meta.storyLayout ||
            getDefaultLayoutForGenre(playtestProject.meta.genre) ||
            settings.defaultStoryLayout
          }
          storyFont={
            playtestProject.meta.storyFont ||
            settings.defaultStoryFont ||
            'serif-editorial'
          }
          storyFontSize={
            playtestProject.meta.storyFontSize ||
            settings.defaultStoryFontSize ||
            'md'
          }
          customThemes={settings.customStoryThemes || []}
          startPassageId={playtestStartId || playtestProject.meta.startPassageId}
          onUpdateStoryInterface={(patch) =>
            setProjects((prevList) =>
              prevList.map((p) =>
                p.id === playtestProject.id
                  ? {
                      ...p,
                      updatedAt: new Date().toISOString(),
                      meta: { ...p.meta, ...patch },
                    }
                  : p
              )
            )
          }
          onClose={() => setPlaytestProjectId(null)}
        />
      )}

      {/* Global Find & Replace Overlay */}
      {findReplaceOpen && activeTab === 'map' && (
        <FindReplaceModal
          project={project}
          onSelectPassage={setSelectedPassageId}
          onReplaceInPassage={handleReplaceInPassage}
          onReplaceAll={handleReplaceAll}
          onClose={() => setFindReplaceOpen(false)}
          onNotify={notify}
        />
      )}

      {/* Non-blocking Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--accent-primary)]/50 text-xs font-medium text-[var(--text-primary)] shadow-lg"
        >
          {toast}
        </div>
      )}

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />
      </div>
    </LanguageProvider>
  );
}
