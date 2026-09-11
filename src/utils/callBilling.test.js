import { billableSecondsForCall, NO_STT_MIN_CALL_SECS } from './callBilling';

/**
 * v4.99.2 ledger tests — the three scoreboard bugs:
 * no-STT calls banked 0 (156m month), re-attach double-bank, cross-day leak.
 */
describe('billableSecondsForCall', () => {
  test('no-STT call ≥60s banks wall-clock (DG outage ≠ unpaid work)', () => {
    expect(billableSecondsForCall({ hadSpeech: false, sessionSeconds: 3600 }))
      .toBe(3600);
    expect(billableSecondsForCall({ hadSpeech: false, sessionSeconds: 60 }))
      .toBe(60);
  });

  test('no-STT call <60s banks 0 (dead/accidental call)', () => {
    expect(billableSecondsForCall({ hadSpeech: false, sessionSeconds: 59 }))
      .toBe(0);
    expect(billableSecondsForCall({ hadSpeech: false, sessionSeconds: 0 }))
      .toBe(0);
  });

  test('speech call trims >30s trailing silence only', () => {
    expect(billableSecondsForCall({ hadSpeech: true, sessionSeconds: 600, trailingSilenceSecs: 45 }))
      .toBe(555);
    expect(billableSecondsForCall({ hadSpeech: true, sessionSeconds: 600, trailingSilenceSecs: 30 }))
      .toBe(600);
  });

  test('speech call never goes negative', () => {
    expect(billableSecondsForCall({ hadSpeech: true, sessionSeconds: 10, trailingSilenceSecs: 500 }))
      .toBe(0);
  });

  test('threshold constant is 60s', () => {
    expect(NO_STT_MIN_CALL_SECS).toBe(60);
  });
});
