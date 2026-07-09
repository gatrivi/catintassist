import {
  PHASE0_SMOKE_ITEMS,
  loadPhase0SmokeState,
  setPhase0SmokeItem,
  resetPhase0SmokeState,
  summarizePhase0Smoke,
  probePhase0LiveStack,
  PHASE0_SMOKE_STORAGE_KEY,
} from './phase0SmokeChecklist';

describe('phase0SmokeChecklist', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem(PHASE0_SMOKE_STORAGE_KEY);
    } catch (_) {}
  });

  test('has all Phase 0 ROADMAP smoke items', () => {
    const ids = PHASE0_SMOKE_ITEMS.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'split_both_translated',
        'revenant_reattach',
        'phone_digits_survive',
        'weak_beats_empty',
        'no_connect_thrash',
        'enes_tiebreak',
        'stt_harness_visible',
        'translate_harness_coded',
      ]),
    );
  });

  test('mark pass persists and summarizes', () => {
    setPhase0SmokeItem('phone_digits_survive', 'pass');
    const state = loadPhase0SmokeState();
    expect(state.items.phone_digits_survive.status).toBe('pass');
    const sum = summarizePhase0Smoke(state);
    expect(sum.pass).toBe(1);
    expect(sum.phase0Green).toBe(false);
  });

  test('phase0Green only when all blocking items pass', () => {
    resetPhase0SmokeState();
    for (const item of PHASE0_SMOKE_ITEMS) {
      setPhase0SmokeItem(item.id, 'pass');
    }
    expect(summarizePhase0Smoke().phase0Green).toBe(true);
  });

  test('probe detects sealed translations and fake phone', () => {
    const probe = probePhase0LiveStack({
      isActive: true,
      captions: [
        {
          isFinal: true,
          isSplit: true,
          text: 'Call 5551234567 for John Example.',
          translations: { 'x::y': { text: 'Llame…', quality: 'ok' } },
        },
        { isFinal: true, text: 'Second part.', translations: {} },
      ],
    });
    expect(probe.finalCount).toBe(2);
    expect(probe.sealedTranslationCount).toBe(1);
    expect(probe.hasFakePhoneDigits).toBe(true);
    expect(probe.splitBubbleCount).toBe(1);
  });

  test('reset clears marks', () => {
    setPhase0SmokeItem('enes_tiebreak', 'fail');
    resetPhase0SmokeState();
    expect(loadPhase0SmokeState().items.enes_tiebreak.status).toBe('unchecked');
  });
});
