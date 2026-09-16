// Web Audio API & Native Capacitor Haptic Controller for Mobile (iOS & Android)
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { music } from './music.js';

class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(mute) {
    this.muted = Boolean(mute);
    music.setMuted(this.muted);
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  isMuted() {
    return this.muted;
  }

  // Mobile Light Haptic Feedback
  triggerHaptic(type = 'light') {
    try {
      if (typeof window === 'undefined') return;
      if (type === 'success') {
        Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
      } else if (type === 'error') {
        Haptics.notification({ type: NotificationType.Error }).catch(() => {});
      } else if (type === 'win') {
        Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      } else {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }
    } catch (e) {
      // Fallback on non-mobile web
    }
  }

  // Soft click/tap sound
  playTap() {
    this.triggerHaptic('light');
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  // Harmonic success chime when difference is found
  playSuccess() {
    this.triggerHaptic('success');
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio

      notes.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.06);

        gain.gain.setValueAtTime(0, now + index * 0.06);
        gain.gain.linearRampToValueAtTime(0.2, now + index * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.06 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + index * 0.06);
        osc.stop(now + index * 0.06 + 0.25);
      });
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  // Error buzz sound for missed tap
  playError() {
    this.triggerHaptic('error');
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.15);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  // Magic hint sparkle sound
  playHint() {
    this.triggerHaptic('light');
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const freqs = [880, 1108.73, 1318.51, 1760]; // A5, C#6, E6, A6

      freqs.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);

        gain.gain.setValueAtTime(0.12, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.2);
      });
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  // Level / Stage complete fanfare
  playWin(stars = 3, options = {}) {
    this.playFanfare(stars, options);
  }

  // Celebratory fanfare when an image set / stage is completed
  // Supports different fanfare levels:
  // - None for 1 star (subtle haptic only)
  // - Some for 2 stars (modest pleasant 3-note melody)
  // - More for 3 stars (full brass herald melody with shimmer harmonics)
  // - Energetic variant for personal best (rapid vibrant ascending arpeggio)
  // - Grand golden royal fanfare for new leaderboard records
  playFanfare(stars = 3, options = {}) {
    const isLeaderboardRecord = Boolean(
      options === 'leaderboard' ||
      options?.isLeaderboardRecord
    );
    const isPersonalBest = Boolean(
      options === 'personal_best' ||
      options?.isPersonalBest
    );

    // 1 star with no record: None
    if (stars <= 1 && !isLeaderboardRecord && !isPersonalBest) {
      this.triggerHaptic('light');
      return;
    }

    this.triggerHaptic('win');
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      let allNotes = [];

      if (isLeaderboardRecord) {
        // Grand Royal Golden Herald Fanfare for New Leaderboard Records
        allNotes = [
          { freq: 392.00, time: 0, duration: 0.10, type: 'triangle', gain: 0.22 },     // G4
          { freq: 523.25, time: 0.10, duration: 0.12, type: 'triangle', gain: 0.25 },  // C5
          { freq: 659.25, time: 0.22, duration: 0.12, type: 'triangle', gain: 0.25 },  // E5
          { freq: 783.99, time: 0.34, duration: 0.14, type: 'triangle', gain: 0.28 },  // G5
          { freq: 1046.50, time: 0.48, duration: 0.70, type: 'triangle', gain: 0.35 }, // C6 (grand climax)
          { freq: 523.25, time: 0.48, duration: 0.70, type: 'sawtooth', gain: 0.14 },  // C5 brass foundation
          { freq: 783.99, time: 0.48, duration: 0.70, type: 'sine', gain: 0.20 },      // G5
          { freq: 1318.51, time: 0.48, duration: 0.70, type: 'triangle', gain: 0.20 }, // E6
          { freq: 1567.98, time: 0.54, duration: 0.60, type: 'sine', gain: 0.18 },    // G6 sparkle
          { freq: 2093.00, time: 0.62, duration: 0.60, type: 'sine', gain: 0.16 },    // C7 shimmer
          { freq: 2637.02, time: 0.70, duration: 0.50, type: 'sine', gain: 0.12 }     // E7 golden brilliance
        ];
      } else if (isPersonalBest) {
        // Energetic Variant Fanfare for Personal Best
        allNotes = [
          { freq: 523.25, time: 0, duration: 0.09, type: 'triangle', gain: 0.20 },     // C5
          { freq: 659.25, time: 0.09, duration: 0.09, type: 'triangle', gain: 0.22 },  // E5
          { freq: 783.99, time: 0.18, duration: 0.09, type: 'triangle', gain: 0.24 },  // G5
          { freq: 987.77, time: 0.27, duration: 0.11, type: 'triangle', gain: 0.25 },  // B5
          { freq: 1046.50, time: 0.38, duration: 0.50, type: 'triangle', gain: 0.30 }, // C6
          { freq: 1318.51, time: 0.44, duration: 0.50, type: 'sine', gain: 0.18 },      // E6
          { freq: 1567.98, time: 0.50, duration: 0.45, type: 'sine', gain: 0.15 }      // G6
        ];
      } else if (stars >= 3) {
        // Full Triumphant Herald Fanfare for 3 Stars
        allNotes = [
          { freq: 523.25, time: 0, duration: 0.12, type: 'triangle', gain: 0.22 },     // C5
          { freq: 659.25, time: 0.12, duration: 0.12, type: 'triangle', gain: 0.22 },  // E5
          { freq: 783.99, time: 0.24, duration: 0.14, type: 'triangle', gain: 0.25 },  // G5
          { freq: 1046.50, time: 0.38, duration: 0.55, type: 'triangle', gain: 0.30 }, // C6
          { freq: 783.99, time: 0.38, duration: 0.55, type: 'sine', gain: 0.18 },      // G5 harmony
          { freq: 1318.51, time: 0.38, duration: 0.55, type: 'triangle', gain: 0.16 }, // E6 harmony
          { freq: 1567.98, time: 0.44, duration: 0.45, type: 'sine', gain: 0.14 },    // G6 golden sparkle
          { freq: 2093.00, time: 0.52, duration: 0.45, type: 'sine', gain: 0.12 }     // C7 shimmer
        ];
      } else if (stars === 2) {
        // Modest, Pleasant 3-Note Fanfare for 2 Stars
        allNotes = [
          { freq: 523.25, time: 0, duration: 0.10, type: 'triangle', gain: 0.18 },     // C5
          { freq: 659.25, time: 0.10, duration: 0.10, type: 'triangle', gain: 0.18 },  // E5
          { freq: 783.99, time: 0.20, duration: 0.30, type: 'triangle', gain: 0.22 }   // G5
        ];
      }

      allNotes.forEach(note => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = note.type || 'triangle';
        osc.frequency.setValueAtTime(note.freq, now + note.time);

        const peakGain = note.gain || 0.2;
        gain.gain.setValueAtTime(0, now + note.time);
        gain.gain.linearRampToValueAtTime(peakGain, now + note.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + note.time);
        osc.stop(now + note.time + note.duration);
      });
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  // Game over / stage failure sound
  playLose() {
    this.triggerHaptic('error');
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [
        { freq: 330.0, time: 0, duration: 0.18 },    // E4
        { freq: 293.66, time: 0.18, duration: 0.18 }, // D4
        { freq: 261.63, time: 0.36, duration: 0.35 }  // C4
      ];

      notes.forEach(note => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note.freq, now + note.time);

        gain.gain.setValueAtTime(0.15, now + note.time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + note.time);
        osc.stop(now + note.time + note.duration);
      });
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  // Clock tick sound
  playTick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.02);
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }
}

export const sounds = new SoundController();
export { music } from './music.js';
