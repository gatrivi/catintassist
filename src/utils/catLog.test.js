import { catLog, catWarn, catError, serializeArg, _resetForTest } from './catLog';

describe('catLog ring buffer & de-noiser', () => {
  beforeEach(() => {
    _resetForTest();
  });

  test('dump returns text with header, warn entries first, counts repeats', () => {
    catLog('[Deepgram:open]', { lang: 'en' });
    catWarn('[CAT VANISH]', 'display_zip_fragment_join', 'zip 3312 -> 33 joined');
    catLog('[Deepgram:open]', { lang: 'en' }); // repeat → collapses to ×2
    const text = catLogDumpHelper();
    expect(text).toMatch(/CAT log ring/);
    expect(text).toMatch(/CAT VANISH/);
    // warn lines come before info lines
    const vanishIdx = text.indexOf('CAT VANISH');
    const openIdx = text.indexOf('Deepgram:open');
    expect(vanishIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeGreaterThan(vanishIdx);
    expect(text).toMatch(/×2/);
  });

  test('filter narrows dump to matching entries', () => {
    catLog('[Session]', 'start');
    catLog('[Deepgram:close]', { code: 1000 });
    const text = catLogDumpHelper('close');
    expect(text).toMatch(/Deepgram:close/);
    expect(text).not.toMatch(/\[Session\]/);
  });

  test('catError routes to console.error', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    catError('[Deepgram:err]', 'boom');
    expect(spy).toHaveBeenCalledWith('[Deepgram:err]', 'boom');
    spy.mockRestore();
  });

  test('serializeArg preserves native Error name and message instead of {}', () => {
    const err = new Error('Microphone permission denied');
    const serialized = serializeArg(err);
    expect(serialized).toMatch(/Error: Microphone permission denied/);
    expect(serialized).not.toBe('{}');
  });

  test('de-noiser suppresses 200 repetitive console lines within throttle window', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Fire 50 identical warnings in rapid succession
    for (let i = 0; i < 50; i++) {
      catWarn('[CAT STT CRIT] stt stall', { reason: 'empty_packets' });
    }
    // Only the very first one should have reached console.warn
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();

    // The ring buffer still recorded all 50 occurrences
    const dumpText = catLogDumpHelper('stall');
    expect(dumpText).toMatch(/×50/);
  });

  test('__CAT_INCIDENT returns concise snapshot of critical entries', () => {
    catWarn('[Audio:mic]', 'device unavailable');
    catError('[STT:fail]', 'handshake rejected 1006');
    const snap = window.__CAT_INCIDENT(true);
    expect(snap).toMatch(/CAT INCIDENT SNAPSHOT/);
    expect(snap).toMatch(/\[Audio:mic\]/);
    expect(snap).toMatch(/handshake rejected 1006/);
  });
});

function catLogDumpHelper(filter) {
  /* global window */
  return window.__CAT_DUMP(filter, true);
}
