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

/** v4.205.0: loudest tick + learned noise floor while waiting for the first
 * word — tells us if a miss was "too quiet to notice" or "deaf socket". */
export function noteRunLevel(run, gate) {
  if (!run || run.firstWordMs != null || !gate) return;
  run.rmsPeak = Math.max(run.rmsPeak || 0, gate.peak || 0);
  run.rmsFloor = gate.floor;
}

/** v4.207.0: first time (ms after call start) a signal showed up before the
 * first word. 'dg' = Deepgram answered anything; 'speech' = VAD heard caller. */
export function noteRunSignal(run, kind, now = Date.now()) {
  if (!run || run.firstWordMs != null) return;
  const key = kind === 'dg' ? 'dgMsgMs' : 'speechMs';
  if (run[key] == null) run[key] = now - run.startedAt;
}

/**
 * v4.207.0: best guess WHY a run had trouble — so a failed CONNECT names
 * its own cause instead of us guessing percentages.
 *   ok          first try, nothing to explain
 *   no-reply    Deepgram never sent anything (network / key / socket)
 *   quiet-line  nobody was heard (silent call, or audio too quiet/missing)
 *   deaf        caller heard + Deepgram answering, still no words
 */
export function runCause(run) {
  if (!run) return 'ok';
  if (run.outcome === 'first-try') return 'ok';
  if (run.dgMsgMs == null) return 'no-reply';
  if (run.speechMs == null) return 'quiet-line';
  return 'deaf';
}

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
  const causes = {};
  runs.forEach((r) => {
    out[runOutcome(r)] += 1;
    if (r.cause && r.cause !== 'ok') causes[r.cause] = (causes[r.cause] || 0) + 1;
  });
  if (Object.keys(causes).length) out.causes = causes; // v4.207.0
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
  run.cause = runCause(run); // v4.207.0
  saveRun(run, storage);
  return run;
}

/** One readable ring line per run. */
export const describeRun = (run) =>
  `connect run: ${run.outcome} · first word ${
    run.firstWordMs == null ? '—' : `${(run.firstWordMs / 1000).toFixed(1)}s`
  } · auto ${run.autoHeals} · zap ${run.zaps}${
    run.rmsPeak != null ? ` · peak ${run.rmsPeak.toFixed(3)} floor ${(run.rmsFloor || 0).toFixed(3)}` : ''
  }${run.cause && run.cause !== 'ok' ? ` · cause ${run.cause}` : ''}`;

if (typeof window !== 'undefined') {
  window.__CAT_CONNECTS = () => summarizeRuns(loadRuns());
}
