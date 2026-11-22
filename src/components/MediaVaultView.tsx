import {
  Check,
  Image as ImageIcon,
  Music,
  Play,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { ChangeEvent, useRef, useState } from 'react';
import { synthEngine } from '../audio/synthEngine';
import { useI18n } from '../i18n/LanguageContext';
import { MediaAsset, Passage } from '../types/story';

interface MediaVaultViewProps {
  assets: MediaAsset[];
  selectedPassage: Passage | null;
  onUploadMediaAsset: (
    file: File,
    kind: 'image' | 'audio',
    audioRole?: 'sfx' | 'ambient'
  ) => Promise<MediaAsset | null>;
  onDeleteAsset: (id: string) => void;
  onAttachToPassage: (asset: MediaAsset) => void;
}

export function MediaVaultView({
  assets,
  selectedPassage,
  onUploadMediaAsset,
  onDeleteAsset,
  onAttachToPassage,
}: MediaVaultViewProps) {
  const { t } = useI18n();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sfxInputRef = useRef<HTMLInputElement>(null);
  const ambInputRef = useRef<HTMLInputElement>(null);
  const [playingAmbientId, setPlayingAmbientId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const images = assets.filter((a) => a.kind === 'image');
  const ambientAudio = assets.filter((a) => a.kind === 'audio' && a.audioRole === 'ambient');
  const sfxAudio = assets.filter((a) => a.kind === 'audio' && a.audioRole !== 'ambient');

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUploadMediaAsset(file, 'image');
      e.target.value = '';
    }
  };

  const handleAudioUpload = (role: 'sfx' | 'ambient') => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUploadMediaAsset(file, 'audio', role);
      e.target.value = '';
    }
  };

  const toggleAmbientPreview = (asset: MediaAsset) => {
    if (playingAmbientId === asset.id) {
      synthEngine.stopAmbient();
      setPlayingAmbientId(null);
    } else {
      synthEngine.playAmbient(asset);
      setPlayingAmbientId(asset.id);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t.media.title}</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {t.media.subtitle}
              {selectedPassage && (
                <span className="text-[var(--accent-primary)]">
                  {' '}
                  {t.media.oneClickTarget} &ldquo;{selectedPassage.title}&rdquo;.
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t.media.uploadImage}</span>
            </button>
            <button
              type="button"
              onClick={() => ambInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              <Music className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.media.uploadAmbient}</span>
            </button>
            <button
              type="button"
              onClick={() => sfxInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              <Volume2 className="w-3.5 h-3.5 text-sky-400" />
              <span>{t.media.uploadSfx}</span>
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <input
              ref={ambInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload('ambient')}
              className="hidden"
            />
            <input
              ref={sfxInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload('sfx')}
              className="hidden"
            />
          </div>
        </div>

        {/* Scene Illustrations */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {t.media.sceneArtwork} ({images.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {images.map((asset) => {
              const isAttached = selectedPassage?.imageId === asset.id;
              const imgFailed = failedImages[asset.id];
              return (
                <div
                  key={asset.id}
                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[16/10] bg-[var(--bg-canvas)] relative overflow-hidden">
                      {asset.url && !imgFailed ? (
                        <img
                          src={asset.url}
                          alt={asset.name}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [asset.id]: true }))
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--bg-elevated)] text-[var(--text-muted)] p-4 text-center">
                          <ImageIcon className="w-6 h-6 mb-1.5" />
                          <span className="text-xs">{asset.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3.5">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {asset.name}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {asset.source === 'upload' ? t.media.uploadedImage : t.media.defaultArt}
                        {asset.description ? ` · ${asset.description}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="px-3.5 pb-3.5 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!selectedPassage}
                      onClick={() => onAttachToPassage(asset)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                        isAttached
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border-[var(--border-hairline)] text-[var(--text-primary)] disabled:opacity-40'
                      }`}
                    >
                      {isAttached && <Check className="w-3.5 h-3.5" />}
                      <span>{isAttached ? t.media.attached : t.media.useInPassage}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAsset(asset.id)}
                      className="p-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-red-500/20 border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                      title={t.common.delete}
                      aria-label={`${t.common.delete} ${asset.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Audio Studio */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ambient Soundscapes */}
          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {t.media.ambientSoundscapes} ({ambientAudio.length})
            </h2>
            <div className="space-y-2.5">
              {ambientAudio.map((asset) => {
                const playing = playingAmbientId === asset.id;
                const attached = selectedPassage?.ambientAudioId === asset.id;
                return (
                  <div
                    key={asset.id}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {asset.name}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {asset.source === 'upload' ? t.media.uploadedAudio : t.media.webAudioSynth}
                        {asset.description ? ` · ${asset.description}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleAmbientPreview(asset)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-medium ${
                          playing
                            ? 'bg-amber-500 text-[#0B0E14] border-amber-500'
                            : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-primary)]'
                        }`}
                      >
                        {playing ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                        <span>{playing ? t.media.stop : t.common.play}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!selectedPassage}
                        onClick={() => onAttachToPassage(asset)}
                        className={`px-2.5 py-1.5 rounded-md border text-xs font-medium whitespace-nowrap ${
                          attached
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border-[var(--border-hairline)] text-[var(--text-primary)] disabled:opacity-40'
                        }`}
                      >
                        {attached ? t.media.attached : t.media.attach}
                      </button>
                      {asset.source === 'upload' && (
                        <button
                          type="button"
                          onClick={() => onDeleteAsset(asset.id)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* One-Shot RPG Sound Effects */}
          <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {t.media.oneShotSfx} ({sfxAudio.length})
            </h2>
            <div className="space-y-2.5">
              {sfxAudio.map((asset) => {
                const attached = selectedPassage?.entrySfxId === asset.id;
                return (
                  <div
                    key={asset.id}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {asset.name}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {asset.source === 'upload' ? t.media.uploadedAudio : t.media.webAudioSynth}
                        {asset.description ? ` · ${asset.description}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => synthEngine.playSfx(asset)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)]"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{t.media.trigger}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!selectedPassage}
                        onClick={() => onAttachToPassage(asset)}
                        className={`px-2.5 py-1.5 rounded-md border text-xs font-medium whitespace-nowrap ${
                          attached
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border-[var(--border-hairline)] text-[var(--text-primary)] disabled:opacity-40'
                        }`}
                      >
                        {attached ? t.media.entrySfx : t.media.setEntrySfx}
                      </button>
                      {asset.source === 'upload' && (
                        <button
                          type="button"
                          onClick={() => onDeleteAsset(asset.id)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
