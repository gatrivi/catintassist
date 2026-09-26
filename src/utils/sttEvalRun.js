/**
 * Runs the STT eval corpus (v4.154.0).
 *
 * `hypothesis` = the provider's own text (last final event).
 * `display`    = the text the user actually reads, produced by replaying the
 *                same events through the live pipeline.
 * `damage`     = display errors − provider errors = what WE cost the user.
 */
import { replayFixtureEvents } from './fixtureReplay';
import { scoreEvalCase, summarizeEval } from './sttEval';
import { EVAL_CASES } from '../fixtures/eval';

/** Last final/speech_final event = what Deepgram actually committed. */
export const providerTextOf = (fixture) => {
  const events = fixture?.events || [];
  for (let i = events.length - 1; i >= 0; i--) {
    const p = events[i]?.payload;
    if (!p) continue;
    if (p.is_final || p.speech_final) {
      const text = p?.channel?.alternatives?.[0]?.transcript;
      if (text) return text;
    }
  }
  return '';
};

/** Text the user reads: every final bubble, in order. */
export const displayTextOf = (fixture) => {
  const { rows } = replayFixtureEvents(fixture);
  return (rows || [])
    .filter((r) => r?.isFinal && r?.text)
    .map((r) => r.text)
    .join(' ');
};

/** Score one corpus case (replaying the engine when the case has events). */
export const scoreCorpusCase = (fixture) => {
  const hasEvents = Array.isArray(fixture?.events) && fixture.events.length > 0;
  const hypothesis = hasEvents ? providerTextOf(fixture) : fixture.hypothesis || '';
  const display = hasEvents ? displayTextOf(fixture) : null;
  return scoreEvalCase({
    id: fixture.id,
    kind: fixture.kind,
    lang: fixture.lang,
    reference: fixture.reference,
    hypothesis,
    display,
    terms: fixture.terms,
    criticalPhrases: fixture.criticalPhrases,
  });
};

export const runEvalCorpus = (cases = EVAL_CASES) => {
  const scored = cases.map(scoreCorpusCase);
  return { scored, summary: summarizeEval(scored) };
};

/**
 * Gate check. Only cases with `expect` are gated, and unknown thresholds are
 * ignored (so a case can assert one thing only).
 * @returns {string[]} failures, empty = healthy
 */
export const checkEvalGates = (fixtures, scored) => {
  const failures = [];
  (fixtures || []).forEach((fixture) => {
    const e = fixture?.expect;
    if (!e) return;
    const c = scored.find((s) => s.id === fixture.id);
    if (!c) {
      failures.push(`${fixture.id}: not scored`);
      return;
    }
    if (e.maxDamage != null && c.damage > e.maxDamage) {
      failures.push(
        `${fixture.id}: pipeline damage ${c.damage > 0 ? '+' : ''}${c.damage} > ${e.maxDamage} (we changed correct provider text)`,
      );
    }
    if (e.maxWerDisplay != null && c.displayRate && c.displayRate.wer > e.maxWerDisplay) {
      failures.push(`${fixture.id}: WER(display) ${(c.displayRate.wer * 100).toFixed(1)}% > ${(e.maxWerDisplay * 100).toFixed(1)}%`);
    }
    if (e.minTermAccuracy != null && c.term.accuracy < e.minTermAccuracy) {
      failures.push(
        `${fixture.id}: term accuracy ${(c.term.accuracy * 100).toFixed(0)}% < ${(e.minTermAccuracy * 100).toFixed(0)}% (missed: ${c.term.missed.join(', ') || '—'})`,
      );
    }
    if (e.minDigitRecall != null && c.digits.recall < e.minDigitRecall) {
      failures.push(
        `${fixture.id}: digit recall ${(c.digits.recall * 100).toFixed(0)}% < ${(e.minDigitRecall * 100).toFixed(0)}% (lost: ${c.digits.missed.join(', ') || '—'})`,
      );
    }
    if (e.minCriticalRecall != null && c.critical.recall < e.minCriticalRecall) {
      failures.push(
        `${fixture.id}: critical phrase recall ${(c.critical.recall * 100).toFixed(0)}% < ${(e.minCriticalRecall * 100).toFixed(0)}% (dropped: ${c.critical.dropped.join(', ') || '—'})`,
      );
    }
  });
  return failures;
};
