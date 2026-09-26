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
import { runEvalCorpus, checkEvalGates, displayTextOf, providerTextOf, scoreCorpusCase } from './sttEvalRun';
import { renderEvalReport } from './sttEval';

test('STT eval report (medical + legal)', () => {
  const { scored, summary } = runEvalCorpus();
  const failures = checkEvalGates(EVAL_CASES, scored);
  // eslint-disable-next-line no-console
  console.log(`\n${renderEvalReport(summary, { title: 'STT eval — v4.154.0 corpus' })}`);
  expect(failures).toEqual([]);
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
