/**
 * Off-Call Minute Chime (v4.213.0).
 *
 * Plays a subtle, non-intrusive harmonic chime for each minute off call.
 * The tune automatically adapts depending on whether the user is:
 * 1. On break:
 *    - break_healthy: warm, calming tea/zen chime (budget healthy >=15m)
 *    - break_low: gentle two-tone chime (budget winding down <15m)
 *    - break_overtime: soft cautionary pulses (break budget exhausted)
 * 2. On standby waiting between calls:
 *    - ahead: bright, ascending major triad (ahead of month pace by >30m)
 *    - on_pace: clean, balanced perfect fifth (within ±30m of pace)
 *    - behind_mild: gentle descending cautionary interval (behind pace by >30m, <=5m idle)
 *    - behind_urgent: lower minor 3rd (behind pace and idle >5m)
 *
 * Work-safe: strictly silent during active calls (!isActive only).
 */

export const CHIME_STORAGE_KEY = 'catint_off_call_chime_v1';

export const CHIME_TUNES = {
  ahead: {
    id: 'ahead',
    label: 'Ahead of pace',
    emoji: '🎵',
    notes: [
      { freq: 523.25, duration: 0.18, delay: 0.0, type: 'triangle' }, // C5
      { freq: 659.25, duration: 0.18, delay: 0.12, type: 'triangle' }, // E5
      { freq: 783.99, duration: 0.40, delay: 0.24, type: 'sine' },     // G5
    ],
  },
  on_pace: {
    id: 'on_pace',
    label: 'On pace',
    emoji: '🔔',
    notes: [
      { freq: 587.33, duration: 0.22, delay: 0.0, type: 'triangle' }, // D5
      { freq: 880.00, duration: 0.42, delay: 0.14, type: 'sine' },     // A5
    ],
  },
  behind_mild: {
    id: 'behind_mild',
    label: 'Behind pace',
    emoji: '🛎️',
    notes: [
      { freq: 523.25, duration: 0.24, delay: 0.0, type: 'triangle' }, // C5
      { freq: 440.00, duration: 0.38, delay: 0.16, type: 'sine' },     // A4
    ],
  },
  behind_urgent: {
    id: 'behind_urgent',
    label: 'Behind pace (idle >5m)',
    emoji: '⚠️',
    notes: [
      { freq: 392.00, duration: 0.26, delay: 0.0, type: 'triangle' }, // G4
      { freq: 311.13, duration: 0.42, delay: 0.18, type: 'sine' },     // Eb4
    ],
  },
  break_healthy: {
    id: 'break_healthy',
    label: 'Break (calm)',
    emoji: '☕',
    notes: [
      { freq: 528.00, duration: 0.50, delay: 0.0, type: 'sine' },
      { freq: 792.00, duration: 0.65, delay: 0.08, type: 'sine' },
    ],
  },
  break_low: {
    id: 'break_low',
    label: 'Break winding down (<15m)',
    emoji: '⏳',
    notes: [
      { freq: 659.25, duration: 0.18, delay: 0.0, type: 'triangle' }, // E5
      { freq: 523.25, duration: 0.35, delay: 0.14, type: 'triangle' }, // C5
    ],
  },
  break_overtime: {
    id: 'break_overtime',
    label: 'Break overtime',
    emoji: '⏱️',
    notes: [
      { freq: 440.00, duration: 0.14, delay: 0.0, type: 'triangle' },
      { freq: 440.00, duration: 0.14, delay: 0.18, type: 'triangle' },
      { freq: 440.00, duration: 0.26, delay: 0.36, type: 'triangle' },
    ],
  },
  call_silence: {
    id: 'call_silence',
    label: 'Call silence (>1m)',
    emoji: '🤫',
    notes: [
      { freq: 440.00, duration: 0.22, delay: 0.0, type: 'triangle' }, // A4
      { freq: 392.00, duration: 0.35, delay: 0.16, type: 'sine' },     // G4
    ],
  },
  hold_overtime: {
    id: 'hold_overtime',
    label: 'Hold overtime (>15m)',
    emoji: '⏸️',
    notes: [
      { freq: 523.25, duration: 0.15, delay: 0.0, type: 'triangle' }, // C5
      { freq: 523.25, duration: 0.15, delay: 0.20, type: 'triangle' }, // C5
      { freq: 659.25, duration: 0.35, delay: 0.40, type: 'triangle' }, // E5
    ],
  },
};

/**
 * Pure resolver: maps off-call and in-call state into the corresponding chime tune.
 * Returns null if currently silent (e.g. normal conversation or active hold under 15m).
 */
export const resolveOffCallChimeTone = ({
  isBreakActive = false,
  breakLeft = 90,
  idleSecs = 0,
  deficitMins = 0,
  gap = null,
  isActive = false,
  isHold = false,
  holdSeconds = 0,
  silenceSecs = 0,
} = {}) => {
  // Case 1: In active call
  if (isActive) {
    if (isHold) {
      // Hold mutes chime for first 15m (900s). Overtime chimes after 15m.
      if (holdSeconds > 900) {
        return CHIME_TUNES.hold_overtime;
      }
      return null;
    }
    // Live call not on hold: silent if speech occurred within last 60s
    if (silenceSecs < 60) {
      return null;
    }
    // Mid-call silence >= 60s without hold
    return CHIME_TUNES.call_silence;
  }

  // Case 2: On break
  if (isBreakActive) {
    if (breakLeft <= 0) return CHIME_TUNES.break_overtime;
    if (breakLeft < 15) return CHIME_TUNES.break_low;
    return CHIME_TUNES.break_healthy;
  }

  // Case 3: Off-call standby waiting between calls
  const effectiveDeficit = gap !== null && Number.isFinite(Number(gap))
    ? Number(gap)
    : Number(deficitMins) || 0;

  if (effectiveDeficit < -30) {
    return CHIME_TUNES.ahead;
  }
  if (effectiveDeficit <= 30) {
    return CHIME_TUNES.on_pace;
  }
  // Behind pace
  if (idleSecs > 300) {
    return CHIME_TUNES.behind_urgent;
  }
  return CHIME_TUNES.behind_mild;
};

/** Default chime settings */
export const DEFAULT_CHIME_SETTINGS = {
  enabled: true,
  volume: 0.6, // 0.1 to 1.0
};

export const readOffCallChimeSettings = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_CHIME_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(CHIME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CHIME_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_CHIME_SETTINGS.enabled,
      volume: typeof parsed.volume === 'number' && parsed.volume >= 0.05 && parsed.volume <= 1
        ? parsed.volume
        : DEFAULT_CHIME_SETTINGS.volume,
    };
  } catch {
    return { ...DEFAULT_CHIME_SETTINGS };
  }
};

export const saveOffCallChimeSettings = (settings = {}) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const curr = readOffCallChimeSettings();
    const next = { ...curr, ...settings };
    localStorage.setItem(CHIME_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('catint_chime_settings_changed', { detail: next }));
  } catch {}
};

/** Shared singleton AudioContext for synthetic chimes */
let sharedChimeCtx = null;

const getChimeAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedChimeCtx || sharedChimeCtx.state === 'closed') {
    sharedChimeCtx = new Ctx();
  }
  if (sharedChimeCtx.state === 'suspended') {
    sharedChimeCtx.resume?.().catch(() => {});
  }
  return sharedChimeCtx;
};

// Auto-unlock AudioContext on first user interaction in the tab
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      if (sharedChimeCtx && sharedChimeCtx.state === 'suspended') {
        sharedChimeCtx.resume().catch(() => {});
      }
    } catch (_) {}
  };
  window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { capture: true, passive: true });
}

/**
 * Synthesizes and plays a chime tune.
 * Returns an object with `stop()` for immediate cancel on call connect.
 */
export const playOffCallChime = (tuneIdOrObj, options = {}) => {
  if (!tuneIdOrObj) return { stop: () => {} };
  const tune = typeof tuneIdOrObj === 'string'
    ? CHIME_TUNES[tuneIdOrObj] || CHIME_TUNES.on_pace
    : tuneIdOrObj || CHIME_TUNES.on_pace;

  const ctx = options.audioCtx || getChimeAudioContext();
  if (!ctx) return { stop: () => {} };

  // Explicitly attempt resume if suspended
  if (ctx.state === 'suspended') {
    ctx.resume?.().catch(() => {});
  }

  const settings = readOffCallChimeSettings();
  if (options.force !== true && !settings.enabled) return { stop: () => {} };

  const volume = typeof options.volume === 'number' ? options.volume : settings.volume;
  const t = ctx.currentTime + 0.01;

  // Master Gain capped at 0.25 for clear, comfortable audibility
  const masterGain = ctx.createGain();
  const peakVolume = Math.max(0.02, Math.min(0.25, volume * 0.20));
  masterGain.gain.setValueAtTime(peakVolume, t);
  masterGain.connect(ctx.destination);

  const activeOscillators = [];

  (tune.notes || []).forEach((n) => {
    const start = t + (n.delay || 0);
    const duration = n.duration || 0.3;

    const osc = ctx.createOscillator();
    osc.type = n.type || 'triangle';
    osc.frequency.setValueAtTime(n.freq, start);

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0, start);
    // Smooth 6ms linear attack to eliminate clicks
    noteGain.gain.linearRampToValueAtTime(1, start + 0.006);
    // Smooth exponential decay
    noteGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(noteGain);
    noteGain.connect(masterGain);

    osc.start(start);
    osc.stop(start + duration + 0.02);
    activeOscillators.push(osc);
  });

  return {
    stop: () => {
      try {
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
        activeOscillators.forEach((osc) => {
          try { osc.stop(); } catch {}
        });
      } catch {}
    },
  };
};
