import { failReason, finishPhase, levelBars } from './greetingSend';

test('levelBars clamps to 0..5', () => {
  expect(levelBars(0)).toBe(0);
  expect(levelBars(0.1)).toBe(3);
  expect(levelBars(9)).toBe(5);
});
test('failReason speaks plain words', () => {
  expect(failReason({ name: 'NotAllowedError' })).toMatch(/click the page/);
  expect(failReason(new Error('setSinkId: device not found'))).toMatch(/re-pick Speaker/);
  expect(failReason(new Error('Unable to decode audio data'))).toMatch(/re-record/);
  expect(failReason(null)).toBe('playback error');
});
test('finishPhase: measured silence fails, unmeasured is honest', () => {
  expect(finishPhase({ levelKnown: true, heard: false, secs: 3 }).phase).toBe('failed');
  expect(finishPhase({ levelKnown: true, heard: true, secs: 3.24 }).text).toBe('SENT ✓ 3.2s');
  expect(finishPhase({ levelKnown: false, heard: false, secs: 1 }).text).toMatch(/not measured/);
});
