/**
 * catLog — retroactive debug recorder & console de-noiser (v4.200.0)
 *
 * Problem it solves:
 * 1. Console floods (repetitive warnings, socket chatter, packet ticks) bury
 *    the single critical line (e.g. why Deepgram dropped or mic died) under 200
 *    repetitive lines.
 * 2. Standard JSON.stringify(new Error()) renders `{}` — erasing error messages
 *    and stacks from debug traces.
 * 3. Diagnostics were fractured across multiple uncoordinated logging hooks.
 *
 * How it works:
 * - Single logger for the app: catLog (info), catWarn (warn), catError (error).
 * - Safe error serialization: preserves Error names, messages, causes, and stacks.
 * - Live console de-noising: identical consecutive or alternating logs within
 *   3 seconds are suppressed from spamming the browser console. When the flood
 *   pauses, a single summary badge [×N] is emitted. The first occurrence always
 *   prints instantly with 0ms delay.
 * - In-memory ring buffer: holds the complete audit trail (warns/errors prioritized,
 *   repeats collapsed into counts `×N`).
 *
 * Retrieval:
 *   __CAT_DUMP()              // full ring (warn/error first, deduped)
 *   __CAT_DUMP('filter')      // matching regex or substring
 *   __CAT_INCIDENT()          // clean 15-line incident snapshot (auto-copied)
 */

const RING_MAX = 500;
const RING_MAX_WARN = 500;
const CONSOLE_THROTTLE_MS = 3000;
const MAX_HISTORY_KEYS = 300;

const ring = []; // mixed entries: { t, level, label, text, count }
let warnCount = 0; // entries at level warn/error currently in ring

// Track console emissions to prevent spamming 200 repetitive lines to DevTools
const consoleHistory = new Map(); // key -> { lastEmittedAt, suppressed }

export function serializeArg(a) {
  if (a == null) return String(a);
  if (typeof a === 'string') return a;
  if (a instanceof Error || (typeof a === 'object' && a && 'message' in a && 'stack' in a)) {
    const msg = a.name ? `${a.name}: ${a.message}` : a.message;
    const stack = a.stack ? `\n${a.stack}` : '';
    const cause = a.cause ? `\nCaused by: ${serializeArg(a.cause)}` : '';
    return `${msg}${stack}${cause}`;
  }
  if (typeof DOMException !== 'undefined' && a instanceof DOMException) {
    return `DOMException (${a.name}): ${a.message}`;
  }
  if (typeof Event !== 'undefined' && a instanceof Event) {
    return `Event (${a.type})${a.target ? ` target=${a.target.constructor?.name || 'unknown'}` : ''}`;
  }
  try {
    return JSON.stringify(a, (key, value) => {
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
      }
      return value;
    });
  } catch {
    return String(a);
  }
}

export function serialize(args) {
  return args.map(serializeArg).join(' ');
}

function record(level, label, text) {
  const entry = { t: new Date().toISOString().slice(11, 23), level, label, text, count: 1 };

  // Collapse exact repeats (same label + text): bump count, refresh timestamp.
  // Look back up to 50 entries to catch alternating A/B/A/B spam loops.
  for (let i = ring.length - 1; i >= 0 && i >= ring.length - 50; i--) {
    const prev = ring[i];
    if (prev.label === label && prev.text === text && prev.level === level) {
      prev.count += 1;
      prev.t = entry.t;
      return prev;
    }
  }

  if (level !== 'info') {
    ring.push(entry);
    warnCount += 1;
    while (warnCount > RING_MAX_WARN) {
      const idx = ring.findIndex((e) => e.level === 'info');
      if (idx !== -1) {
        ring.splice(idx, 1);
      } else {
        const dropped = ring.shift();
        if (dropped) warnCount -= 1;
      }
    }
  } else {
    ring.push(entry);
    while (ring.length > RING_MAX) {
      const dropped = ring.shift();
      if (dropped && dropped.level !== 'info') warnCount -= 1;
    }
  }

  return entry;
}

export const verboseConsole = () => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('catint_log_verbose') === '1';
  } catch {
    return false;
  }
};

function rawConsoleEmit(level, label, args) {
  if (level === 'error') console.error(label, ...args);
  else if (level === 'warn') console.warn(label, ...args);
  else console.log(label, ...args);
}

function emit(level, label, args) {
  const text = serialize(args);
  record(level, label, text);

  // Info lines stay in ring only unless verbose mode is explicitly opted-in
  if (level === 'info' && !verboseConsole()) {
    return;
  }

  // De-noise live console: throttle duplicate lines so 200 identical warnings don't scroll
  const key = `${level}:${label}:${text}`;
  const now = Date.now();
  const history = consoleHistory.get(key);

  if (!history) {
    consoleHistory.set(key, { lastEmittedAt: now, suppressed: 0 });
    if (consoleHistory.size > MAX_HISTORY_KEYS) {
      const oldestKey = consoleHistory.keys().next().value;
      consoleHistory.delete(oldestKey);
    }
    rawConsoleEmit(level, label, args);
    return;
  }

  if (now - history.lastEmittedAt < CONSOLE_THROTTLE_MS) {
    history.suppressed += 1;
    return;
  }

  // Window elapsed: emit updated count
  const count = history.suppressed;
  history.lastEmittedAt = now;
  history.suppressed = 0;
  const prefix = count > 0 ? `[×${count + 1}] ` : '';
  rawConsoleEmit(level, `${prefix}${label}`, args);
}

export const catLog = (label, ...args) => emit('info', label, args);
export const catWarn = (label, ...args) => emit('warn', label, args);
export const catError = (label, ...args) => emit('error', label, args);

/** Dump the ring: warn/error entries first, newest last. filter = substring/regex on label+text. */
export function dump(filter, returnText) {
  const rx =
    filter instanceof RegExp
      ? filter
      : filter
      ? new RegExp(String(filter).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : null;
  const match = (e) => !rx || rx.test(e.label) || rx.test(e.text);
  const sev = { error: 0, warn: 1, info: 2 };
  const lines = ring
    .filter(match)
    .sort((a, b) => sev[a.level] - sev[b.level] || a.t.localeCompare(b.t))
    .map((e) => `${e.t} ${e.level.toUpperCase().padEnd(5)} ${e.label}${e.count > 1 ? ` ×${e.count}` : ''} ${e.text}`);
  const header = `CAT log ring (${lines.length}/${ring.length} entries, ${warnCount} warn/error retained)`;
  const text = [header, ...lines].join('\n');
  if (returnText) return text;
  console.log(text);
}

/**
 * __CAT_INCIDENT(): concise, high-signal snapshot of the incident.
 * Shows the last 15 critical events (deduped) and copies to clipboard if available.
 */
export function incident(returnText = false) {
  const critical = ring
    .filter((e) => e.level === 'error' || e.level === 'warn')
    .slice(-15);

  const lines = [
    `=== CAT INCIDENT SNAPSHOT (${critical.length} critical / ${warnCount} total warns) ===`,
    ...critical.map(
      (e) => `${e.t} ${e.level.toUpperCase().padEnd(5)} ${e.label}${e.count > 1 ? ` ×${e.count}` : ''} ${e.text.slice(0, 200)}`
    ),
  ];

  const text = lines.join('\n');
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  if (returnText) return text;
  console.log(text);
  return 'Snapshot copied to clipboard.';
}

export function _resetForTest() {
  ring.length = 0;
  warnCount = 0;
  consoleHistory.clear();
}

if (typeof window !== 'undefined') {
  if (!window.__CAT_DUMP) window.__CAT_DUMP = dump;
  if (!window.__CAT_INCIDENT) window.__CAT_INCIDENT = incident;

  // Intercept uncaught errors & unhandled rejections into the ring
  if (!window.__catLogGlobalAttached) {
    window.__catLogGlobalAttached = true;
    window.addEventListener('error', (event) => {
      catError('[Global:error]', event.error || event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      catError('[Global:unhandledrejection]', event.reason);
    });
  }
}

export default catLog;
