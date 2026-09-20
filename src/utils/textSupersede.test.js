import {
  REDUCED_SUPERSEDE_HOLD_MS,
  REDUCED_SUPERSEDE_RETIRE_MS,
  SUPERSEDE_CONF_EPSILON,
  SUPERSEDE_HOLD_MS,
  SUPERSEDE_MAX_EPISODE_MS,
  SUPERSEDE_MODE,
  SUPERSEDE_RETIRE_MS,
  classifySupersede,
  isEpisodeOverBudget,
  minConfidenceForTokens,
  presentOpParts,
  resolveSupersedeTiming,
} from './textSupersede';

const scores = (pairs) => pairs.map(([word, confidence]) => ({ word, confidence }));

describe('textSupersede', () => {
  test('documented defaults are stable', () => {
    expect(SUPERSEDE_HOLD_MS).toBe(1500);
    expect(SUPERSEDE_RETIRE_MS).toBe(320);
    expect(REDUCED_SUPERSEDE_HOLD_MS).toBe(120);
    expect(REDUCED_SUPERSEDE_RETIRE_MS).toBe(0);
    expect(SUPERSEDE_MAX_EPISODE_MS).toBe(4000);
    expect(SUPERSEDE_CONF_EPSILON).toBe(0.02);
  });

  test('higher-confidence rewrite of the same speech supersedes', () => {
    const d = classifySupersede({
      prevText: 'she takes losartan',
      nextText: 'she takes lovastatin',
      prevScores: scores([['she', 0.9], ['takes', 0.9], ['losartan', 0.35]]),
      nextScores: scores([['she', 0.95], ['takes', 0.95], ['lovastatin', 0.97]]),
    });
    expect(d.superseded).toBe(true);
    expect(d.mode).toBe(SUPERSEDE_MODE.SUPERSEDE);
    expect(d.reason).toBe('higher_confidence_rewrite');
    expect(d.lostTokens).toContain('losartan');
    expect(d.gainedTokens).toContain('lovastatin');
    expect(d.confidence).toEqual({ prev: 0.35, next: 0.97 });
  });

  test('pure continuation / extension does not supersede', () => {
    const d = classifySupersede({ prevText: 'the pain started', nextText: 'the pain started yesterday' });
    expect(d.superseded).toBe(false);
    expect(d.mode).toBe(SUPERSEDE_MODE.CONTINUATION);
    expect(d.reason).toBe('append_only');
    expect(d.lostTokens).toEqual([]);
  });

  test('unchanged text is a no-op', () => {
    const d = classifySupersede({ prevText: 'same words', nextText: 'same words' });
    expect(d.mode).toBe(SUPERSEDE_MODE.NONE);
    expect(d.superseded).toBe(false);
  });

  test('equal confidence does not supersede', () => {
    const d = classifySupersede({
      prevText: 'the patient denies smoking',
      nextText: 'the patient denies chills',
      prevScores: scores([['smoking', 0.9]]),
      nextScores: scores([['chills', 0.9]]),
    });
    expect(d.superseded).toBe(false);
    expect(d.mode).toBe(SUPERSEDE_MODE.QUIET);
    expect(d.reason).toBe('equal_or_lower_confidence');
  });

  test('lower confidence does not supersede', () => {
    const d = classifySupersede({
      prevText: 'the patient denies smoking',
      nextText: 'the patient denies chills',
      prevScores: scores([['smoking', 0.92]]),
      nextScores: scores([['chills', 0.55]]),
    });
    expect(d.superseded).toBe(false);
    expect(d.mode).toBe(SUPERSEDE_MODE.QUIET);
  });

  test('a gain inside the noise floor does not supersede', () => {
    const d = classifySupersede({
      prevText: 'take one tablet',
      nextText: 'take two tablets',
      prevScores: scores([['one', 0.8]]),
      nextScores: scores([['two', 0.8 + SUPERSEDE_CONF_EPSILON]]),
    });
    expect(d.superseded).toBe(false);
  });

  test('unknown confidence falls back to the structural supersede default', () => {
    const d = classifySupersede({ prevText: 'he has a fever', nextText: 'he has a headache' });
    expect(d.superseded).toBe(true);
    expect(d.reason).toBe('unknown_confidence_rewrite');
    expect(d.confidence).toEqual({ prev: null, next: null });
  });

  test('one-sided confidence is treated as unknown (no invented scores)', () => {
    const d = classifySupersede({
      prevText: 'he has a fever',
      nextText: 'he has a headache',
      nextScores: scores([['headache', 0.99]]),
    });
    expect(d.superseded).toBe(true);
    expect(d.confidence.prev).toBeNull();
    expect(d.confidence.next).toBe(0.99);
  });

  test('retraction (words dropped, nothing replacing) still supersedes', () => {
    const d = classifySupersede({ prevText: 'he has chest pain', nextText: 'he has chest' });
    expect(d.superseded).toBe(true);
    expect(d.reason).toBe('retraction');
    expect(d.lostTokens).toContain('pain');
    expect(d.gainedTokens).toEqual([]);
  });

  test('protected tokens (phone/dose) are reported, never silently dropped', () => {
    const d = classifySupersede({ prevText: 'call 555-123-4567', nextText: 'call 555-123-4568' });
    expect(d.superseded).toBe(true);
    expect(d.lostTokens.join(' ')).toContain('555-123-4567');
    expect(d.gainedTokens.join(' ')).toContain('555-123-4568');
  });

  test('minConfidenceForTokens takes the weakest finite score and never guesses', () => {
    expect(minConfidenceForTokens(['a', 'b'], scores([['a', 0.9], ['b', 0.4]]))).toBe(0.4);
    expect(minConfidenceForTokens(['zzz'], scores([['a', 0.9]]))).toBeNull();
    expect(minConfidenceForTokens(['a'], [])).toBeNull();
    expect(minConfidenceForTokens([], scores([['a', 0.9]]))).toBeNull();
  });

  test('presentOpParts: supersede keeps the old wording and frames the new one', () => {
    const replace = { type: 'replace', from: 'fever', to: 'headache' };
    const insert = { type: 'insert', text: 'cough' };
    const drop = { type: 'delete', text: 'pain' };
    const equal = { type: 'equal', text: 'he has' };

    expect(presentOpParts(equal, SUPERSEDE_MODE.SUPERSEDE)).toEqual([{ role: 'equal', text: 'he has' }]);
    expect(presentOpParts(insert, SUPERSEDE_MODE.SUPERSEDE)).toEqual([{ role: 'arriving', text: 'cough' }]);
    expect(presentOpParts(drop, SUPERSEDE_MODE.SUPERSEDE)).toEqual([{ role: 'superseded', text: 'pain' }]);
    // Both wordings on screen, in reading order.
    expect(presentOpParts(replace, SUPERSEDE_MODE.SUPERSEDE)).toEqual([
      { role: 'superseded', text: 'fever' },
      { role: 'arrow', text: ' ⇢ ' },
      { role: 'arriving', text: 'headache' },
    ]);
  });

  test('presentOpParts: quiet adopt never lingers on the old wording', () => {
    const replace = { type: 'replace', from: 'smoking', to: 'chills' };
    const drop = { type: 'delete', text: 'fever' };
    const insert = { type: 'insert', text: 'cough' };
    expect(presentOpParts(replace, SUPERSEDE_MODE.QUIET)).toEqual([{ role: 'adopted', text: 'chills' }]);
    expect(presentOpParts(drop, SUPERSEDE_MODE.QUIET)).toEqual([]);
    expect(presentOpParts(insert, SUPERSEDE_MODE.QUIET)).toEqual([{ role: 'adopted', text: 'cough' }]);
  });

  test('presentOpParts: continuation only ever arrives, never dims', () => {
    expect(presentOpParts({ type: 'insert', text: 'yesterday' }, SUPERSEDE_MODE.CONTINUATION))
      .toEqual([{ role: 'arriving', text: 'yesterday' }]);
    expect(presentOpParts({ type: 'equal', text: 'the pain' }, SUPERSEDE_MODE.CONTINUATION))
      .toEqual([{ role: 'equal', text: 'the pain' }]);
  });

  test('resolveSupersedeTiming honours the prop override', () => {
    expect(resolveSupersedeTiming(false)).toEqual({
      holdMs: SUPERSEDE_HOLD_MS,
      retireMs: SUPERSEDE_RETIRE_MS,
      animate: true,
    });
    expect(resolveSupersedeTiming(false, { holdMs: 900, retireMs: 100 })).toEqual({
      holdMs: 900,
      retireMs: 100,
      animate: true,
    });
    expect(resolveSupersedeTiming(false, { holdMs: -50 })).toEqual({
      holdMs: 0,
      retireMs: SUPERSEDE_RETIRE_MS,
      animate: true,
    });
  });

  test('reduced motion collapses the ladder', () => {
    const timing = resolveSupersedeTiming(true, { holdMs: 9000, retireMs: 9000 });
    expect(timing).toEqual({
      holdMs: REDUCED_SUPERSEDE_HOLD_MS,
      retireMs: REDUCED_SUPERSEDE_RETIRE_MS,
      animate: false,
    });
  });

  test('episode budget bound is enforced', () => {
    expect(isEpisodeOverBudget(1000, 2000, 4000)).toBe(false);
    expect(isEpisodeOverBudget(1000, 5100, 4000)).toBe(true);
    expect(isEpisodeOverBudget(1000, 5000, 4000)).toBe(false);
    expect(isEpisodeOverBudget(null, 5000)).toBe(false);
  });
});
