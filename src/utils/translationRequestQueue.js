/** In-flight dedup + concurrency cap for translation API calls — v4.50.0 */

const IN_FLIGHT = new Map();
let activeSlots = 0;
const MAX_SLOTS = 2;
const waitQueue = [];

const pumpQueue = () => {
  while (activeSlots < MAX_SLOTS && waitQueue.length) {
    const next = waitQueue.shift();
    next();
  }
};

export const withTranslationSlot = (fn) =>
  new Promise((resolve, reject) => {
    const run = () => {
      activeSlots += 1;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          activeSlots -= 1;
          pumpQueue();
        });
    };
    if (activeSlots < MAX_SLOTS) run();
    else waitQueue.push(run);
  });

export const dedupeInFlight = (key, fn) => {
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);
  const p = Promise.resolve().then(fn).finally(() => IN_FLIGHT.delete(key));
  IN_FLIGHT.set(key, p);
  return p;
};
