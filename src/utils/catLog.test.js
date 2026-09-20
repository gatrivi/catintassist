import { catLog, catWarn, catError } from './catLog';

describe('catLog ring buffer', () => {
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
});

function catLogDumpHelper(filter) {
  // __CAT_DUMP is attached in jsdom too
  /* global window */
  return window.__CAT_DUMP(filter, true);
}
