/**
 * catLog — retroactive debug recorder (v4.135.0)
 *
 * Problem it solves: console floods ([Deepgram] socket events) bury the rare
 * [CAT VANISH] warns that trace vanished numbers/zips. Debugging happens AFTER
 * the incident, so the recorder must already be running — no toggle.
 *
 * Usage:
 *   import { catLog, catWarn, catError } from '../utils/catLog';
 *   catLog('[Deepgram:open]', { lang, socketSide });   // console + ring
 *   catWarn('[CAT VANISH]', reason, entry);            // console + ring, kept longer
 *
 * Retrieval after an incident (browser console):
 *   __CAT_DUMP()                    // print ring (warn/error first, deduped)
 *   __CAT_DUMP('zip')               // only entries matching /zip/i
 *   copy(__CAT_DUMP('zip', true))   // second arg = return raw text instead of printing
 *
 * Ring: last RING_MAX info entries + always the last RING_MAX_WARN warn/error
 * entries (warns get their own guaranteed window so Deepgram spam can't evict them).
 * Repeats of the same label+text collapse into a count instead of new lines.
 */

const RING_MAX = 500;
const RING_MAX_WARN = 500;

const ring = []; // mixed entries: { t, level, label, text, count }
let warnCount = 0; // entries at level warn/error currently in ring

function serialize(args) {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

function record(level, label, args) {
  const text = serialize(args);
  const entry = { t: new Date().toISOString().slice(11, 23), level, label, text, count: 1 };

  // Collapse exact repeats (same label + text): bump count, refresh timestamp.
  for (let i = ring.length - 1; i >= 0 && i >= ring.length - 20; i--) {
    const prev = ring[i];
    if (prev.label === label && prev.text === text && prev.level === level) {
      prev.count += 1;
      prev.t = entry.t;
      return;
    }
  }

  if (level !== 'info') {
    ring.push(entry);
    warnCount += 1;
    // Evict oldest info entries first; only evict warns once info is gone.
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
}

function emit(level, label, args) {
  if (level === 'error') console.error(label, ...args);
  else if (level === 'warn') console.warn(label, ...args);
  else console.log(label, ...args);
  record(level, label, args);
}

export const catLog = (label, ...args) => emit('info', label, args);
export const catWarn = (label, ...args) => emit('warn', label, args);
export const catError = (label, ...args) => emit('error', label, args);

/** Dump the ring: warn/error entries first, newest last. filter = substring/regex on label+text. */
function dump(filter, returnText) {
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

if (typeof window !== 'undefined' && !window.__CAT_DUMP) {
  window.__CAT_DUMP = dump;
}

export default catLog;
