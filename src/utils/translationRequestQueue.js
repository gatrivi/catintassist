/** In-flight dedup + concurrency cap for translation API calls — v4.50.0 */

const IN_FLIGHT = new Map();
// Free/public engines: one mouthful at a time PER DIRECTION avoids bursty
// request patterns. v4.178.0: a lane per direction (en-es / es-en) — the local
// server already gates per direction, so a long EN turn no longer blocks the ES one.
export const TRANSLATION_MAX_SLOTS = 1;
// Live interpreting serves one turn at a time, so a deep backlog would deliver
// the newest speech LAST. Past this depth the oldest queued turn is dropped —
// by then it is stale, and the fresh words must not queue behind it.
const MAX_QUEUE_DEPTH = 8;
const DEFAULT_LANE = 'default';
/** lane -> { active, queue } */
const LANES = new Map();

const getLane = (lane = DEFAULT_LANE) => {
  if (!LANES.has(lane)) LANES.set(lane, { active: 0, queue: [] });
  return LANES.get(lane);
};

const abortError = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });

const pumpQueue = (l) => {
  while (l.active < TRANSLATION_MAX_SLOTS && l.queue.length) {
    const next = l.queue.shift();
    // A caller that aborted (new STT text, unmount) leaves its queued closure
    // behind; running it would burn a slot on text nobody will display.
    if (next.isAborted()) {
      next.cancel();
      continue;
    }
    next.run();
  }
};

export const withTranslationSlot = (fn, { signal, lane } = {}) =>
  new Promise((resolve, reject) => {
    const l = getLane(lane);
    const isAborted = () => Boolean(signal?.aborted);
    const run = () => {
      if (isAborted()) {
        reject(abortError());
        return;
      }
      l.active += 1;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          l.active -= 1;
          pumpQueue(l);
        });
    };
    if (l.active < TRANSLATION_MAX_SLOTS) run();
    else {
      while (l.queue.length >= MAX_QUEUE_DEPTH) l.queue.shift().cancel();
      l.queue.push({ run, isAborted, cancel: () => reject(abortError()) });
    }
  });

/** Queue depth of one lane, for tests and diagnostics only. */
export const getTranslationQueueState = (lane) => {
  const l = getLane(lane);
  return { activeSlots: l.active, queued: l.queue.length };
};

export const dedupeInFlight = (key, fn) => {
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);
  const p = Promise.resolve().then(fn).finally(() => IN_FLIGHT.delete(key));
  IN_FLIGHT.set(key, p);
  return p;
};
