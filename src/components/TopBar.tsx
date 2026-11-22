import { Play } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';
import { WorkspaceTab } from '../types/story';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onPlaytest: () => void;
}

export function TopBar({ activeTab, onSelectTab, onPlaytest }: TopBarProps) {
  const { t } = useI18n();

  const navItems: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'home', label: t.nav.home },
    { id: 'map', label: t.nav.storyMap },
    { id: 'rpg', label: t.nav.storySystems },
    { id: 'media', label: t.nav.mediaVault },
    { id: 'story-settings', label: t.nav.storySettings },
    { id: 'export', label: t.nav.saveExport },
  ];

  return (
    <header className="h-14 shrink-0 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-6 flex items-center justify-between gap-8 z-30">
      {/* Zone 1: Single-element brand wordmark */}
      <button
        type="button"
        onClick={() => onSelectTab('home')}
        className="text-lg font-bold tracking-tight text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0"
      >
        OTGTAM
      </button>

      {/* Zone 2: Single-line workspace navigation */}
      <nav className="flex items-center gap-6 overflow-x-auto" aria-label="Workspace Sections">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] ${
                active
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--accent-primary)]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Install PWA (when available) + Primary CTA */}
      <div className="flex items-center gap-2.5 shrink-0">
        <PWAInstallButton variant="compact" />
        <button
          type="button"
          onClick={onPlaytest}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{t.nav.playtest}</span>
        </button>
      </div>
    </header>
  );
}
