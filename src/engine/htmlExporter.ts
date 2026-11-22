import { getGenreDefinition } from '../data/genreTemplates';
import {
  getStoryFontOption,
  getStoryFontSizeOption,
  getStudioThemeOption,
  READER_DARK_TOKENS,
  READER_LIGHT_TOKENS,
  STORY_FONTS,
  STORY_FONT_SIZES,
} from '../data/themes';
import { getTranslations } from '../i18n/translations';
import {
  AppLanguage,
  CustomStoryTheme,
  StoryFontId,
  StoryFontSizeId,
  StoryLayoutId,
  StoryProject,
  StudioThemeId,
} from '../types/story';

async function assetUrlToDataUri(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : url);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Compiles any StoryProject into a single, self-contained, offline-playable HTML file.
 */
export async function compileStandaloneHtml(
  project: StoryProject,
  storyTheme: StudioThemeId = 'obsidian-amber',
  storyLayout: StoryLayoutId = 'rpg-split',
  storyFont: StoryFontId = 'serif-editorial',
  storyFontSize: StoryFontSizeId = 'md',
  customThemes: CustomStoryTheme[] = [],
  language: AppLanguage = 'en'
): Promise<string> {
  // Clone and inline all local/built-in images into base64 data URIs
  const cloned: StoryProject = JSON.parse(JSON.stringify(project));
  await Promise.all(
    cloned.assets.map(async (asset) => {
      if (asset.url && !asset.url.startsWith('data:')) {
        asset.url = await assetUrlToDataUri(asset.url);
      }
    })
  );

  // Safely serialize project JSON for embedding inside <script>
  const serializedProject = JSON.stringify(cloned).replace(/<\//g, '<\\/');

  const title = escapeHtml(cloned.meta.title || 'OTGTAM Story');
  const author = escapeHtml(cloned.meta.author || 'Anonymous');
  const theme = getStudioThemeOption(
    storyTheme,
    customThemes,
    cloned.meta.customStoryTheme
  ).tokens;
  const fontOpt = getStoryFontOption(storyFont);
  const fontSizeOpt = getStoryFontSizeOption(storyFontSize);
  const genreDef = getGenreDefinition(cloned.meta.genre);
  const i18n = getTranslations(language);
  const i18nPlaytestJson = JSON.stringify(i18n.playtest).replace(/<\//g, '<\\/');
  const i18nCommonJson = JSON.stringify(i18n.common).replace(/<\//g, '<\\/');
  const i18nRuntimeJson = JSON.stringify(i18n.runtime).replace(/<\//g, '<\\/');
  const hudLabelsJson = JSON.stringify(genreDef.hudLabels).replace(/<\//g, '<\\/');
  const fontOptionsHtml = STORY_FONTS.map(
    (f) =>
      `<option value="${escapeHtml(f.id)}"${
        f.id === fontOpt.id ? ' selected' : ''
      }>${escapeHtml(i18n.playtest.fontPrefix)}: ${escapeHtml(f.name)}</option>`
  ).join('');
  const fontSizeOptionsHtml = STORY_FONT_SIZES.map(
    (sz) =>
      `<option value="${escapeHtml(sz.id)}"${
        sz.id === fontSizeOpt.id ? ' selected' : ''
      }>${escapeHtml(i18n.playtest.sizePrefix)}: ${escapeHtml(i18n.storyFontSizes[sz.id]?.name ?? sz.name)} (${escapeHtml(sz.label)})</option>`
  ).join('');
  const fontMapJson = JSON.stringify(
    Object.fromEntries(STORY_FONTS.map((f) => [f.id, f.cssFamily]))
  ).replace(/<\//g, '<\\/');
  const fontSizeMapJson = JSON.stringify(
    Object.fromEntries(
      STORY_FONT_SIZES.map((sz) => [
        sz.id,
        { size: sz.cssSize, lineHeight: sz.lineHeight },
      ])
    )
  ).replace(/<\//g, '<\\/');
  const defaultThemeMapJson = JSON.stringify({
    bg: theme.bg,
    surface: theme.surface,
    elevated: theme.elevated,
    hover: theme.hover,
    border: theme.border,
    text: theme.text,
    textSecondary: theme.textSecondary,
    muted: theme.muted,
    accent: theme.accent,
    accentHover: theme.accentHover,
    accentContrast: theme.accentContrast,
  }).replace(/<\//g, '<\\/');
  const readerModeOptionsHtml = [
    `<option value="default">${escapeHtml(i18n.playtest.readerModeDefault)}</option>`,
    `<option value="light">${escapeHtml(i18n.playtest.readerModeLight)}</option>`,
    `<option value="dark">${escapeHtml(i18n.playtest.readerModeDark)}</option>`,
  ].join('');

  return `<!doctype html>
<html lang="${escapeHtml(language)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — OTGTAM Interactive Story</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&family=Lora:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: ${theme.bg};
      --surface: ${theme.surface};
      --elevated: ${theme.elevated};
      --hover: ${theme.hover};
      --border: ${theme.border};
      --text: ${theme.text};
      --text-secondary: ${theme.textSecondary};
      --muted: ${theme.muted};
      --accent: ${theme.accent};
      --accent-hover: ${theme.accentHover};
      --accent-contrast: ${theme.accentContrast};
      --story-font: ${fontOpt.cssFamily};
      --story-font-size: ${fontSizeOpt.cssSize};
      --story-line-height: ${fontSizeOpt.lineHeight};
      --emerald: #10B981;
      --crimson: #EF4444;
      --sky: #38BDF8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 24px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 20;
      flex-wrap: wrap;
    }
    .brand { font-weight: 700; font-size: 16px; }
    .meta-sub { color: var(--muted); font-size: 13px; margin-left: 10px; }
    .hdr-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    select.reader-select {
      font-family: inherit;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      padding: 7px 10px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    select.reader-select:focus {
      outline: none;
      border-color: var(--accent);
    }
    button {
      font-family: inherit;
      cursor: pointer;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--elevated);
      color: var(--text);
      padding: 8px 13px;
      font-size: 13px;
      font-weight: 500;
      transition: background 150ms ease, border-color 150ms ease, transform 120ms ease;
    }
    button:hover:not(:disabled) { border-color: var(--muted); background: var(--hover); }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    button.primary {
      background: var(--accent);
      color: var(--accent-contrast);
      border-color: var(--accent);
      font-weight: 600;
    }
    button.primary:hover:not(:disabled) { background: var(--accent-hover); }
    #btn-sheet { display: none; }
    main {
      width: 100%;
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px;
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 24px;
      flex: 1;
      align-items: start;
    }
    @media (max-width: 900px) {
      main { grid-template-columns: 1fr; padding: 16px; }
      #btn-sheet { display: inline-flex; }
      body[data-layout="rpg-split"] .hud-card,
      body[data-layout="dossier-left"] .hud-card { display: none; }
      body[data-layout="rpg-split"] main.hud-open .hud-card,
      body[data-layout="dossier-left"] main.hud-open .hud-card { display: flex; }
    }

    /* Layout Variant: Dossier Left */
    body[data-layout="dossier-left"] main {
      grid-template-columns: 320px 1fr;
    }
    body[data-layout="dossier-left"] .hud-card { order: 1; border-radius: 6px; }
    body[data-layout="dossier-left"] .story-card { order: 2; border-radius: 6px; }
    body[data-layout="dossier-left"] .choice-btn { border-radius: 6px; }
    @media (max-width: 900px) {
      body[data-layout="dossier-left"] main { grid-template-columns: 1fr; }
      body[data-layout="dossier-left"] .story-card { order: 1; }
      body[data-layout="dossier-left"] .hud-card { order: 2; }
    }

    /* Layout Variant: Editorial Blog & Novel */
    body[data-layout="blog-journal"] #btn-sheet { display: inline-flex; }
    body[data-layout="blog-journal"] main {
      max-width: 780px;
      grid-template-columns: 1fr;
    }
    body[data-layout="blog-journal"] .hud-card {
      display: none;
      order: -1;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 18px;
    }
    body[data-layout="blog-journal"] main.hud-open .hud-card {
      display: grid;
    }
    body[data-layout="blog-journal"] .story-body { padding: 36px; }
    @media (max-width: 640px) {
      body[data-layout="blog-journal"] .story-body { padding: 22px; }
    }

    /* Layout Variant: Cinematic Theater */
    body[data-layout="cinematic-stage"] #btn-sheet { display: inline-flex; }
    body[data-layout="cinematic-stage"] main {
      max-width: 920px;
      grid-template-columns: 1fr;
    }
    body[data-layout="cinematic-stage"] .hud-card {
      display: none;
      order: -1;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 18px;
    }
    body[data-layout="cinematic-stage"] main.hud-open .hud-card {
      display: grid;
    }
    body[data-layout="cinematic-stage"] .scene-hero {
      aspect-ratio: 16 / 8;
      max-height: 400px;
    }
    body[data-layout="cinematic-stage"] .scene-title-overlay { text-align: center; }
    body[data-layout="cinematic-stage"] .choices {
      max-width: 600px;
      margin: 0 auto;
    }

    /* Layout Variant: Sci-Fi Console HUD */
    body[data-layout="terminal-hud"] main {
      max-width: 1020px;
      grid-template-columns: 1fr;
    }
    body[data-layout="terminal-hud"] .hud-card {
      order: -1;
      border-radius: 6px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 18px;
    }
    body[data-layout="terminal-hud"] .story-card { border-radius: 6px; }
    body[data-layout="terminal-hud"] .choice-btn {
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 14px;
    }

    .story-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .scene-hero {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 7;
      max-height: 340px;
      overflow: hidden;
      background: var(--bg);
    }
    .scene-hero img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .scene-scrim {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, var(--surface) 4%, transparent 100%);
    }
    .scene-title-overlay {
      position: absolute;
      bottom: 16px;
      left: 24px;
      right: 24px;
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      color: var(--text);
      font-family: var(--story-font);
    }
    .passage-title-plain {
      margin: 0;
      font-family: var(--story-font);
    }
    .story-body { padding: 24px; }
    .prose {
      font-family: var(--story-font);
      font-size: var(--story-font-size);
      line-height: var(--story-line-height);
      color: var(--text);
      white-space: pre-wrap;
      text-align: left;
      margin: 0 0 16px 0;
    }
    .prose-quote {
      font-family: var(--story-font);
      font-size: var(--story-font-size);
      line-height: var(--story-line-height);
      border-left: 3px solid var(--accent);
      padding: 4px 14px;
      margin: 14px 0;
      font-style: italic;
      color: var(--text-secondary);
      white-space: pre-wrap;
      text-align: left;
    }
    .prose-hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 18px 0;
    }
    .prose code, .prose-quote code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: var(--elevated);
      border: 1px solid var(--border);
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 0.88em;
    }
    .notice-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 18px;
      font-size: 13px;
      color: var(--accent);
      font-family: ui-monospace, monospace;
    }
    .panel-box {
      background: var(--elevated);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 18px;
    }
    .panel-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      margin: 0 0 10px 0;
    }
    .choices { display: flex; flex-direction: column; gap: 10px; }
    .choice-btn {
      width: 100%;
      text-align: left;
      padding: 12px 16px;
      font-size: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: var(--accent);
      color: var(--accent-contrast);
      border-color: var(--accent);
    }
    .choice-btn:hover:not(:disabled) {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }
    .choice-btn:disabled {
      background: var(--elevated);
      color: var(--muted);
      border-color: var(--border);
      opacity: 0.65;
    }
    .choice-req {
      font-size: 12px;
      opacity: 0.9;
      font-family: ui-monospace, monospace;
    }
    .passage-actions {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .hud-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      height: fit-content;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .hud-section-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      margin: 0 0 10px 0;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
    }
    .stat-row { margin-bottom: 10px; }
    .stat-head {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .mono { font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; }
    .bar-track {
      width: 100%;
      height: 7px;
      background: var(--bg);
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .bar-fill {
      height: 100%;
      background: var(--emerald);
      transition: width 200ms ease;
    }
    .combat-grid {
      display: flex;
      gap: 16px;
      align-items: center;
      margin-bottom: 14px;
    }
    .combat-portrait {
      width: 72px;
      height: 72px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid var(--border);
    }
    .combat-log {
      max-height: 120px;
      overflow-y: auto;
      font-size: 13px;
      color: var(--text-secondary);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 12px;
    }
    .combat-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .inv-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      padding: 6px 0;
      border-bottom: 1px solid var(--border);
    }
    .inv-row:last-child { border-bottom: none; }
    .inline-figure {
      margin: 20px auto;
      max-width: 100%;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg);
      container-type: inline-size;
    }
    .inline-figure img {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 9px 9px 0 0;
    }
    .inline-figure.no-caption img {
      border-radius: 9px;
    }
    .inline-figure figcaption {
      padding: clamp(4px, 1.8cqi, 8px) clamp(6px, 2.5cqi, 14px);
      font-size: clamp(9.5px, calc(7px + 1.3cqi), 14px);
      line-height: 1.4;
      text-align: center;
      color: var(--muted);
      border-top: 1px solid var(--border);
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      overflow: visible;
    }
  </style>
</head>
<body data-layout="${storyLayout}">
  <header>
    <div>
      <span class="brand">${title}</span>
      <span class="meta-sub">by ${author}</span>
    </div>
    <div class="hdr-actions">
      <select id="select-reader-mode" class="reader-select" aria-label="Reader Appearance Mode">${readerModeOptionsHtml}</select>
      <select id="select-font-family" class="reader-select" aria-label="Story Font Family">${fontOptionsHtml}</select>
      <select id="select-font-size" class="reader-select" aria-label="Story Font Size">${fontSizeOptionsHtml}</select>
      <button id="btn-save-game">${escapeHtml(i18n.playtest.saveGame)}</button>
      <button id="btn-load-game">${escapeHtml(i18n.playtest.loadGame)}</button>
      <input id="load-game-input" type="file" accept=".json,application/json" style="display:none" />
      <button id="btn-sheet">${escapeHtml(i18n.playtest.storySheet)}</button>
      <button id="btn-mute">${escapeHtml(i18n.playtest.soundOn)}</button>
      <button id="btn-restart" class="primary">${escapeHtml(i18n.playtest.restartStory)}</button>
    </div>
  </header>

  <main id="story-main">
    <section class="story-card" id="story-stage"></section>
    <aside class="hud-card" id="rpg-hud"></aside>
  </main>

  <script>
    const PROJECT = ${serializedProject};
    const HUD_LABELS = ${hudLabelsJson};
    const I18N_PLAYTEST = ${i18nPlaytestJson};
    const I18N_COMMON = ${i18nCommonJson};
    const I18N_RUNTIME = ${i18nRuntimeJson};
    const STORY_LAYOUT = ${JSON.stringify(storyLayout)};
    const AUTOSAVE_KEY = 'otgtam_autosave_' + PROJECT.id;
    const FONT_MAP = ${fontMapJson};
    const FONT_SIZE_MAP = ${fontSizeMapJson};
    const DEFAULT_FONT_ID = ${JSON.stringify(fontOpt.id)};
    const DEFAULT_FONT_SIZE_ID = ${JSON.stringify(fontSizeOpt.id)};

    // Lightweight embedded Web Audio synth
    const Synth = (() => {
      let ctx = null;
      let gain = null;
      let muted = false;
      let ambNodes = [];
      let ambTimer = null;
      let ambStopTimeout = null;
      let ambEl = null;
      let activeAmbId = null;
      let activeAmbLoop = true;

      function ensure() {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        if (!ctx) {
          ctx = new Ctx();
          gain = ctx.createGain();
          gain.gain.value = muted ? 0 : 0.6;
          gain.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
      }

      function setMuted(m) {
        muted = m;
        if (gain && ctx) gain.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.04);
        if (ambEl) ambEl.muted = m;
      }

      function stopAmb() {
        if (ambTimer) { clearInterval(ambTimer); ambTimer = null; }
        if (ambStopTimeout) { clearTimeout(ambStopTimeout); ambStopTimeout = null; }
        ambNodes.forEach(n => { try { n.stop && n.stop(); n.disconnect(); } catch {} });
        ambNodes = [];
        if (ambEl) { ambEl.pause(); ambEl = null; }
        activeAmbId = null;
      }

      function playSfx(id) {
        if (!id) return;
        const asset = PROJECT.assets.find(a => a.id === id);
        if (!asset) return;
        if (asset.source === 'upload' && asset.url) {
          const el = new Audio(asset.url);
          el.volume = muted ? 0 : 0.65;
          el.play().catch(() => {});
          return;
        }
        const c = ensure();
        if (!c || !gain) return;
        const now = c.currentTime;
        const preset = asset.synthPreset || 'sfx_discovery';
        if (preset === 'sfx_dice_roll') {
          [0,0.06,0.13,0.2].forEach((off, idx) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(220 + idx*45, now+off);
            o.frequency.exponentialRampToValueAtTime(95, now+off+0.045);
            g.gain.setValueAtTime(0.25, now+off); g.gain.exponentialRampToValueAtTime(0.001, now+off+0.05);
            o.connect(g); g.connect(gain); o.start(now+off); o.stop(now+off+0.055);
          });
        } else if (preset === 'sfx_damage_hit') {
          const o = c.createOscillator(), g = c.createGain();
          o.type = 'triangle'; o.frequency.setValueAtTime(140, now);
          o.frequency.exponentialRampToValueAtTime(42, now+0.18);
          g.gain.setValueAtTime(0.35, now); g.gain.exponentialRampToValueAtTime(0.001, now+0.2);
          o.connect(g); g.connect(gain); o.start(now); o.stop(now+0.22);
        } else if (preset === 'sfx_laser_zap') {
          const o = c.createOscillator(), g = c.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(1180, now);
          o.frequency.exponentialRampToValueAtTime(140, now+0.18);
          g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.001, now+0.19);
          o.connect(g); g.connect(gain); o.start(now); o.stop(now+0.2);
        } else if (preset === 'sfx_terminal_hack') {
          [988, 1318, 1175, 1760].forEach((f, i) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'square'; o.frequency.setValueAtTime(f, now+i*0.045);
            g.gain.setValueAtTime(0.08, now+i*0.045); g.gain.exponentialRampToValueAtTime(0.001, now+i*0.045+0.06);
            o.connect(g); g.connect(gain); o.start(now+i*0.045); o.stop(now+i*0.045+0.065);
          });
        } else if (preset === 'sfx_horror_scare') {
          [110, 116.5, 233, 311].forEach(f => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(f, now);
            g.gain.setValueAtTime(0.14, now); g.gain.exponentialRampToValueAtTime(0.001, now+0.55);
            o.connect(g); g.connect(gain); o.start(now); o.stop(now+0.58);
          });
        } else if (preset === 'sfx_noir_sting') {
          [293.66, 349.23, 415.3, 523.25].forEach((f, i) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(f, now+i*0.06);
            g.gain.setValueAtTime(0.14, now+i*0.06); g.gain.exponentialRampToValueAtTime(0.001, now+i*0.06+0.5);
            o.connect(g); g.connect(gain); o.start(now+i*0.06); o.stop(now+i*0.06+0.52);
          });
        } else if (preset === 'sfx_heart_chime') {
          [523.25, 659.25, 987.77, 1318.51].forEach((f, i) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'sine'; o.frequency.setValueAtTime(f, now+i*0.085);
            g.gain.setValueAtTime(0.12, now+i*0.085); g.gain.exponentialRampToValueAtTime(0.001, now+i*0.085+0.42);
            o.connect(g); g.connect(gain); o.start(now+i*0.085); o.stop(now+i*0.085+0.45);
          });
        } else if (preset === 'sfx_camera_shutter' || preset === 'sfx_lock_click') {
          [1600, 1100].forEach((f, i) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(f, now+i*0.05);
            o.frequency.exponentialRampToValueAtTime(240, now+i*0.05+0.03);
            g.gain.setValueAtTime(0.2, now+i*0.05); g.gain.exponentialRampToValueAtTime(0.001, now+i*0.05+0.04);
            o.connect(g); g.connect(gain); o.start(now+i*0.05); o.stop(now+i*0.05+0.045);
          });
        } else {
          [440, 554.37, 659.25].forEach((freq, i) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'sine'; o.frequency.setValueAtTime(freq, now + i*0.07);
            g.gain.setValueAtTime(0.14, now + i*0.07);
            g.gain.exponentialRampToValueAtTime(0.001, now + i*0.07 + 0.28);
            o.connect(g); g.connect(gain); o.start(now + i*0.07); o.stop(now + i*0.07 + 0.3);
          });
        }
      }

      function playAmb(id, loop = true) {
        if (!id) { stopAmb(); return; }
        if (loop && activeAmbId === id && activeAmbLoop) return;
        stopAmb();
        const asset = PROJECT.assets.find(a => a.id === id);
        if (!asset) return;
        activeAmbId = id;
        activeAmbLoop = loop;
        if (asset.source === 'upload' && asset.url) {
          ambEl = new Audio(asset.url);
          ambEl.loop = loop;
          ambEl.muted = muted;
          ambEl.volume = 0.4;
          if (!loop) {
            ambEl.addEventListener('ended', () => { stopAmb(); });
          }
          ambEl.play().catch(() => {});
          return;
        }
        const c = ensure();
        if (!c || !gain) return;
        const now = c.currentTime;
        const preset = asset.synthPreset || 'amb_dungeon_drone';
        const activeGains = [];
        if (preset === 'amb_clockwork_tick') {
          let tog = false;
          ambTimer = setInterval(() => {
            if (muted) return;
            const t = c.currentTime;
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'triangle';
            o.frequency.setValueAtTime(tog ? 1100 : 860, t);
            o.frequency.exponentialRampToValueAtTime(220, t + 0.025);
            g.gain.setValueAtTime(0.05, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            o.connect(g); g.connect(gain); o.start(t); o.stop(t + 0.035);
            tog = !tog;
          }, 750);
        } else if (preset === 'amb_heartbeat_panic') {
          const pulse = () => {
            if (muted) return;
            const t = c.currentTime;
            [0, 0.22].forEach((off, idx) => {
              const o = c.createOscillator(), g = c.createGain();
              o.type = 'sine';
              o.frequency.setValueAtTime(idx === 0 ? 78 : 64, t + off);
              o.frequency.exponentialRampToValueAtTime(34, t + off + 0.14);
              g.gain.setValueAtTime(idx === 0 ? 0.2 : 0.14, t + off);
              g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.16);
              o.connect(g); g.connect(gain); o.start(t + off); o.stop(t + off + 0.17);
            });
          };
          pulse();
          ambTimer = setInterval(pulse, 1250);
        } else {
          const freqs = preset === 'amb_romance_piano'
            ? [261.63, 329.63, 392.0, 493.88]
            : preset === 'amb_noir_jazz'
            ? [146.83, 174.61, 220.0, 261.63]
            : preset === 'amb_starship_hum'
            ? [55, 82.41, 164.81]
            : preset === 'amb_horror_dread'
            ? [48.99, 51.91, 98.0]
            : preset === 'amb_observatory_chimes'
            ? [220, 329.63]
            : [73.42, 110];
          freqs.forEach(freq => {
            const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
            o.type = preset === 'amb_horror_dread' || preset === 'amb_starship_hum' ? 'sawtooth' : 'sine';
            o.frequency.value = freq;
            f.type = 'lowpass'; f.frequency.value = 380;
            g.gain.setValueAtTime(0.03, now);
            o.connect(f); f.connect(g); g.connect(gain); o.start(now);
            ambNodes.push(o, f, g);
            activeGains.push(g);
          });
        }
        if (!loop) {
          ambStopTimeout = setTimeout(() => {
            activeGains.forEach(g => { try { g.gain.setTargetAtTime(0.0001, c.currentTime, 0.25); } catch {} });
            ambStopTimeout = setTimeout(() => { stopAmb(); }, 700);
          }, 5500);
        }
      }

      return { setMuted, isMuted: () => muted, playSfx, playAmb };
    })();

    let session = null;

    function saveAutoCheckpoint() {
      try {
        if (!session) return;
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(session));
      } catch {}
    }

    function clearAutoCheckpoint() {
      try {
        localStorage.removeItem(AUTOSAVE_KEY);
      } catch {}
    }

    function cloneSnapshot(s) {
      return {
        currentPassageId: s.currentPassageId,
        history: [...(s.history || [])],
        stats: { ...(s.stats || {}) },
        inventory: { ...(s.inventory || {}) },
        quests: { ...(s.quests || {}) },
        factions: { ...(s.factions || {}) },
        flags: { ...(s.flags || {}) },
        visitedPassageIds: [...(s.visitedPassageIds || s.history || [])],
        notifications: [...(s.notifications || [])],
        lastRoll: s.lastRoll ? JSON.parse(JSON.stringify(s.lastRoll)) : null,
        combat: s.combat ? JSON.parse(JSON.stringify(s.combat)) : null
      };
    }

    function initSession() {
      clearAutoCheckpoint();
      const stats = {};
      PROJECT.rpgConfig.stats.forEach(s => stats[s.id] = s.initial);
      const quests = {};
      PROJECT.rpgConfig.quests.forEach(q => quests[q.id] = q.initialStatus);
      const factions = {};
      PROJECT.rpgConfig.factions.forEach(f => factions[f.id] = f.initialReputation);
      const flags = {};
      (PROJECT.rpgConfig.flags || []).forEach(fl => flags[fl.id] = Boolean(fl.initialValue));
      session = {
        currentPassageId: PROJECT.meta.startPassageId,
        history: [PROJECT.meta.startPassageId],
        stats,
        inventory: {},
        quests,
        factions,
        flags,
        visitedPassageIds: [PROJECT.meta.startPassageId],
        notifications: [],
        lastRoll: null,
        combat: null,
        undoStack: []
      };
      enterPassage(PROJECT.meta.startPassageId, true);
    }

    function applyEffects(effects) {
      (effects || []).forEach(ef => {
        if (ef.kind === 'stat') {
          const def = PROJECT.rpgConfig.stats.find(s => s.id === ef.statId);
          const cur = session.stats[ef.statId] ?? (def ? def.initial : 0);
          let next = ef.operation === 'set' ? ef.value : cur + ef.value;
          if (def) next = Math.max(def.min, Math.min(def.max, next));
          session.stats[ef.statId] = next;
          const label = def ? def.name : ef.statId;
          if (ef.operation === 'set') {
            session.notifications.push(label + ' ' + I18N_RUNTIME.setTo + ' ' + next);
          } else if (ef.value !== 0) {
            session.notifications.push(label + (ef.value > 0 ? ' +' : ' ') + ef.value);
          }
        } else if (ef.kind === 'item') {
          const def = PROJECT.rpgConfig.items.find(i => i.id === ef.itemId);
          const qty = Math.max(1, ef.quantity || 1);
          if (ef.operation === 'give') {
            session.inventory[ef.itemId] = (session.inventory[ef.itemId] || 0) + qty;
            session.notifications.push(I18N_RUNTIME.received + ' ' + qty + 'x ' + (def ? def.name : ef.itemId));
          } else {
            const rem = Math.max(0, (session.inventory[ef.itemId] || 0) - qty);
            if (rem === 0) delete session.inventory[ef.itemId];
            else session.inventory[ef.itemId] = rem;
            session.notifications.push(I18N_RUNTIME.removed + ' ' + qty + 'x ' + (def ? def.name : ef.itemId));
          }
        } else if (ef.kind === 'quest') {
          const def = PROJECT.rpgConfig.quests.find(q => q.id === ef.questId);
          session.quests[ef.questId] = ef.status;
          session.notifications.push(I18N_RUNTIME.questLabel + ' ' + ef.status + ': ' + (def ? def.title : ef.questId));
        } else if (ef.kind === 'faction') {
          const def = PROJECT.rpgConfig.factions.find(f => f.id === ef.factionId);
          const cur = session.factions[ef.factionId] ?? (def ? def.initialReputation : 0);
          session.factions[ef.factionId] = cur + ef.delta;
          session.notifications.push((def ? def.name : ef.factionId) + ' ' + I18N_RUNTIME.standing + ' ' + (ef.delta >= 0 ? '+' : '') + ef.delta);
        } else if (ef.kind === 'flag') {
          const def = (PROJECT.rpgConfig.flags || []).find(fl => fl.id === ef.flagId);
          session.flags = session.flags || {};
          session.flags[ef.flagId] = Boolean(ef.value);
          session.notifications.push(I18N_RUNTIME.flagLabel + ': ' + (def ? def.name : ef.flagId) + ' = ' + (ef.value ? I18N_RUNTIME.trueLabel : I18N_RUNTIME.falseLabel));
        }
      });
    }

    function evalCondition(rule) {
      if (!rule) return true;
      if (rule.kind === 'stat_gte') return (session.stats[rule.statId] ?? 0) >= rule.value;
      if (rule.kind === 'stat_lte') return (session.stats[rule.statId] ?? 0) <= rule.value;
      if (rule.kind === 'has_item') return (session.inventory[rule.itemId] || 0) > 0;
      if (rule.kind === 'quest_status') return session.quests[rule.questId] === rule.status;
      if (rule.kind === 'faction_gte') return (session.factions[rule.factionId] || 0) >= rule.value;
      if (rule.kind === 'flag_is') return Boolean(session.flags && session.flags[rule.flagId]) === Boolean(rule.value);
      if (rule.kind === 'visited_passage') {
        const list = session.visitedPassageIds || session.history || [];
        return list.includes(rule.passageId) === Boolean(rule.visited);
      }
      return true;
    }

    function formatCond(rule) {
      if (!rule) return '';
      if (rule.kind === 'has_item') {
        const it = PROJECT.rpgConfig.items.find(i => i.id === rule.itemId);
        return 'Item: ' + (it ? it.name : rule.itemId);
      }
      if (rule.kind === 'stat_gte') {
        const st = PROJECT.rpgConfig.stats.find(s => s.id === rule.statId);
        return (st ? st.name : rule.statId) + ' \\u2265 ' + rule.value;
      }
      if (rule.kind === 'stat_lte') {
        const st = PROJECT.rpgConfig.stats.find(s => s.id === rule.statId);
        return (st ? st.name : rule.statId) + ' \\u2264 ' + rule.value;
      }
      if (rule.kind === 'quest_status') {
        const q = PROJECT.rpgConfig.quests.find(x => x.id === rule.questId);
        return I18N_RUNTIME.questLabel + ' "' + (q ? q.title : rule.questId) + '": ' + rule.status;
      }
      if (rule.kind === 'faction_gte') {
        const f = PROJECT.rpgConfig.factions.find(x => x.id === rule.factionId);
        return (f ? f.name : rule.factionId) + ' \\u2265 ' + rule.value;
      }
      if (rule.kind === 'flag_is') {
        const fl = (PROJECT.rpgConfig.flags || []).find(x => x.id === rule.flagId);
        return (fl ? fl.name : rule.flagId) + ' = ' + (rule.value ? I18N_RUNTIME.trueLabel : I18N_RUNTIME.falseLabel);
      }
      if (rule.kind === 'visited_passage') {
        const tp = PROJECT.passages[rule.passageId];
        return (rule.visited ? '\\u2713 ' : '\\u2715 ') + (tp ? tp.title : rule.passageId);
      }
      return '';
    }

    function interpolateStoryText(text) {
      if (!text) return '';
      let out = String(text).replace(/\\{\\{if\\s+(flag|item|visited):([^}]+)\\}\\}([\\s\\S]*?)\\{\\{\\/if\\}\\}/gi, function(_m, kindRaw, keyRaw, inner) {
        const kind = kindRaw.toLowerCase();
        const key = keyRaw.trim().toLowerCase();
        if (kind === 'flag') {
          const def = (PROJECT.rpgConfig.flags || []).find(f => f.id.toLowerCase() === key || f.name.toLowerCase() === key);
          const id = def ? def.id : keyRaw.trim();
          return (session.flags && session.flags[id]) ? inner : '';
        }
        if (kind === 'item') {
          const def = PROJECT.rpgConfig.items.find(i => i.id.toLowerCase() === key || i.name.toLowerCase() === key);
          const id = def ? def.id : keyRaw.trim();
          return (session.inventory[id] || 0) > 0 ? inner : '';
        }
        if (kind === 'visited') {
          const vals = Object.values(PROJECT.passages);
          const node = vals.find(p => p.id.toLowerCase() === key || (p.title || '').toLowerCase() === key);
          const pid = node ? node.id : keyRaw.trim();
          const list = session.visitedPassageIds || session.history || [];
          return list.includes(pid) ? inner : '';
        }
        return '';
      });

      out = out.replace(/\\{\\{([^}]+)\\}\\}/g, function(match, exprRaw) {
        const expr = exprRaw.trim();
        const lower = expr.toLowerCase();
        if (lower === 'title') return PROJECT.meta.title || '';
        if (lower === 'author') return PROJECT.meta.author || '';
        const colonIdx = expr.indexOf(':');
        if (colonIdx === -1) return match;
        const kind = expr.slice(0, colonIdx).trim().toLowerCase();
        const target = expr.slice(colonIdx + 1).trim();
        const tLower = target.toLowerCase();
        if (kind === 'stat') {
          const def = PROJECT.rpgConfig.stats.find(s => s.id.toLowerCase() === tLower || s.name.toLowerCase() === tLower);
          const id = def ? def.id : target;
          return String(session.stats[id] ?? (def ? def.initial : 0));
        }
        if (kind === 'item') {
          const def = PROJECT.rpgConfig.items.find(i => i.id.toLowerCase() === tLower || i.name.toLowerCase() === tLower);
          const id = def ? def.id : target;
          return String(session.inventory[id] || 0);
        }
        if (kind === 'flag') {
          const def = (PROJECT.rpgConfig.flags || []).find(f => f.id.toLowerCase() === tLower || f.name.toLowerCase() === tLower);
          const id = def ? def.id : target;
          return (session.flags && session.flags[id]) ? I18N_RUNTIME.trueLabel : I18N_RUNTIME.falseLabel;
        }
        return match;
      });
      return out;
    }

    function formatInlineRich(text) {
      const regex = /(\\*{2}[^*]+\\*{2}|\\*[^*\\n]+\\*|\`[^\`\\n]+\`)/g;
      let html = '';
      let last = 0;
      let m;
      while ((m = regex.exec(text)) !== null) {
        if (m.index > last) html += escapeHtml(text.slice(last, m.index));
        const tok = m[0];
        if (tok.startsWith('**') && tok.endsWith('**')) {
          html += '<strong>' + escapeHtml(tok.slice(2, -2)) + '</strong>';
        } else if (tok.startsWith('*') && tok.endsWith('*')) {
          html += '<em>' + escapeHtml(tok.slice(1, -1)) + '</em>';
        } else if (tok.startsWith('\`') && tok.endsWith('\`')) {
          html += '<code>' + escapeHtml(tok.slice(1, -1)) + '</code>';
        }
        last = m.index + tok.length;
      }
      if (last < text.length) html += escapeHtml(text.slice(last));
      return html;
    }

    function renderRichText(raw) {
      const text = interpolateStoryText(raw);
      const lines = text.split('\\n');
      let out = '';
      let para = [];
      function flush() {
        if (para.length > 0) {
          const joined = para.join('\\n').trim();
          if (joined) out += '<p class="prose">' + formatInlineRich(joined) + '</p>';
          para = [];
        }
      }
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const tr = line.trim();
        if (tr === '---' || tr === '***') {
          flush();
          out += '<hr class="prose-hr" />';
        } else if (tr.startsWith('> ')) {
          flush();
          out += '<blockquote class="prose-quote">' + formatInlineRich(tr.slice(2)) + '</blockquote>';
        } else if (tr === '') {
          flush();
        } else {
          para.push(line);
        }
      }
      flush();
      return out;
    }

    function enterPassage(id, isInitial = false) {
      const p = PROJECT.passages[id];
      if (!p) return;
      if (!isInitial) {
        session.undoStack = [...(session.undoStack || []), cloneSnapshot(session)].slice(-60);
        session.history = [...(session.history || []), id];
        const prevVisited = session.visitedPassageIds || session.history;
        if (!prevVisited.includes(id)) {
          session.visitedPassageIds = [...prevVisited, id];
        } else {
          session.visitedPassageIds = [...prevVisited];
        }
      } else {
        session.undoStack = [];
        session.history = [id];
        session.visitedPassageIds = [id];
      }
      session.currentPassageId = id;
      session.notifications = [];
      session.lastRoll = null;
      session.combat = null;
      applyEffects(p.entryEffects);
      if (p.combat) {
        session.combat = {
          ...p.combat,
          enemyHp: p.combat.enemyMaxHp,
          defending: false,
          resolved: 'ongoing',
          log: [p.combat.enemyName + ' ' + I18N_RUNTIME.blocksPath + ' (' + p.combat.enemyMaxHp + ' HP).']
        };
      }
      Synth.playAmb(p.ambientAudioId, p.ambientLoop !== false);
      if (p.entrySfxId) Synth.playSfx(p.entrySfxId);
      saveAutoCheckpoint();
      render();
    }

    function undoChoice() {
      const stack = session.undoStack || [];
      if (stack.length === 0) return;
      const prev = stack[stack.length - 1];
      session = {
        ...prev,
        flags: prev.flags ? { ...prev.flags } : {},
        visitedPassageIds: prev.visitedPassageIds ? [...prev.visitedPassageIds] : [...(prev.history || [])],
        notifications: [I18N_RUNTIME.undidChoice],
        undoStack: stack.slice(0, -1)
      };
      const p = PROJECT.passages[session.currentPassageId];
      if (p) Synth.playAmb(p.ambientAudioId, p.ambientLoop !== false);
      saveAutoCheckpoint();
      render();
    }

    function saveGameJson() {
      const payload = {
        format: 'otgtam_save_v1',
        projectId: PROJECT.id,
        projectTitle: PROJECT.meta.title,
        savedAt: new Date().toISOString(),
        session
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const slug = (PROJECT.meta.title || 'story').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = (slug || 'story') + '.save.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      session.notifications = [I18N_RUNTIME.savedGame];
      render();
    }

    function loadGameJson(file) {
      const reader = new FileReader();
      reader.onload = function() {
        try {
          const parsed = JSON.parse(String(reader.result));
          const candidate = parsed && parsed.format === 'otgtam_save_v1' && parsed.session ? parsed.session : parsed;
          if (!candidate || !candidate.currentPassageId || !PROJECT.passages[candidate.currentPassageId]) {
            session.notifications = [I18N_RUNTIME.invalidSave];
            render();
            return;
          }
          const hist = Array.isArray(candidate.history) ? candidate.history : [candidate.currentPassageId];
          session = {
            currentPassageId: candidate.currentPassageId,
            history: hist,
            stats: candidate.stats || {},
            inventory: candidate.inventory || {},
            quests: candidate.quests || {},
            factions: candidate.factions || {},
            flags: candidate.flags || {},
            visitedPassageIds: Array.isArray(candidate.visitedPassageIds) ? candidate.visitedPassageIds : Array.from(new Set(hist)),
            notifications: [I18N_RUNTIME.loadedGame],
            lastRoll: candidate.lastRoll || null,
            combat: candidate.combat || null,
            undoStack: Array.isArray(candidate.undoStack) ? candidate.undoStack : []
          };
          const p = PROJECT.passages[session.currentPassageId];
          if (p) Synth.playAmb(p.ambientAudioId, p.ambientLoop !== false);
          saveAutoCheckpoint();
          render();
        } catch {
          session.notifications = [I18N_RUNTIME.invalidSave];
          render();
        }
      };
      reader.readAsText(file);
    }

    function rollCheck() {
      const p = PROJECT.passages[session.currentPassageId];
      if (!p || !p.skillCheck) return;
      const sc = p.skillCheck;
      Synth.playSfx('sfx_dice');
      const raw = sc.dice === '2d6'
        ? [1 + Math.floor(Math.random()*6), 1 + Math.floor(Math.random()*6)]
        : sc.dice === 'd100'
        ? [1 + Math.floor(Math.random()*100)]
        : [1 + Math.floor(Math.random()*20)];
      const mod = session.stats[sc.statId] || 0;
      const total = raw.reduce((a,b) => a+b, 0) + mod;
      const passed = total >= sc.difficulty;
      applyEffects(passed ? sc.successEffects : sc.failureEffects);
      session.lastRoll = {
        raw, mod, total, difficulty: sc.difficulty, passed,
        nextPassageId: passed ? sc.successPassageId : sc.failurePassageId
      };
      saveAutoCheckpoint();
      render();
    }

    function combatAct(act, itemId) {
      const c = session.combat;
      if (!c || c.resolved !== 'ongoing') return;
      c.defending = false;
      const hpDef = PROJECT.rpgConfig.stats.find(s => s.id === c.playerHpStatId);
      let playerHp = session.stats[c.playerHpStatId] ?? 20;
      const maxHp = hpDef ? hpDef.max : 100;

      if (act === 'flee') {
        c.resolved = 'fled';
        c.log.push(I18N_RUNTIME.disengage);
        saveAutoCheckpoint();
        render();
        return;
      }

      if (act === 'attack') {
        let bonus = 0;
        PROJECT.rpgConfig.items.forEach(it => {
          if (it.category === 'equipment' && (session.inventory[it.id] || 0) > 0 && it.effectAmount) {
            bonus += it.effectAmount;
          }
        });
        const atk = (session.stats[c.playerAttackStatId] || 4) + bonus + (1 + Math.floor(Math.random()*4));
        const dmg = Math.max(1, atk - c.enemyDefense);
        c.enemyHp = Math.max(0, c.enemyHp - dmg);
        c.log.push(I18N_RUNTIME.youStrike + ' ' + c.enemyName + ' (' + dmg + ' ' + I18N_RUNTIME.damage + ').');
        Synth.playSfx('sfx_sword');
        if (c.enemyHp <= 0) {
          c.resolved = 'victory';
          c.log.push(c.enemyName + ' ' + I18N_RUNTIME.isDefeated);
          if (c.lootItemId) {
            const lootDef = PROJECT.rpgConfig.items.find(i => i.id === c.lootItemId);
            session.inventory[c.lootItemId] = (session.inventory[c.lootItemId] || 0) + 1;
            session.notifications.push(I18N_RUNTIME.looted + ' ' + (lootDef ? lootDef.name : c.lootItemId));
          }
          saveAutoCheckpoint();
          render();
          return;
        }
      } else if (act === 'defend') {
        c.defending = true;
        c.log.push(I18N_RUNTIME.raiseGuard);
      } else if (act === 'item' && itemId) {
        const it = PROJECT.rpgConfig.items.find(i => i.id === itemId);
        if (it && (session.inventory[itemId] || 0) > 0) {
          session.inventory[itemId]--;
          if (session.inventory[itemId] <= 0) delete session.inventory[itemId];
          const amt = it.effectAmount || 10;
          playerHp = Math.min(maxHp, playerHp + amt);
          session.stats[c.playerHpStatId] = playerHp;
          c.log.push(I18N_RUNTIME.used + ' ' + it.name + ' (+' + amt + ' HP).');
          Synth.playSfx('sfx_heal');
        }
      }

      let eDmg = c.enemyAttackMin + Math.floor(Math.random() * (c.enemyAttackMax - c.enemyAttackMin + 1));
      if (c.defending) eDmg = Math.max(1, Math.floor(eDmg * 0.4));
      playerHp = Math.max(0, playerHp - eDmg);
      session.stats[c.playerHpStatId] = playerHp;
      c.log.push(c.enemyName + ' ' + I18N_RUNTIME.attacksFor + ' ' + eDmg + ' ' + I18N_RUNTIME.damage + (c.defending ? ' ' + I18N_RUNTIME.guarded : '') + '.');
      Synth.playSfx('sfx_damage_hit');
      if (playerHp <= 0) {
        c.resolved = 'defeat';
        c.log.push(I18N_RUNTIME.youCollapse);
      }
      saveAutoCheckpoint();
      render();
    }

    function render() {
      const p = PROJECT.passages[session.currentPassageId];
      const stage = document.getElementById('story-stage');
      const hud = document.getElementById('rpg-hud');
      if (!p) return;

      const passageTitle = interpolateStoryText(p.title);
      const imgAsset = p.imageId ? PROJECT.assets.find(a => a.id === p.imageId) : null;
      let html = '';

      if (imgAsset && imgAsset.url) {
        html += '<div class="scene-hero"><img src="' + imgAsset.url + '" alt="" /><div class="scene-scrim"></div><h1 class="scene-title-overlay">' + escapeHtml(passageTitle) + '</h1></div>';
      } else {
        html += '<div style="padding:24px 24px 0 24px"><h1 class="passage-title-plain" style="font-size:' + (STORY_LAYOUT === 'blog-journal' ? '30px' : '24px') + (STORY_LAYOUT === 'cinematic-stage' ? ';text-align:center' : '') + '">' + escapeHtml(passageTitle) + '</h1></div>';
      }

      html += '<div class="story-body">';
      if (session.notifications.length > 0) {
        html += '<div class="notice-list">' + session.notifications.map(n => '<span>[' + escapeHtml(n) + ']</span>').join('') + '</div>';
      }
      html += renderBodyBlocks(p.body);

      // Combat block
      if (session.combat) {
        const c = session.combat;
        const portrait = c.enemyPortraitId ? PROJECT.assets.find(a => a.id === c.enemyPortraitId) : null;
        const pct = Math.max(0, Math.round((c.enemyHp / c.enemyMaxHp) * 100));
        let gearBonus = 0;
        PROJECT.rpgConfig.items.forEach(it => {
          if (it.category === 'equipment' && (session.inventory[it.id] || 0) > 0 && it.effectAmount) {
            gearBonus += it.effectAmount;
          }
        });
        html += '<div class="panel-box">';
        html += '<div class="combat-grid">';
        if (portrait && portrait.url) html += '<img class="combat-portrait" src="' + portrait.url + '" alt="" />';
        html += '<div style="flex:1"><div class="stat-head"><strong>' + escapeHtml(c.enemyName) + '</strong><span class="mono">' + c.enemyHp + ' / ' + c.enemyMaxHp + ' HP</span></div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:var(--crimson)"></div></div>';
        html += '<div class="mono" style="font-size:12px;color:var(--muted);margin-top:6px">' + escapeHtml(I18N_RUNTIME.attackLabel) + ': ' + c.enemyAttackMin + '–' + c.enemyAttackMax + ' · ' + escapeHtml(I18N_RUNTIME.defenseLabel) + ': ' + c.enemyDefense + (gearBonus > 0 ? ' · ' + escapeHtml(I18N_RUNTIME.gearBonus) + ': +' + gearBonus : '') + '</div></div></div>';
        html += '<div class="combat-log">' + c.log.map(l => '<div>' + escapeHtml(l) + '</div>').join('') + '</div>';
        if (c.resolved === 'ongoing') {
          const consumables = PROJECT.rpgConfig.items.filter(i => i.category === 'consumable' && (session.inventory[i.id] || 0) > 0);
          html += '<div class="combat-actions">';
          html += '<button class="primary" onclick="combatAct(\\'attack\\')">' + escapeHtml(I18N_PLAYTEST.attack) + '</button>';
          html += '<button onclick="combatAct(\\'defend\\')">' + escapeHtml(I18N_PLAYTEST.defend) + '</button>';
          consumables.forEach(item => {
            html += '<button onclick="combatAct(\\'item\\', \\'' + item.id + '\\')">' + escapeHtml(I18N_COMMON.use) + ' ' + escapeHtml(item.name) + ' (' + session.inventory[item.id] + ')</button>';
          });
          if (c.fleePassageId) html += '<button onclick="combatAct(\\'flee\\')">' + escapeHtml(I18N_PLAYTEST.flee) + '</button>';
          html += '</div>';
        } else {
          const nextId = c.resolved === 'victory' ? c.victoryPassageId : c.resolved === 'defeat' ? c.defeatPassageId : c.fleePassageId;
          const label = c.resolved === 'victory' ? I18N_PLAYTEST.claimVictory : c.resolved === 'defeat' ? I18N_PLAYTEST.continueLabel : I18N_PLAYTEST.retreatSafety;
          if (nextId) html += '<button class="primary" onclick="enterPassage(\\'' + nextId + '\\')">' + escapeHtml(label) + '</button>';
        }
        html += '</div>';
      }

      // Skill Check block
      if (p.skillCheck && (!session.combat || session.combat.resolved !== 'ongoing')) {
        const sc = p.skillCheck;
        const st = PROJECT.rpgConfig.stats.find(s => s.id === sc.statId);
        html += '<div class="panel-box">';
        html += '<div class="panel-title">' + escapeHtml(sc.label) + ' (' + sc.dice + ' + ' + escapeHtml(st ? st.name : sc.statId) + ' vs DC ' + sc.difficulty + ')</div>';
        if (!session.lastRoll) {
          html += '<button class="primary" onclick="rollCheck()">' + escapeHtml(I18N_PLAYTEST.roll) + ' ' + sc.dice + '</button>';
        } else {
          const r = session.lastRoll;
          html += '<div class="mono" style="margin-bottom:10px">' + escapeHtml(I18N_RUNTIME.rolled) + ' [' + r.raw.join(' + ') + '] + ' + r.mod + ' = <strong>' + r.total + '</strong> vs ' + r.difficulty + ' — <span style="color:' + (r.passed ? 'var(--emerald)' : 'var(--crimson)') + '">' + escapeHtml(r.passed ? I18N_RUNTIME.passed : I18N_RUNTIME.failed) + '</span></div>';
          if (r.nextPassageId) html += '<button class="primary" onclick="enterPassage(\\'' + r.nextPassageId + '\\')">' + escapeHtml(I18N_PLAYTEST.proceed) + '</button>';
        }
        html += '</div>';
      }

      // Standard Choices + Undo Choice on Passage
      if (!session.combat || session.combat.resolved !== 'ongoing') {
        const canUndo = (session.undoStack || []).length > 0;
        if (p.choices.length === 0 && !p.skillCheck && !session.combat) {
          html += '<div class="passage-actions"><span style="font-size:13px;color:var(--muted)">' + escapeHtml(I18N_PLAYTEST.endOfBranch) + '</span><div style="display:flex;gap:8px">';
          html += '<button onclick="undoChoice()" ' + (canUndo ? '' : 'disabled') + '>' + escapeHtml(I18N_PLAYTEST.undoChoice) + '</button>';
          html += '<button class="primary" onclick="initSession()">' + escapeHtml(I18N_PLAYTEST.playAgain) + '</button>';
          html += '</div></div>';
        } else {
          html += '<div class="choices">';
          p.choices.forEach((ch, idx) => {
            const ok = evalCondition(ch.condition);
            if (ch.hideWhenLocked && !ok) return;
            const prefix = STORY_LAYOUT === 'terminal-hud' ? '> ' : '';
            const labelText = interpolateStoryText(ch.label);
            html += '<button class="choice-btn" ' + (ok ? '' : 'disabled') + ' onclick="chooseOption(' + idx + ')"><span>' + prefix + escapeHtml(labelText) + '</span>' + (ch.condition ? '<span class="choice-req">' + escapeHtml(formatCond(ch.condition)) + '</span>' : '') + '</button>';
          });
          html += '</div>';
          html += '<div class="passage-actions">';
          html += '<button onclick="undoChoice()" ' + (canUndo ? '' : 'disabled') + '>' + escapeHtml(I18N_PLAYTEST.undoChoice) + '</button>';
          html += '<span class="mono" style="font-size:12px;color:var(--muted)">' + escapeHtml(I18N_COMMON.step) + ' ' + (session.history ? session.history.length : 1) + '</span>';
          html += '</div>';
        }
      }

      html += '</div>';
      stage.innerHTML = html;

      // Render HUD with Genre-adapted Labels
      let hudHtml = '<div><div class="hud-section-title">' + escapeHtml(HUD_LABELS.statsTitle) + '</div>';
      PROJECT.rpgConfig.stats.forEach(s => {
        const val = session.stats[s.id] ?? s.initial;
        if (s.display === 'bar') {
          const pct = Math.max(0, Math.min(100, Math.round((val / s.max) * 100)));
          hudHtml += '<div class="stat-row"><div class="stat-head"><span>' + escapeHtml(s.name) + '</span><span class="mono">' + val + ' / ' + s.max + '</span></div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
        } else {
          hudHtml += '<div class="stat-row"><div class="stat-head"><span>' + escapeHtml(s.name) + '</span><span class="mono">' + val + '</span></div></div>';
        }
      });
      hudHtml += '</div>';

      // Inventory
      hudHtml += '<div><div class="hud-section-title">' + escapeHtml(HUD_LABELS.inventoryTitle) + '</div>';
      const invIds = Object.keys(session.inventory);
      if (invIds.length === 0) {
        hudHtml += '<div style="font-size:13px;color:var(--muted)">' + escapeHtml(I18N_PLAYTEST.nothingCollected) + '</div>';
      } else {
        invIds.forEach(id => {
          const it = PROJECT.rpgConfig.items.find(i => i.id === id);
          const qty = session.inventory[id];
          hudHtml += '<div class="inv-row"><span>' + escapeHtml(it ? it.name : id) + ' <span class="mono">x' + qty + '</span></span>';
          if (it && it.category === 'consumable') {
            hudHtml += '<button onclick="useInventoryItem(\\'' + id + '\\')">' + escapeHtml(I18N_COMMON.use) + '</button>';
          }
          hudHtml += '</div>';
        });
      }
      hudHtml += '</div>';

      // Quests
      const visibleQuests = PROJECT.rpgConfig.quests.filter(q => session.quests[q.id] && session.quests[q.id] !== 'hidden');
      hudHtml += '<div><div class="hud-section-title">' + escapeHtml(HUD_LABELS.questsTitle) + '</div>';
      if (visibleQuests.length === 0) {
        hudHtml += '<div style="font-size:13px;color:var(--muted)">' + escapeHtml(I18N_PLAYTEST.noneActive) + '</div>';
      } else {
        visibleQuests.forEach(q => {
          const st = session.quests[q.id];
          hudHtml += '<div style="font-size:13px;margin-bottom:8px"><div><strong>' + escapeHtml(q.title) + '</strong> <span class="mono" style="color:var(--accent)">(' + st + ')</span></div><div style="color:var(--muted);font-size:12px">' + escapeHtml(q.description) + '</div></div>';
        });
      }
      hudHtml += '</div>';

      // Factions
      if (PROJECT.rpgConfig.factions.length > 0) {
        hudHtml += '<div><div class="hud-section-title">' + escapeHtml(HUD_LABELS.factionsTitle) + '</div>';
        PROJECT.rpgConfig.factions.forEach(f => {
          const rep = session.factions[f.id] ?? 0;
          hudHtml += '<div class="inv-row"><span>' + escapeHtml(f.name) + '</span><span class="mono">' + (rep > 0 ? '+' : '') + rep + '</span></div>';
        });
        hudHtml += '</div>';
      }

      hud.innerHTML = hudHtml;
    }

    function renderBodyBlocks(bodyText) {
      const regex = /\\[\\[img:([^\\]|]+)(?:\\|([^\\]|]*))?(?:\\|(25|50|75))?\\]\\]/gi;
      let out = '';
      let lastIdx = 0;
      let m;
      while ((m = regex.exec(bodyText)) !== null) {
        if (m.index > lastIdx) {
          const chunk = bodyText.slice(lastIdx, m.index).trim();
          if (chunk) out += renderRichText(chunk);
        }
        const asset = PROJECT.assets.find(a => a.id === m[1].trim());
        const caption = interpolateStoryText((m[2] || '').trim());
        const widthPct = m[3] ? m[3] : '75';
        if (asset && asset.url) {
          out += '<figure class="inline-figure' + (caption ? '' : ' no-caption') + '" style="width:' + widthPct + '%"><img src="' + asset.url + '" alt="' + escapeHtml(caption || asset.name) + '" />' + (caption ? '<figcaption>' + escapeHtml(caption) + '</figcaption>' : '') + '</figure>';
        }
        lastIdx = m.index + m[0].length;
      }
      if (lastIdx < bodyText.length) {
        const tail = bodyText.slice(lastIdx).trim();
        if (tail) out += renderRichText(tail);
      }
      return out;
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    window.chooseOption = function(idx) {
      const p = PROJECT.passages[session.currentPassageId];
      const ch = p && p.choices[idx];
      if (!ch || !evalCondition(ch.condition)) return;
      if (ch.sfxId) Synth.playSfx(ch.sfxId);
      applyEffects(ch.effects);
      enterPassage(ch.targetPassageId);
    };

    window.useInventoryItem = function(itemId) {
      const it = PROJECT.rpgConfig.items.find(i => i.id === itemId);
      if (!it || (session.inventory[itemId] || 0) <= 0) return;
      session.inventory[itemId]--;
      if (session.inventory[itemId] <= 0) delete session.inventory[itemId];
      const fallbackStat = PROJECT.rpgConfig.stats[0] ? PROJECT.rpgConfig.stats[0].id : 'hp';
      const targetId = it.effectStatId || fallbackStat;
      const def = PROJECT.rpgConfig.stats.find(s => s.id === targetId);
      const amt = it.effectAmount != null ? it.effectAmount : 10;
      let val = (session.stats[targetId] ?? (def ? def.initial : 0)) + amt;
      if (def) val = Math.max(def.min, Math.min(def.max, val));
      session.stats[targetId] = val;
      session.notifications.push(I18N_RUNTIME.used + ' ' + it.name + ' (' + (amt >= 0 ? '+' : '') + amt + ' ' + (def ? def.name : targetId) + ')');
      Synth.playSfx('sfx_heal');
      saveAutoCheckpoint();
      render();
    };

    window.rollCheck = rollCheck;
    window.combatAct = combatAct;
    window.enterPassage = enterPassage;
    window.undoChoice = undoChoice;
    window.initSession = initSession;

    const READER_PREFS_KEY = 'otgtam_reader_prefs_' + PROJECT.id;
    const READER_MODE_TOKENS = {
      default: ${defaultThemeMapJson},
      light: ${JSON.stringify(READER_LIGHT_TOKENS).replace(/<\//g, '<\\/')},
      dark: ${JSON.stringify(READER_DARK_TOKENS).replace(/<\//g, '<\\/')}
    };
    let activeFontId = DEFAULT_FONT_ID;
    let activeFontSizeId = DEFAULT_FONT_SIZE_ID;
    let activeModeId = 'default';

    function persistReaderPrefs() {
      try {
        localStorage.setItem(READER_PREFS_KEY, JSON.stringify({
          fontId: activeFontId,
          sizeId: activeFontSizeId,
          modeId: activeModeId
        }));
      } catch {}
    }

    function applyReaderMode(modeId, persist = true) {
      const tokens = READER_MODE_TOKENS[modeId] || READER_MODE_TOKENS.default;
      activeModeId = READER_MODE_TOKENS[modeId] ? modeId : 'default';
      const rootStyle = document.documentElement.style;
      rootStyle.setProperty('--bg', tokens.bg);
      rootStyle.setProperty('--surface', tokens.surface);
      rootStyle.setProperty('--elevated', tokens.elevated);
      rootStyle.setProperty('--hover', tokens.hover);
      rootStyle.setProperty('--border', tokens.border);
      rootStyle.setProperty('--text', tokens.text);
      rootStyle.setProperty('--text-secondary', tokens.textSecondary);
      rootStyle.setProperty('--muted', tokens.muted);
      rootStyle.setProperty('--accent', tokens.accent);
      rootStyle.setProperty('--accent-hover', tokens.accentHover);
      rootStyle.setProperty('--accent-contrast', tokens.accentContrast);
      const modeSel = document.getElementById('select-reader-mode');
      if (modeSel) modeSel.value = activeModeId;
      if (persist) persistReaderPrefs();
    }

    function applyReaderTypography(fontId, sizeId, persist = true) {
      if (fontId && FONT_MAP[fontId]) {
        activeFontId = fontId;
        document.documentElement.style.setProperty('--story-font', FONT_MAP[fontId]);
        const fontSel = document.getElementById('select-font-family');
        if (fontSel) fontSel.value = fontId;
      }
      if (sizeId && FONT_SIZE_MAP[sizeId]) {
        activeFontSizeId = sizeId;
        document.documentElement.style.setProperty('--story-font-size', FONT_SIZE_MAP[sizeId].size);
        document.documentElement.style.setProperty('--story-line-height', FONT_SIZE_MAP[sizeId].lineHeight);
        const sizeSel = document.getElementById('select-font-size');
        if (sizeSel) sizeSel.value = sizeId;
      }
      if (persist) persistReaderPrefs();
    }

    (function loadReaderPrefs() {
      try {
        const raw = localStorage.getItem(READER_PREFS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          applyReaderMode(parsed.modeId || 'default', false);
          applyReaderTypography(parsed.fontId || DEFAULT_FONT_ID, parsed.sizeId || DEFAULT_FONT_SIZE_ID, false);
          return;
        }
      } catch {}
      applyReaderMode('default', false);
      applyReaderTypography(DEFAULT_FONT_ID, DEFAULT_FONT_SIZE_ID, false);
    })();

    document.getElementById('select-reader-mode').addEventListener('change', function(e) {
      applyReaderMode(e.target.value, true);
    });
    document.getElementById('select-font-family').addEventListener('change', function(e) {
      applyReaderTypography(e.target.value, activeFontSizeId, true);
    });
    document.getElementById('select-font-size').addEventListener('change', function(e) {
      applyReaderTypography(activeFontId, e.target.value, true);
    });
    document.getElementById('btn-save-game').addEventListener('click', saveGameJson);
    document.getElementById('btn-load-game').addEventListener('click', function() {
      const inp = document.getElementById('load-game-input');
      if (inp) inp.click();
    });
    document.getElementById('load-game-input').addEventListener('change', function(e) {
      const file = e.target.files && e.target.files[0];
      if (file) {
        loadGameJson(file);
        e.target.value = '';
      }
    });
    document.getElementById('btn-sheet').addEventListener('click', function() {
      const main = document.getElementById('story-main');
      if (main) main.classList.toggle('hud-open');
    });
    document.getElementById('btn-restart').addEventListener('click', initSession);
    document.getElementById('btn-mute').addEventListener('click', function() {
      const next = !Synth.isMuted();
      Synth.setMuted(next);
      this.textContent = next ? I18N_PLAYTEST.soundOff : I18N_PLAYTEST.soundOn;
    });

    (function bootStory() {
      try {
        const savedRaw = localStorage.getItem(AUTOSAVE_KEY);
        if (savedRaw) {
          const saved = JSON.parse(savedRaw);
          if (saved && saved.currentPassageId && PROJECT.passages[saved.currentPassageId]) {
            const hist = Array.isArray(saved.history) ? saved.history : [saved.currentPassageId];
            session = {
              currentPassageId: saved.currentPassageId,
              history: hist,
              stats: saved.stats || {},
              inventory: saved.inventory || {},
              quests: saved.quests || {},
              factions: saved.factions || {},
              flags: saved.flags || {},
              visitedPassageIds: Array.isArray(saved.visitedPassageIds) ? saved.visitedPassageIds : Array.from(new Set(hist)),
              notifications: [I18N_PLAYTEST.resumeAutoSave],
              lastRoll: saved.lastRoll || null,
              combat: saved.combat || null,
              undoStack: Array.isArray(saved.undoStack) ? saved.undoStack : []
            };
            const p = PROJECT.passages[session.currentPassageId];
            if (p) Synth.playAmb(p.ambientAudioId, p.ambientLoop !== false);
            render();
            return;
          }
        }
      } catch {}
      initSession();
    })();
  </script>
</body>
</html>`;
}
