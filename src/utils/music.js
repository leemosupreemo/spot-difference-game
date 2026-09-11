// Background Music Controller for Spot-the-Difference Game
// Handles playlist shuffling, gapless/delayed transitions, mute states, and audio unlock.

export const BGM_TRACKS = [
  { id: 'night-circuit-run', title: 'Night Circuit Run', filename: 'Night Circuit Run.m4a' },
  { id: 'neon-pulse', title: 'Neon Pulse', filename: 'Neon Pulse.m4a' },
  { id: 'neon-horizon', title: 'Neon Horizon', filename: 'Neon Horizon.m4a' },
  { id: 'night-circuit-run-2', title: 'Night Circuit Run-2', filename: 'Night Circuit Run-2.m4a' }
];

export const INTER_TRACK_PAUSE_MS = 15000; // 15 seconds pause between songs

export function resolveMusicUrl(filename) {
  if (!filename) return '';
  const clean = filename.replace(/^\/+/, '');
  const encoded = encodeURIComponent(clean);
  return `./music/${encoded}`;
}

export function generateShuffledIndices(count, previousLastIndex = null) {
  if (count <= 0) return [];
  const indices = Array.from({ length: count }, (_, i) => i);
  
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Prevent immediate repetition of the previous song across cycles
  if (count > 1 && previousLastIndex !== null && indices[0] === previousLastIndex) {
    const swapTarget = 1 + Math.floor(Math.random() * (count - 1));
    [indices[0], indices[swapTarget]] = [indices[swapTarget], indices[0]];
  }

  return indices;
}

export class MusicController {
  constructor(tracks = BGM_TRACKS, pauseDurationMs = INTER_TRACK_PAUSE_MS) {
    this.tracks = tracks;
    this.pauseDurationMs = pauseDurationMs;
    this.queue = [];
    this.queueIndex = 0;
    this.audio = null;
    this.muted = false;
    this.volume = 0.35; // Comfortable ambient background level
    this.isPlaying = false;
    this.isWaitingForNext = false;
    this.nextTrackTimeout = null;
    this.lastPlayedTrackIndex = null;
    this.hasUnlockedAudio = false;
    this.interactionListenersAttached = false;
  }

  init() {
    if (typeof window === 'undefined') return;

    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.volume = this.volume;
      this.audio.muted = this.muted;

      this.audio.addEventListener('ended', () => {
        this.handleTrackEnded();
      });

      this.audio.addEventListener('error', (e) => {
        console.warn('[MusicController] Audio playback error or file not found:', this.getCurrentTrack()?.filename, e);
        // If track failed to load (e.g. file missing), wait pause duration before trying next track
        this.scheduleNextTrack();
      });

      // Visibility change: pause on hidden, resume on visible if was playing
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            if (this.audio && !this.audio.paused) {
              this.audio.pause();
            }
          } else {
            if (this.isPlaying && !this.muted && this.audio && !this.isWaitingForNext) {
              this.audio.play().catch(() => {});
            }
          }
        });
      }
    }

    this.setupInteractionUnlock();
  }

  setupInteractionUnlock() {
    if (typeof window === 'undefined' || this.interactionListenersAttached || this.hasUnlockedAudio) return;

    const unlock = () => {
      this.hasUnlockedAudio = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      }
      if (this.isPlaying && !this.muted && this.audio && this.audio.paused && !this.isWaitingForNext) {
        this.audio.play().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true, once: true });
    window.addEventListener('keydown', unlock, { passive: true, once: true });
    window.addEventListener('touchstart', unlock, { passive: true, once: true });
    this.interactionListenersAttached = true;
  }

  start() {
    this.init();
    this.isPlaying = true;

    if (this.muted) return;

    if (this.queue.length === 0 || this.queueIndex >= this.queue.length) {
      this.startNewShuffleCycle();
    } else {
      this.playCurrentQueueTrack();
    }
  }

  pause() {
    this.isPlaying = false;
    this.clearPauseTimer();
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(mute) {
    this.muted = Boolean(mute);
    if (this.audio) {
      this.audio.muted = this.muted;
    }

    if (this.muted) {
      if (this.audio && !this.audio.paused) {
        this.audio.pause();
      }
    } else if (this.isPlaying) {
      if (this.isWaitingForNext) {
        // Still in 15s pause countdown, let timer handle it
      } else if (this.audio && this.audio.paused) {
        this.audio.play().catch((err) => {
          console.warn('[MusicController] Resume failed upon unmute:', err);
        });
      } else if (this.queue.length === 0) {
        this.start();
      }
    }
  }

  isMuted() {
    return this.muted;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  getVolume() {
    return this.volume;
  }

  startNewShuffleCycle() {
    this.queue = generateShuffledIndices(this.tracks.length, this.lastPlayedTrackIndex);
    this.queueIndex = 0;
    this.playCurrentQueueTrack();
  }

  getCurrentTrack() {
    if (this.queue.length === 0 || this.queueIndex >= this.queue.length) return null;
    const trackIndex = this.queue[this.queueIndex];
    return this.tracks[trackIndex] || null;
  }

  playCurrentQueueTrack() {
    this.clearPauseTimer();
    this.isWaitingForNext = false;

    const track = this.getCurrentTrack();
    if (!track) return;

    this.lastPlayedTrackIndex = this.queue[this.queueIndex];

    if (typeof window === 'undefined' || !this.audio) return;

    const trackUrl = resolveMusicUrl(track.filename);
    if (this.audio.src !== trackUrl && !this.audio.src.endsWith(track.filename)) {
      this.audio.src = trackUrl;
      this.audio.load();
    }

    if (!this.muted && this.isPlaying) {
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Expected on first page load before user interaction
          if (err.name !== 'NotAllowedError') {
            console.warn('[MusicController] Play interrupted:', err.message);
          }
        });
      }
    }
  }

  handleTrackEnded() {
    this.scheduleNextTrack();
  }

  scheduleNextTrack() {
    this.clearPauseTimer();
    this.isWaitingForNext = true;

    // Advance queue index
    this.queueIndex += 1;

    // Check if full cycle finished
    if (this.queueIndex >= this.queue.length) {
      // All 4 songs played! Wait 15s pause, then start new shuffle
      this.nextTrackTimeout = setTimeout(() => {
        this.isWaitingForNext = false;
        if (this.isPlaying) {
          this.startNewShuffleCycle();
        }
      }, this.pauseDurationMs);
    } else {
      // Play next song in current cycle after 15s pause
      this.nextTrackTimeout = setTimeout(() => {
        this.isWaitingForNext = false;
        if (this.isPlaying) {
          this.playCurrentQueueTrack();
        }
      }, this.pauseDurationMs);
    }
  }

  skip() {
    this.clearPauseTimer();
    this.isWaitingForNext = false;
    this.queueIndex += 1;
    if (this.queueIndex >= this.queue.length) {
      this.startNewShuffleCycle();
    } else {
      this.playCurrentQueueTrack();
    }
  }

  clearPauseTimer() {
    if (this.nextTrackTimeout) {
      clearTimeout(this.nextTrackTimeout);
      this.nextTrackTimeout = null;
    }
  }

  getState() {
    return {
      isPlaying: this.isPlaying,
      isWaitingForNext: this.isWaitingForNext,
      muted: this.muted,
      volume: this.volume,
      currentTrack: this.getCurrentTrack(),
      queue: [...this.queue],
      queueIndex: this.queueIndex
    };
  }
}

export const music = new MusicController();
