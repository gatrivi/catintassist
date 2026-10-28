/**
 * v4.195.0 — measure CONNECT for real (replaces guessed reliability %s).
 *
 * A "run" = one call start → first transcribed word. In between we count
 * auto heals (watchdog / deaf monitor) and manual ZAP presses. The last 20
 * runs are kept in localStorage; each closed run writes one ring line
 * ("connect run: …") so __CAT_DUMP('connect run') shows them.
 *
 * Console: __CAT_CONNECTS() → { total, first-try, self-healed, needed-zap, no-words }
 */
export const CONNECT_RUNS_KEY = 'catint_connect_runs_v1';
export const CONNECT_RUNS_MAX = 20;

export const startRun = (now = Date.now()) => ({
  startedAt: now,
  autoHeals: 0,
  zaps: 0,
  firstWordMs: null,
});

/** Count a heal — only while the run is still waiting for its first word. */
export function noteRunHeal(run, kind) {
  if (!run || run.firstWordMs != null) return;
  if (kind === 'zap') run.zaps += 1;
  else run.autoHeals += 1;
}

export function runOutcome(run) {
  if (run.firstWordMs == null) return 'no-words';
  if (run.zaps) return 'needed-zap';
  if (run.autoHeals) return 'self-healed';
  return 'first-try';
}

export function summarizeRuns(runs = []) {
  const out = { total: runs.length, 'first-try': 0, 'self-healed': 0, 'needed-zap': 0, 'no-words': 0 };
  runs.forEach((r) => {
    out[runOutcome(r)] += 1;
  });
  return out;
}

const store = () => {
  try {
    return window.localStorage;
  } catch (_) {
    return null;
  }
};

export function loadRuns(storage = store()) {
  try {
    const list = JSON.parse(storage?.getItem(CONNECT_RUNS_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

export function saveRun(run, storage = store()) {
  try {
    const list = [...loadRuns(storage), run].slice(-CONNECT_RUNS_MAX);
    storage?.setItem(CONNECT_RUNS_KEY, JSON.stringify(list));
  } catch (_) {}
}

/**
 * Close the open run held in `ref` (first word, or call ended without one).
 * Returns the closed run, or null when no run was open.
 */
export function endRun(ref, { word = false, now = Date.now(), storage } = {}) {
  const run = ref?.current;
  if (!run) return null;
  ref.current = null;
  if (word) run.firstWordMs = now - run.startedAt;
  run.outcome = runOutcome(run);
  saveRun(run, storage);
  return run;
}

/** One readable ring line per run. */
export const describeRun = (run) =>
  `connect run: ${run.outcome} · first word ${
    run.firstWordMs == null ? '—' : `${(run.firstWordMs / 1000).toFixed(1)}s`
  } · auto ${run.autoHeals} · zap ${run.zaps}`;

if (typeof window !== 'undefined') {
  window.__CAT_CONNECTS = () => summarizeRuns(loadRuns());
}
