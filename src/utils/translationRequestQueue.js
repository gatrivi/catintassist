/** In-flight dedup + concurrency cap for translation API calls — v4.50.0 */

const IN_FLIGHT = new Map();
let activeSlots = 0;
// Free/public engines: one mouthful at a time avoids bursty request patterns.
export const TRANSLATION_MAX_SLOTS = 1;
// Live interpreting serves one turn at a time, so a deep backlog would deliver
// the newest speech LAST. Past this depth the oldest queued turn is dropped —
// by then it is stale, and the fresh words must not queue behind it.
const MAX_QUEUE_DEPTH = 8;
const waitQueue = [];

const abortError = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });

const pumpQueue = () => {
  while (activeSlots < TRANSLATION_MAX_SLOTS && waitQueue.length) {
    const next = waitQueue.shift();
    // A caller that aborted (new STT text, unmount) leaves its queued closure
    // behind; running it would burn a slot on text nobody will display.
    if (next.isAborted()) {
      next.cancel();
      continue;
    }
    next.run();
  }
};

export const withTranslationSlot = (fn, { signal } = {}) =>
  new Promise((resolve, reject) => {
    const isAborted = () => Boolean(signal?.aborted);
    const run = () => {
      if (isAborted()) {
        reject(abortError());
        return;
      }
      activeSlots += 1;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          activeSlots -= 1;
          pumpQueue();
        });
    };
    if (activeSlots < TRANSLATION_MAX_SLOTS) run();
    else {
      while (waitQueue.length >= MAX_QUEUE_DEPTH) waitQueue.shift().cancel();
      waitQueue.push({ run, isAborted, cancel: () => reject(abortError()) });
    }
  });

/** Queue depth, for tests and diagnostics only. */
export const getTranslationQueueState = () => ({ activeSlots, queued: waitQueue.length });

export const dedupeInFlight = (key, fn) => {
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);
  const p = Promise.resolve().then(fn).finally(() => IN_FLIGHT.delete(key));
  IN_FLIGHT.set(key, p);
  return p;
};
