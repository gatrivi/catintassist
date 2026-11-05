import { startRun, noteRunHeal, endRun, runOutcome, summarizeRuns, loadRuns, describeRun } from './connectRuns';

const mem = () => {
  const m = {};
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } };
};

describe('connectRuns (v4.195.0)', () => {
  test('first word with no heals = first-try', () => {
    const ref = { current: startRun(1000) };
    const run = endRun(ref, { word: true, now: 3500, storage: mem() });
    expect(run.outcome).toBe('first-try');
    expect(run.firstWordMs).toBe(2500);
    expect(ref.current).toBeNull();
  });
  test('auto heal then word = self-healed; zap wins over auto', () => {
    const r = startRun(0);
    noteRunHeal(r, 'auto');
    r.firstWordMs = 5;
    expect(runOutcome(r)).toBe('self-healed');
    r.firstWordMs = null;
    noteRunHeal(r, 'zap');
    r.firstWordMs = 9;
    expect(runOutcome(r)).toBe('needed-zap');
  });
  test('heals after the first word do not count', () => {
    const r = startRun(0);
    r.firstWordMs = 100;
    noteRunHeal(r, 'zap');
    expect(r.zaps).toBe(0);
  });
  test('call ended wordless = no-words; history capped at 20', () => {
    const storage = mem();
    for (let i = 0; i < 25; i++) endRun({ current: startRun(i) }, { storage });
    const runs = loadRuns(storage);
    expect(runs).toHaveLength(20);
    expect(summarizeRuns(runs)['no-words']).toBe(20);
  });
  test('no open run = null, nothing saved', () => {
    expect(endRun({ current: null }, { storage: mem() })).toBeNull();
  });
  test('ring line is readable', () => {
    const ref = { current: startRun(0) };
    expect(describeRun(endRun(ref, { word: true, now: 1200, storage: mem() }))).toBe(
      'connect run: first-try · first word 1.2s · auto 0 · zap 0',
    );
  });
});

describe('runCause — a failed CONNECT names its cause (v4.207.0)', () => {
  const { startRun: sr, noteRunSignal: sig, runCause: cause, endRun: end, summarizeRuns: sum } = require('./connectRuns');
  const mem = () => { const m = {}; return { getItem: (k) => m[k] || null, setItem: (k, v) => { m[k] = v; } }; };
  it('Deepgram never answered → no-reply', () => {
    const ref = { current: sr(0) };
    expect(end(ref, { storage: mem() }).cause).toBe('no-reply');
  });
  it('answered, nobody heard → quiet-line', () => {
    const ref = { current: sr(0) };
    sig(ref.current, 'dg', 500);
    expect(end(ref, { storage: mem() }).cause).toBe('quiet-line');
  });
  it('answered + caller heard + no words → deaf', () => {
    const ref = { current: sr(0) };
    sig(ref.current, 'dg', 500);
    sig(ref.current, 'speech', 3000);
    expect(end(ref, { storage: mem() }).cause).toBe('deaf');
  });
  it('first try → ok; signals after the first word are ignored', () => {
    const ref = { current: sr(0) };
    const run = end(ref, { word: true, now: 900, storage: mem() });
    expect(run.cause).toBe('ok');
    sig(run, 'dg', 2000);
    expect(run.dgMsgMs).toBeUndefined();
  });
  it('summary counts causes', () => {
    expect(sum([{ outcome: 'no-words', firstWordMs: null, cause: 'deaf' }, { firstWordMs: 1, autoHeals: 0, zaps: 0, cause: 'ok' }]).causes).toEqual({ deaf: 1 });
  });
});
