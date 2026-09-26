/**
 * Audio eval report (v4.161.0) — the scoreboard for the MICROPHONE.
 *
 * Everything else in this repo measures text: the provider text comes from
 * fixtures. This is the only thing that measures a real voice. The cost of that
 * honesty is that it needs audio you recorded, so it skips cleanly (and loudly)
 * until provider-text.json exists.
 *
 * The gates are the same discipline as the text corpus, aimed at the failures
 * that would actually hurt: digits must survive, and keyterm bias must never
 * invent a word you did not say.
 */
import fs from 'fs';
import path from 'path';
import manifest from '../fixtures/audio/manifest.json';
import {
  scoreEvalCase,
  summarizeEval,
  renderEvalReport,
  KIND_MIX_WEIGHT,
} from './sttEval';
import { checkNegationGuard } from './sttEvalRun';

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'audio');
const RESULTS = path.join(FIXTURE_DIR, 'provider-text.json');

const hasResults = fs.existsSync(RESULTS);
const results = hasResults ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')) : { runs: {} };
const configNames = Object.keys(results.runs || {});

const scoreConfig = (configName) => {
  const runs = results.runs[configName];
  return manifest
    .filter((clip) => runs[clip.id] && runs[clip.id].transcript)
    .map((clip) =>
      scoreEvalCase({
        id: clip.id,
        kind: clip.kind,
        lang: clip.lang,
        weight: clip.weight ?? KIND_MIX_WEIGHT[clip.kind] ?? 1,
        reference: clip.reference,
        hypothesis: runs[clip.id].transcript,
        terms: clip.terms,
        criticalPhrases: clip.criticalPhrases,
      }),
    );
};

describe('audio eval — real WER (v4.161.0)', () => {
  test('the manifest is sane (checked even before any audio exists)', () => {
    expect(Array.isArray(manifest)).toBe(true);
    expect(manifest.length).toBeGreaterThanOrEqual(20);
    const ids = manifest.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate clips
    const medical = manifest.filter((c) => c.kind === 'medical').length;
    const legal = manifest.filter((c) => c.kind === 'legal').length;
    // the day is ~95% medical; the corpus must not drift away from that
    expect(medical / manifest.length).toBeGreaterThan(0.7);
    expect(legal).toBeGreaterThan(0);
    // both languages, or the Spanish lane is never measured
    expect(new Set(manifest.map((c) => c.lang)).size).toBe(2);
    // every clip says what to read and names its file
    manifest.forEach((c) => {
      expect(c.reference).toBeTruthy();
      expect(c.file).toMatch(/\.wav$/);
    });
  });

  test('no audio yet -> a clear skip, never a silent pass', () => {
    if (hasResults) {
      // eslint-disable-next-line no-console
      console.log(`audio eval: ${configNames.length} config(s) scored from provider-text.json`);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(
      '\n[audio eval] SKIPPED — no audio recorded yet.\n' +
        '  Record the 24 scripts in src/fixtures/audio/manifest.json, then:\n' +
        '    node scripts\\eval-audio.js    (transcribes via Deepgram)\n' +
        '    npm run eval:audio            (scores it — this file)\n' +
        '  See docs/development/audio-eval.md\n',
    );
    expect(manifest.length).toBeGreaterThan(0);
  });
});

// Scored only when there is something to score. A missing corpus is not a
// failure; a WORSE corpus is.
if (hasResults && configNames.length) {
  describe(`audio eval — scores (${configNames.join(', ')})`, () => {
    configNames.forEach((configName) => {
      const scored = scoreConfig(configName);
      const summary = summarizeEval(scored);

      test(`${configName}: prints the real-WER table`, () => {
        // eslint-disable-next-line no-console
        console.log(
          `\n${renderEvalReport(summary, { title: `Audio eval — ${configName} (real microphone)` })}`,
        );
        expect(scored.length).toBeGreaterThan(0);
      });

      test(`${configName}: every clip must produce a transcript`, () => {
        const empty = Object.entries(results.runs[configName])
          .filter(([, r]) => !r.transcript || !r.transcript.trim())
          .map(([id]) => id);
        expect(empty).toEqual([]);
      });

      test(`${configName}: digits must survive — a drifting dose fails the build`, () => {
        scored
          .filter((c) => c.digits.total > 0)
          .forEach((c) => {
            expect({ id: c.id, recall: c.digits.recall, missed: c.digits.missed }).toMatchObject({
              recall: 1,
              missed: [],
            });
          });
      });

      test(`${configName}: no invented terms`, () => {
        // A term present when the reference has none is force-fitting. For the
        // keyterm config this is the whole question, so it is a hard gate.
        const invented = [...new Set(scored.flatMap((c) => c.term.invented || []))];
        expect({ configName, invented }).toMatchObject({ invented: [] });
      });

      test(`${configName}: the negation guard is measured on real audio`, () => {
        const { recall, expected } = checkNegationGuard(scored);
        // eslint-disable-next-line no-console
        console.log(`  negation guard: recall ${(recall * 100).toFixed(0)}% of ${expected} line(s)`);
        expect(recall).toBeGreaterThanOrEqual(0.5);
      });
    });
  });
}
