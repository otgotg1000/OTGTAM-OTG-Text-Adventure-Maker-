import { MediaAsset } from '../types/story';

class SynthAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private ambientTimers: number[] = [];
  private ambientStopTimeout: number | null = null;
  private uploadedAmbientEl: HTMLAudioElement | null = null;
  private activeAmbientId: string | null = null;
  private activeAmbientLoop = true;
  private muted = false;
  private volume = 0.65;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.04);
    }
    if (this.uploadedAmbientEl) {
      this.uploadedAmbientEl.muted = muted;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
    }
    if (this.uploadedAmbientEl) {
      this.uploadedAmbientEl.volume = this.volume * 0.55;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getActiveAmbientId(): string | null {
    return this.activeAmbientId;
  }

  public stopAmbient(): void {
    for (const tid of this.ambientTimers) {
      window.clearInterval(tid);
    }
    this.ambientTimers = [];
    if (this.ambientStopTimeout !== null) {
      window.clearTimeout(this.ambientStopTimeout);
      this.ambientStopTimeout = null;
    }
    for (const node of this.ambientNodes) {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignore already-stopped nodes
      }
    }
    this.ambientNodes = [];
    if (this.uploadedAmbientEl) {
      this.uploadedAmbientEl.pause();
      this.uploadedAmbientEl.src = '';
      this.uploadedAmbientEl = null;
    }
    this.activeAmbientId = null;
  }

  public playAsset(asset: MediaAsset | undefined, loop = true): void {
    if (!asset || asset.kind !== 'audio') return;
    if (asset.audioRole === 'ambient') {
      this.playAmbient(asset, loop);
    } else {
      this.playSfx(asset);
    }
  }

  public playSfx(asset: MediaAsset | undefined): void {
    if (!asset || asset.kind !== 'audio') return;
    if (asset.source === 'upload' && asset.url) {
      const audio = new Audio(asset.url);
      audio.volume = this.muted ? 0 : this.volume;
      audio.play().catch(() => {});
      return;
    }
    if (asset.synthPreset) {
      this.triggerSynthSfx(asset.synthPreset);
    }
  }

  public playAmbient(asset: MediaAsset | undefined, loop = true): void {
    if (!asset) {
      this.stopAmbient();
      return;
    }
    if (loop && this.activeAmbientId === asset.id && this.activeAmbientLoop) return;

    this.stopAmbient();
    this.activeAmbientId = asset.id;
    this.activeAmbientLoop = loop;

    if (asset.source === 'upload' && asset.url) {
      const el = new Audio(asset.url);
      el.loop = loop;
      el.muted = this.muted;
      el.volume = this.volume * 0.55;
      if (!loop) {
        el.addEventListener('ended', () => {
          if (this.uploadedAmbientEl === el) {
            this.stopAmbient();
          }
        });
      }
      el.play().catch(() => {});
      this.uploadedAmbientEl = el;
      return;
    }

    if (asset.synthPreset) {
      this.startSynthAmbient(asset.synthPreset, loop);
    }
  }

  public triggerSynthSfx(preset: string): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    switch (preset) {
      case 'sfx_dice_roll': {
        [0, 0.06, 0.13, 0.21].forEach((offset, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(220 + idx * 45, now + offset);
          osc.frequency.exponentialRampToValueAtTime(95, now + offset + 0.045);
          gain.gain.setValueAtTime(0.28, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + offset);
          osc.stop(now + offset + 0.055);
        });
        break;
      }
      case 'sfx_sword_slash': {
        const bufferSize = ctx.sampleRate * 0.16;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2200, now);
        filter.frequency.exponentialRampToValueAtTime(700, now + 0.15);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.35, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.masterGain);
        noise.start(now);

        const ring = ctx.createOscillator();
        const rGain = ctx.createGain();
        ring.type = 'sine';
        ring.frequency.setValueAtTime(1480, now);
        ring.frequency.exponentialRampToValueAtTime(960, now + 0.22);
        rGain.gain.setValueAtTime(0.14, now);
        rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        ring.connect(rGain);
        rGain.connect(this.masterGain);
        ring.start(now);
        ring.stop(now + 0.25);
        break;
      }
      case 'sfx_door_creak': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(135, now);
        osc.frequency.linearRampToValueAtTime(175, now + 0.18);
        osc.frequency.linearRampToValueAtTime(112, now + 0.42);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 520;
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.48);
        break;
      }
      case 'sfx_coin_clink': {
        [1568, 2093].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.055);
          gain.gain.setValueAtTime(0.18, now + i * 0.055);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.22);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + i * 0.055);
          osc.stop(now + i * 0.055 + 0.24);
        });
        break;
      }
      case 'sfx_potion_heal': {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.07);
          gain.gain.setValueAtTime(0.14, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.28);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.3);
        });
        break;
      }
      case 'sfx_damage_hit': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.18);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      }
      case 'sfx_quest_complete': {
        [392.0, 493.88, 587.33, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.09);
          gain.gain.setValueAtTime(0.18, now + i * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + i * 0.09);
          osc.stop(now + i * 0.09 + 0.48);
        });
        break;
      }
      case 'sfx_laser_zap': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1180, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, now);
        filter.frequency.exponentialRampToValueAtTime(480, now + 0.18);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case 'sfx_terminal_hack': {
        [987.77, 1318.5, 1174.66, 1760].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + i * 0.045);
          gain.gain.setValueAtTime(0.09, now + i * 0.045);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.06);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + i * 0.045);
          osc.stop(now + i * 0.045 + 0.065);
        });
        break;
      }
      case 'sfx_airlock_hiss': {
        const len = Math.floor(ctx.sampleRate * 0.45);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.frequency.exponentialRampToValueAtTime(450, now + 0.42);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.26, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        src.start(now);
        break;
      }
      case 'sfx_noir_sting': {
        [293.66, 349.23, 415.3, 523.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.06);
          gain.gain.setValueAtTime(0.14, now + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.55);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.58);
        });
        break;
      }
      case 'sfx_camera_shutter': {
        [0, 0.055].forEach((off, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(idx === 0 ? 1900 : 1200, now + off);
          osc.frequency.exponentialRampToValueAtTime(240, now + off + 0.03);
          gain.gain.setValueAtTime(0.16, now + off);
          gain.gain.exponentialRampToValueAtTime(0.001, now + off + 0.035);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + off);
          osc.stop(now + off + 0.04);
        });
        break;
      }
      case 'sfx_horror_scare': {
        [110, 116.54, 233.08, 311.13].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.linearRampToValueAtTime(freq * 0.94, now + 0.55);
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 1400;
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now);
          osc.stop(now + 0.62);
        });
        break;
      }
      case 'sfx_ghost_whisper': {
        const len = Math.floor(ctx.sampleRate * 0.65);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const env = Math.sin((Math.PI * i) / len);
          d[i] = (Math.random() * 2 - 1) * env;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 4.5;
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.linearRampToValueAtTime(1600, now + 0.3);
        filter.frequency.linearRampToValueAtTime(520, now + 0.65);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        src.start(now);
        break;
      }
      case 'sfx_page_turn': {
        const len = Math.floor(ctx.sampleRate * 0.14);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2400;
        filter.Q.value = 1.2;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        src.start(now);
        break;
      }
      case 'sfx_heart_chime': {
        [523.25, 659.25, 987.77, 1318.51].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.085);
          gain.gain.setValueAtTime(0.12, now + i * 0.085);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.085 + 0.45);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + i * 0.085);
          osc.stop(now + i * 0.085 + 0.48);
        });
        break;
      }
      case 'sfx_lock_click': {
        [820, 1420].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.045);
          osc.frequency.exponentialRampToValueAtTime(280, now + i * 0.045 + 0.03);
          gain.gain.setValueAtTime(0.22, now + i * 0.045);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.04);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + i * 0.045);
          osc.stop(now + i * 0.045 + 0.045);
        });
        break;
      }
      case 'sfx_discovery':
      default: {
        [440, 554.37, 659.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.14, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.36);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.38);
        });
        break;
      }
    }
  }

  private scheduleOneShotCutoff(gains: GainNode[], durationMs = 5500): void {
    const fadeSec = 0.8;
    const stopTimer = window.setTimeout(() => {
      if (this.ctx) {
        const t = this.ctx.currentTime;
        gains.forEach((g) => {
          try {
            g.gain.setTargetAtTime(0.0001, t, fadeSec / 3);
          } catch {
            // ignore
          }
        });
      }
      this.ambientStopTimeout = window.setTimeout(() => {
        this.stopAmbient();
      }, fadeSec * 1000);
    }, durationMs);
    this.ambientStopTimeout = stopTimer;
  }

  private startSynthAmbient(preset: string, loop: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const activeGains: GainNode[] = [];

    if (preset === 'amb_rainstorm') {
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2) * 0.28;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.8);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
      this.ambientNodes.push(noise, filter, gain);
      activeGains.push(gain);
    } else if (preset === 'amb_clockwork_tick') {
      const drone = ctx.createOscillator();
      const dGain = ctx.createGain();
      drone.type = 'sine';
      drone.frequency.value = 110;
      dGain.gain.setValueAtTime(0.001, now);
      dGain.gain.linearRampToValueAtTime(0.05, now + 0.6);
      drone.connect(dGain);
      dGain.connect(this.masterGain);
      drone.start(now);
      this.ambientNodes.push(drone, dGain);
      activeGains.push(dGain);

      let toggle = false;
      const tid = window.setInterval(() => {
        if (!this.ctx || !this.masterGain || this.muted) return;
        const t = this.ctx.currentTime;
        const tickOsc = this.ctx.createOscillator();
        const tickGain = this.ctx.createGain();
        tickOsc.type = 'triangle';
        tickOsc.frequency.setValueAtTime(toggle ? 1150 : 880, t);
        tickOsc.frequency.exponentialRampToValueAtTime(220, t + 0.025);
        tickGain.gain.setValueAtTime(0.065, t);
        tickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        tickOsc.connect(tickGain);
        tickGain.connect(this.masterGain);
        tickOsc.start(t);
        tickOsc.stop(t + 0.035);
        toggle = !toggle;
      }, 750);
      this.ambientTimers.push(tid);
    } else if (preset === 'amb_tavern_hearth') {
      [146.83, 220.0].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.value = 340;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.045, now + 0.9);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        this.ambientNodes.push(osc, filter, gain);
        activeGains.push(gain);
      });
    } else if (preset === 'amb_starship_hum') {
      [55, 82.41, 164.81].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = idx === 2 ? 'sine' : 'sawtooth';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.value = 190;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(idx === 2 ? 0.028 : 0.04, now + 0.8);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        this.ambientNodes.push(osc, filter, gain);
        activeGains.push(gain);
      });
    } else if (preset === 'amb_cyber_neon') {
      [110, 164.81, 220].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.03, now + 0.7);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        this.ambientNodes.push(osc, filter, gain);
        activeGains.push(gain);
      });
      const notes = [329.63, 392.0, 440.0, 493.88];
      let step = 0;
      const tid = window.setInterval(() => {
        if (!this.ctx || !this.masterGain || this.muted) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = notes[step % notes.length];
        g.gain.setValueAtTime(0.035, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        o.connect(g);
        g.connect(this.masterGain);
        o.start(t);
        o.stop(t + 0.48);
        step++;
      }, 650);
      this.ambientTimers.push(tid);
    } else if (preset === 'amb_noir_jazz') {
      // Warm minor-9th smoky lounge chord
      [146.83, 174.61, 220.0, 261.63, 329.63].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.value = 480;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.025, now + 0.9);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        this.ambientNodes.push(osc, filter, gain);
        activeGains.push(gain);
      });
    } else if (preset === 'amb_detective_tension') {
      [73.42, 109.9].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.value = 260;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.8);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        this.ambientNodes.push(osc, filter, gain);
        activeGains.push(gain);
      });
      const tid = window.setInterval(() => {
        if (!this.ctx || !this.masterGain || this.muted) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 698.46;
        g.gain.setValueAtTime(0.025, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        o.connect(g);
        g.connect(this.masterGain);
        o.start(t);
        o.stop(t + 0.72);
      }, 2400);
      this.ambientTimers.push(tid);
    } else if (preset === 'amb_horror_dread') {
      [48.99, 51.91, 98.0].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.value = 175;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.042, now + 1.1);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        this.ambientNodes.push(osc, filter, gain);
        activeGains.push(gain);
      });
    } else if (preset === 'amb_heartbeat_panic') {
      const pulse = () => {
        if (!this.ctx || !this.masterGain || this.muted) return;
        const t = this.ctx.currentTime;
        [0, 0.22].forEach((off, idx) => {
          const o = this.ctx!.createOscillator();
          const g = this.ctx!.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(idx === 0 ? 78 : 64, t + off);
          o.frequency.exponentialRampToValueAtTime(34, t + off + 0.14);
          g.gain.setValueAtTime(idx === 0 ? 0.22 : 0.16, t + off);
          g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.16);
          o.connect(g);
          g.connect(this.masterGain!);
          o.start(t + off);
          o.stop(t + off + 0.17);
        });
      };
      pulse();
      const tid = window.setInterval(pulse, 1250);
      this.ambientTimers.push(tid);
    } else if (preset === 'amb_romance_piano') {
      // Warm Major-7th atmospheric pad + soft melody bells
      [261.63, 329.63, 392.0, 493.88].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.value = 620;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.024, now + 0.9);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        this.ambientNodes.push(osc, filter, gain);
        activeGains.push(gain);
      });
      const notes = [523.25, 659.25, 783.99, 659.25];
      let idx = 0;
      const tid = window.setInterval(() => {
        if (!this.ctx || !this.masterGain || this.muted) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = notes[idx % notes.length];
        g.gain.setValueAtTime(0.032, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        o.connect(g);
        g.connect(this.masterGain);
        o.start(t);
        o.stop(t + 1.15);
        idx++;
      }, 1400);
      this.ambientTimers.push(tid);
    } else if (preset === 'amb_observatory_chimes') {
      [220, 329.63].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.03, now + 0.8);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        this.ambientNodes.push(osc, filter, gain);
        activeGains.push(gain);
      });
      const chimes = [880, 987.77, 1174.66, 1318.51];
      let step = 0;
      const tid = window.setInterval(() => {
        if (!this.ctx || !this.masterGain || this.muted) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = chimes[(step * 3) % chimes.length];
        g.gain.setValueAtTime(0.026, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        o.connect(g);
        g.connect(this.masterGain);
        o.start(t);
        o.stop(t + 1.25);
        step++;
      }, 1600);
      this.ambientTimers.push(tid);
    } else {
      // Default: amb_dungeon_drone
      [65.41, 98.0].forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.value = 210;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.045, now + 1.1);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(now);
        this.ambientNodes.push(osc, filter, gain);
        activeGains.push(gain);
      });
    }

    if (!loop) {
      this.scheduleOneShotCutoff(activeGains, 5500);
    }
  }
}

export const synthEngine = new SynthAudioEngine();
