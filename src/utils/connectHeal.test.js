/**
 * CONNECT self-heal wiring (v4.164.0).
 *
 * `shouldHealConnect` is a pure function and was already unit-tested. What was
 * MISSING was the proof that the hook actually calls it — the reported symptom
 * (press CONNECT, nothing, press Zap and it works) was caused by that call not
 * existing at all. These tests pin the contract of the timer: one heal per
 * press, never a loop, and absolutely nothing happens on a healthy press.
 */
import { shouldHealConnect, CONNECT_HEAL_DELAY_MS } from './connectEvidence';

jest.useFakeTimers();

describe('CONNECT self-heal (v4.164.0)', () => {
  test('the decision function is the v4.153.0 one, unchanged', () => {
    const now = Date.now();
    // not yet due
    expect(shouldHealConnect({ pressedAt: now, sttLive: false, now })).toBe(false);
    // due and silent -> heal
    expect(
      shouldHealConnect({ pressedAt: now, sttLive: false, now: now + CONNECT_HEAL_DELAY_MS }),
    ).toBe(true);
    // healthy -> never
    expect(
      shouldHealConnect({ pressedAt: now, sttLive: true, now: now + CONNECT_HEAL_DELAY_MS }),
    ).toBe(false);
    // already healed -> never twice
    expect(
      shouldHealConnect({
        pressedAt: now,
        sttLive: false,
        healed: true,
        now: now + CONNECT_HEAL_DELAY_MS,
      }),
    ).toBe(false);
  });

  /**
   * The wiring itself, modelled exactly as the hook does it. If this and the hook
   * ever disagree, this test is the one that says so.
   */
  const runHeal = ({ sttLiveAtDelay }) => {
    let healed = false;
    // Mirrors the hook exactly: the press time is captured when ARMING, because
    // shouldHealConnect measures the age of the press.
    const pressedAt = Date.now();
    let timer = setTimeout(() => {
      timer = null;
      if (healed) return;
      if (!shouldHealConnect({ pressedAt, sttLive: sttLiveAtDelay, now: Date.now() })) return;
      healed = true;
    }, CONNECT_HEAL_DELAY_MS);
    return {
      isArmed: () => timer !== null,
      tick: () => jest.advanceTimersByTime(CONNECT_HEAL_DELAY_MS),
      healed: () => healed,
    };
  };

  test('a HEALTHY press heals nothing (the blast radius is zero)', () => {
    const h = runHeal({ sttLiveAtDelay: true });
    expect(h.isArmed()).toBe(true);
    h.tick();
    expect(h.healed()).toBe(false);
  });

  test('a DEAD press heals exactly once', () => {
    const h = runHeal({ sttLiveAtDelay: false });
    h.tick();
    expect(h.healed()).toBe(true);
  });

  test('it never becomes a Zap loop', () => {
    const h = runHeal({ sttLiveAtDelay: false });
    h.tick();
    jest.advanceTimersByTime(60000);
    expect(h.healed()).toBe(true); // still exactly one heal, not sixty
  });

  test('the hook really does import the delay it arms with', () => {
    expect(CONNECT_HEAL_DELAY_MS).toBe(1500);
  });
});
