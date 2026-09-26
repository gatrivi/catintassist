/**
 * Translation completeness (v4.161.0).
 *
 * The motivation is a real CSA call where the translation ended
 * "…Él ya tiene esos recursos allí" and simply dropped "waiting for him" — a
 * fluent, confident, INCOMPLETE translation. That is more dangerous than a blank
 * one, because the interpreter trusts it.
 *
 * So the shape of this file mirrors negationGuard.test.js: many more
 * must-NOT-fire cases than must-fire. A check that cries wolf gets muted, and a
 * muted check cannot catch the real thing.
 */
import { isTruncatedTranslation, isTranslationStuckForRetranslate } from './translationQuality';

/** The real CSA sentence and what came back. */
const CSA_SOURCE =
  'And I could also send some referrals for behavioral health so that after all of this is done, he already has those resources there waiting for him.';
const CSA_OUTPUT =
  'Y también podría enviar algunas referencias para la salud conductual de modo que después de todo de esto se hace, Él ya tiene esos recursos allí';

/** The same source, translated COMPLETELY — the check must not punish a good one. */
const COMPLETE_CSA =
  'Y también podría enviar algunas referencias para salud conductual para que, una vez terminado todo esto, él ya tenga esos recursos esperándolo allí.';

describe('isTruncatedTranslation v4.161.0', () => {
  test('catches the real CSA case: the tail clause is gone', () => {
    expect(isTruncatedTranslation(CSA_SOURCE, CSA_OUTPUT)).toBe(true);
  });

  test('catches a gross length loss even with no dangling tail', () => {
    const source =
      'The patient reports pain in the left knee that started three weeks ago and worsens with stairs.';
    const output = 'Dolor en la rodilla.';
    expect(isTruncatedTranslation(source, output)).toBe(true);
  });

  // ── must NOT fire ────────────────────────────────────────────────────────
  const MUST_PASS = [
    // the same source, translated COMPLETELY — the fix must not punish a good one
    [CSA_SOURCE, COMPLETE_CSA],
    // a normal sentence that happens to end in a preposition
    ['We talked about the results for', 'Hablamos de los resultados para'],
    // every line of the real call that was fine
    [
      "That's fine, but I won't be able to do, like, a full exam like they can do in the ER when we're concerned for this type of behaviors that have happened.",
      'Está bien, pero no voy a ser capaz de hacer un examen completo como pueden hacer en Urgencias cuando estamos preocupados por este tipo de comportamientos.',
    ],
    [
      'I can take a look at him',
      'Puedo echarle un vistazo',
    ],
    // short lines are never judged
    ['Yes.', 'Sí.'],
    ['Thank you.', 'Gracias.'],
  ];

  test('never fires on a complete or ordinary translation', () => {
    MUST_PASS.forEach(([source, translation]) => {
      expect({ source: source.slice(0, 32), truncated: isTruncatedTranslation(source, translation) })
        .toMatchObject({ truncated: false });
    });
  });
  test('Spanish longer than English is normal, not truncation', () => {
    const source = 'Give one tablet twice daily with food and return in seven days please';
    const output = 'Tome una tableta dos veces al día con la comida y regrese en siete días por favor.';
    expect(isTruncatedTranslation(source, output)).toBe(false);
  });

  test('empty or missing input is never truncation (other guards own that)', () => {
    expect(isTruncatedTranslation('', CSA_OUTPUT)).toBe(false);
    expect(isTruncatedTranslation(CSA_SOURCE, '')).toBe(false);
    expect(isTruncatedTranslation(null, null)).toBe(false);
  });
});

describe('truncation now offers the retranslate button', () => {
  test('a truncated translation is reported as stuck (so ↻ appears)', () => {
    expect(isTranslationStuckForRetranslate(CSA_SOURCE, CSA_OUTPUT, 'en', 'es')).toBe(true);
  });

  test('a complete translation is not stuck', () => {
    expect(isTranslationStuckForRetranslate(CSA_SOURCE, COMPLETE_CSA, 'en', 'es')).toBe(false);
  });

  test('a settled weak accept is still respected (v4.55.0 rule intact)', () => {
    expect(
      isTranslationStuckForRetranslate(CSA_SOURCE, CSA_OUTPUT, 'en', 'es', { quality: 'weak' }),
    ).toBe(false);
  });
});
