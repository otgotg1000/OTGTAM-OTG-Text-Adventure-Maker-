import { Download, Share, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useI18n } from '../i18n/LanguageContext';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'primary';
}

export function PWAInstallButton({ variant = 'compact' }: PWAInstallButtonProps) {
  const { t } = useI18n();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Suppress button when already running in standalone installed mode
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'primary'
            ? 'inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] px-4 py-2 text-xs font-semibold text-[var(--accent-contrast)] transition-colors shadow-sm'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-primary)]/50 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--accent-primary)] transition-colors'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{t.pwa.installApp}</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'primary'
              ? 'inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] px-4 py-2 text-xs font-semibold text-[var(--accent-contrast)] transition-colors shadow-sm'
              : 'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors'
          }
        >
          <Share className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
          <span>{t.pwa.installOnIos}</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.pwa.iosModalTitle}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          >
            <div className="w-full max-w-sm rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {t.pwa.iosModalTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label={t.common.close}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-2.5 text-sm text-[var(--text-secondary)]">
                <li className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5">
                  1. {t.pwa.iosStep1}
                </li>
                <li className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5">
                  2. {t.pwa.iosStep2}
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] py-2 text-xs font-semibold text-[var(--accent-contrast)] transition-colors"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
