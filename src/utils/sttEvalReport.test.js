/**
 * STT eval report + gate (v4.154.0).
 *
 * Runs the whole corpus through the REAL pipeline and prints the table
 * (`npm run eval:stt`). Gated cases assert OUR behaviour: that a correct
 * provider transcript reaches the user untouched — digits, negations, terms.
 *
 * This is the file that makes "we improved transcription" a measurable claim.
 */
import { EVAL_CASES, GATED_EVAL_CASES } from '../fixtures/eval';
import {
  runEvalCorpus,
  checkEvalGates,
  checkRepairSafety,
  checkNegationGuard,
  displayTextOf,
  providerTextOf,
  repairedDisplayTextOf,
  scoreCorpusCase,
} from './sttEvalRun';
import { renderEvalReport, KIND_MIX_WEIGHT } from './sttEval';

test('STT eval report (medical + legal)', () => {
  const { scored, summary } = runEvalCorpus();
  const guard = checkNegationGuard(scored);
  const failures = [
    ...checkEvalGates(EVAL_CASES, scored),
    ...checkRepairSafety(scored),
    ...guard.failures,
  ];
  // eslint-disable-next-line no-console
  console.log(
    `\n${renderEvalReport(summary, { title: 'STT eval — v4.156.0 corpus' })}\n` +
      `**Negation guard**: recall ${(guard.recall * 100).toFixed(0)}% ` +
      `(${guard.caught}/${guard.expected}), precision ${(guard.precision * 100).toFixed(0)}% ` +
      `(${guard.quiet}/${guard.shouldBeQuiet} clean lines stayed quiet)` +
      (guard.offenders.length ? `\n- ${guard.offenders.join('\n- ')}` : '') +
      '\n',
  );
  expect(failures).toEqual([]);
});

test('v4.156.0 — the negation guard catches every dropped negation in the corpus', () => {
  const { scored } = runEvalCorpus();
  const { recall, expected, caught } = checkNegationGuard(scored);
  expect(expected).toBeGreaterThan(0);
  expect({ recall, caught, expected }).toMatchObject({ recall: 1, caught: expected });
});

test('v4.156.0 — the guard does not cry wolf on clean lines', () => {
  const { scored } = runEvalCorpus();
  const { precision, falsePositives, shouldBeQuiet } = checkNegationGuard(scored);
  expect(shouldBeQuiet).toBeGreaterThan(5);
  expect(precision).toBeGreaterThanOrEqual(0.8);
  // A brand-new alarm must be quieter than this to survive contact with a call.
  expect(falsePositives).toBe(0);
});

test('v4.156.0 — a guard that cannot fail is decoration', () => {
  const { scored } = runEvalCorpus();
  // Pretend the guard is deaf: a corpus where a dropped negation goes unnoticed.
  const deaf = scored.map((c) => ({ ...c, display: 'the nurse checked the blood pressure' }));
  expect(checkNegationGuard(deaf).failures.join(' ')).toMatch(/missed \d+\/\d+/);
});

test('v4.155.0 — the domain lexicon never makes the text worse, never moves a digit', () => {
  const { scored } = runEvalCorpus();
  expect(checkRepairSafety(scored)).toEqual([]);
});

test('v4.155.0 — the lexicon actually earns its keep on the cases it is for', () => {
  const { scored } = runEvalCorpus();
  const fixed = scored.filter((c) => c.scoredRepair && c.repairGain > 0);
  expect(fixed.length).toBeGreaterThanOrEqual(2);
  expect(fixed.map((c) => c.id).sort()).toEqual(
    expect.arrayContaining(['pipeline-repair-drug-name', 'pipeline-repair-legal-exhibit']),
  );
  // and the drug name is really there afterwards
  const drug = scored.find((c) => c.id === 'pipeline-repair-drug-name');
  expect(drug.display).toContain('all but a roll');
  expect(drug.repairedDisplay).toContain('albuterol');
  expect(drug.repairGain).toBeGreaterThanOrEqual(3);
});

test('v4.155.0 — repair leaves correct text completely alone (no gratuitous edits)', () => {
  const { scored } = runEvalCorpus();
  scored
    .filter((c) => c.scoredRepair)
    .forEach((c) => {
      if (c.repairGain === 0) expect(c.repairedDisplay).toBe(c.display);
    });
});

test('v4.155.0 — the real-world mix weights legal as the rare slice it is', () => {
  expect(KIND_MIX_WEIGHT.legal).toBeLessThan(KIND_MIX_WEIGHT.medical);
  const { summary } = runEvalCorpus();
  expect(summary.mix).toBeTruthy();

  // Legal cases are deliberately numerous in the corpus (they must stay
  // measured) but they must NOT dominate the headline number.
  const weightOf = (kind) =>
    EVAL_CASES.filter((c) => c.kind === kind).reduce(
      (a, c) => a + (c.weight ?? KIND_MIX_WEIGHT[c.kind] ?? 1),
      0,
    );
  const legalShare = weightOf('legal') / summary.mix.weight;
  expect(legalShare).toBeLessThan(0.15); // it is ~3% of a real day
  expect(renderEvalReport(summary)).toContain('Real-world mix');
});

test('a repair safety gate that cannot fail is decoration', () => {
  // Pretend the lexicon invented a word and lost a digit at the same time.
  const { scored } = runEvalCorpus();
  const broken = scored.map((c) =>
    c.scoredRepair ? { ...c, repairGain: -2, repairChangedDigits: true } : c,
  );
  const failures = checkRepairSafety(broken);
  expect(failures.length).toBeGreaterThan(0);
  expect(failures.join(' ')).toMatch(/WORSE/);
  expect(failures.join(' ')).toMatch(/digit/);
});

test('every corpus case scores (no silent case that measures nothing)', () => {
  const { scored } = runEvalCorpus();
  expect(scored).toHaveLength(EVAL_CASES.length);
  scored.forEach((c) => {
    expect(c.raw.refWords).toBeGreaterThan(0);
    expect(c.hypothesis.length).toBeGreaterThan(0);
  });
});

test('our pipeline never damages a correct provider transcript', () => {
  const { scored } = runEvalCorpus();
  const gated = scored.filter((c) => GATED_EVAL_CASES.some((f) => f.id === c.id));
  expect(gated.length).toBe(GATED_EVAL_CASES.length);
  gated.forEach((c) => {
    expect({
      id: c.id,
      damage: c.damage,
      provider: c.hypothesis,
      display: c.display,
    }).toMatchObject({ damage: c.damage });
    expect(c.damage).toBeLessThanOrEqual(0);
  });
});

test('medical + legal both have gated coverage', () => {
  const kinds = new Set(GATED_EVAL_CASES.map((c) => c.kind));
  expect(kinds.has('medical')).toBe(true);
  expect(kinds.has('legal')).toBe(true);
});

test('gates actually fail when a case regresses (a gate that cannot fail is decoration)', () => {
  // Same corpus, but pretend the pipeline rewrote the text.
  const damaged = EVAL_CASES.map((c) => {
    if (!c.events) return c;
    const good = scoreCorpusCase(c);
    return { ...good, display: `${good.display} please hold on`, damage: 3 };
  });
  const failures = checkEvalGates(EVAL_CASES, damaged);
  expect(failures.length).toBeGreaterThan(0);
  expect(failures.join(' ')).toMatch(/damage/);
});

test('replay is what the user reads: final rows only', () => {
  const fixture = EVAL_CASES.find((c) => c.id === 'pipeline-medical-vitals');
  const display = displayTextOf(fixture);
  expect(display).toContain('128');
  expect(display).toContain('82');
  expect(display).toContain('94');
  expect(providerTextOf(fixture)).toContain('oxygen saturation');
});
