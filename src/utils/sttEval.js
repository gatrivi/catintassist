/**
 * STT eval metrics (v4.154.0) — pure, no React, no network, no audio.
 *
 * Why this exists: interpreting is medical and legal. A wrong drug name, a wrong
 * dose or a dropped "denies" changes what the doctor ordered. The repo had NO
 * numeric quality metric at all, so every improvement was a guess.
 *
 * Two ideas matter more than the math:
 *  1. Score TWICE — the raw provider hypothesis and the text the user actually
 *     reads. The difference is `damage`: words OUR pipeline destroyed. Deepgram
 *     right + app wrong was the most expensive bug class in this project.
 *  2. Critical phrases (negations) outrank WER. "denies chest pain" -> "chest
 *     pain" is a wrong WER and a wrong patient.
 *
 * The normalization policy is documented in docs/stt-eval-plan.md and is part
 * of the metric: change it only with the doc.
 */
import { convertEnglishNumberWords } from './sensitiveDataProtector';

/** Filler words are not transcription errors; both sides drop them. */
const FILLERS = [
  'um', 'uh', 'erm', 'hmm', 'mm', 'ah', 'eh', 'like', 'you know', 'i mean',
  'basically', 'actually', 'so', 'pues', 'bueno', 'o sea', 'mmm', 'ehh',
];

/** Word-level edit distance with a backtrace (for confusion mining). */
export const alignWords = (ref = [], hyp = []) => {
  const n = ref.length;
  const m = hyp.length;
  // d[i][j] = cost of aligning ref[0..i) with hyp[0..j)
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1)) {
      ops.push({ op: ref[i - 1] === hyp[j - 1] ? 'ok' : 'sub', ref: ref[i - 1], hyp: hyp[j - 1] });
      i -= 1;
      j -= 1;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ op: 'del', ref: ref[i - 1], hyp: null });
      i -= 1;
    } else {
      ops.push({ op: 'ins', ref: null, hyp: hyp[j - 1] });
      j -= 1;
    }
  }
  ops.reverse();
  return { distance: d[n][m], ops };
};

/**
 * Join digit groups: "555-123-4567" -> "5551234567".
 * Written as a char walk on purpose: a regex with a consuming group skips
 * separators after the consumed digit (it produced "555123 4567").
 */
export const joinDigitSeparators = (text) => {
  const isSep = (c) => !!c && /[\s.,:]/.test(c) || c === '-';
  const isDigit = (c) => !!c && /\d/.test(c);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (isSep(ch)) {
      let j = i + 1;
      while (j < text.length && isSep(text[j])) j++;
      if (isDigit(out[out.length - 1]) && isDigit(text[j])) {
        i = j - 1; // separator sits between digits -> drop it and keep going
        continue;
      }
    }
    out += ch;
  }
  return out;
};

const stripGrouping = joinDigitSeparators;

/**
 * Normalization policy (frozen — see docs/stt-eval-plan.md).
 * @param {string} text
 * @param {{lang?:string, stripFillers?:boolean, foldNumberWords?:boolean, stripGrouping?:boolean}} [opts]
 */
export const normalizeForScoring = (text, opts = {}) => {
  const {
    lang = 'en',
    stripFillers = true,
    foldNumberWords = true,
    stripGrouping: doStripGrouping = true,
  } = opts;
  let out = String(text || '');
  if (foldNumberWords) out = convertEnglishNumberWords(out, lang);
  if (doStripGrouping) out = stripGrouping(out);
  out = out.toLowerCase();
  if (stripFillers) {
    FILLERS.forEach((f) => {
      out = out.replace(new RegExp(`\\b${f}\\b`, 'g'), ' ');
    });
  }
  return out.replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
};

/** Word tokens for scoring. */
export const tokenizeForScoring = (text, opts = {}) =>
  normalizeForScoring(text, opts).split(' ').filter(Boolean);

/** Digit runs (doses, vitals, IDs, phone) — the numbers that must never drift. */
export const digitRuns = (text) => joinDigitSeparators(String(text || '')).match(/\d+/g) || [];

export const wordErrorRate = ({ reference = '', hypothesis = '', lang = 'en' } = {}) => {
  const ref = tokenizeForScoring(reference, { lang });
  const hyp = tokenizeForScoring(hypothesis, { lang });
  const { distance, ops } = alignWords(ref, hyp);
  return {
    wer: ref.length ? distance / ref.length : distance ? 1 : 0,
    errors: distance,
    refWords: ref.length,
    hypWords: hyp.length,
    ops,
  };
};

/**
 * Did the reference's critical term survive into the hypothesis?
 * Word-boundary aware, so "an" never counts as "Ans" and "mg" not in "mgdl".
 */
export const hasPhrase = (text, phrase) => {
  const hay = normalizeForScoring(text, { foldNumberWords: false });
  const needle = normalizeForScoring(phrase, { foldNumberWords: false });
  if (!needle) return false;
  return ` ${hay} `.includes(` ${needle} `);
};

/**
 * Critical-term accuracy: of the terms the REFERENCE expects, how many arrived?
 * Terms the hypothesis invents (Deepgram keyterm force-fitting) are reported
 * separately — they are a different, also dangerous, failure.
 * @param {{reference?:string, hypothesis:string, terms?:string[], lang?:string}} args
 */
export const termAccuracy = ({ reference = '', hypothesis = '', terms = [], lang = 'en' } = {}) => {
  const wanted = (terms || []).filter(Boolean);
  if (!wanted.length) return { total: 0, hits: 0, accuracy: 1, missed: [], invented: [] };
  const expected = wanted.filter((t) => hasPhrase(reference, t));
  const present = wanted.filter((t) => hasPhrase(hypothesis, t));
  const missed = expected.filter((t) => !hasPhrase(hypothesis, t));
  const invented = present.filter((t) => !hasPhrase(reference, t));
  const hits = expected.length - missed.length;
  return {
    total: wanted.length,
    expected: expected.length,
    hits,
    // Nothing expected -> nothing to measure (never a false failure).
    accuracy: expected.length ? hits / expected.length : 1,
    missed,
    invented,
  };
};

/** Digit runs from the reference that survived (and ones invented). */
export const digitRunAccuracy = ({ reference = '', hypothesis = '' } = {}) => {
  const want = digitRuns(reference);
  const got = digitRuns(hypothesis);
  const gotSet = new Set(got);
  const wantSet = new Set(want);
  const missed = [...wantSet].filter((d) => !gotSet.has(d));
  const invented = [...gotSet].filter((d) => !wantSet.has(d));
  return {
    total: wantSet.size,
    hits: wantSet.size - missed.length,
    recall: wantSet.size ? (wantSet.size - missed.length) / wantSet.size : 1,
    missed,
    invented,
  };
};

/**
 * Negations and other meaning-flipping phrases. Kept separate from WER because
 * a dropped "no" is a completely different failure from a dropped "the".
 */
export const criticalPhraseRecall = ({ reference = '', hypothesis = '', phrases = [] } = {}) => {
  const want = (phrases || []).filter((p) => hasPhrase(reference, p));
  if (!want.length) return { total: 0, hits: 0, recall: 1, dropped: [] };
  const dropped = want.filter((p) => !hasPhrase(hypothesis, p));
  return {
    total: want.length,
    hits: want.length - dropped.length,
    recall: dropped.length ? (want.length - dropped.length) / want.length : 1,
    dropped,
  };
};

/** Which word got mangled into which, worst first — drives the lexicon. */
export const collectConfusions = (ops = []) => {
  const pairs = [];
  ops.forEach((op) => {
    if (op.op === 'sub') pairs.push({ ref: op.ref, hyp: op.hyp });
  });
  return pairs;
};

/**
 * Score one case. `hypothesis` is the provider text; `display` (optional) is the
 * text the user reads after our pipeline. Omit `display` when there are no events
 * to replay.
 *
 * `repairedDisplay` (optional) is what the user would read WITH domain repair on
 * (v4.155.0). It is scored against the same reference so `repairGain` answers
 * one question: did the lexicon actually help, and did it cost anything?
 */
export const scoreEvalCase = ({
  id,
  kind = 'general',
  lang = 'en',
  weight = 1,
  reference = '',
  hypothesis = '',
  display = null,
  repairedDisplay = null,
  terms = [],
  criticalPhrases = [],
} = {}) => {
  const raw = wordErrorRate({ reference, hypothesis, lang });
  const hasDisplay = typeof display === 'string';
  const shown = hasDisplay ? wordErrorRate({ reference, hypothesis: display, lang }) : null;
  const term = termAccuracy({ reference, hypothesis: hasDisplay ? display : hypothesis, terms, lang });
  const digits = digitRunAccuracy({ reference, hypothesis: hasDisplay ? display : hypothesis });
  const critical = criticalPhraseRecall({
    reference,
    hypothesis: hasDisplay ? display : hypothesis,
    phrases: criticalPhrases,
  });

  // v4.155.0 — repair is measured against what the user reads WITHOUT it.
  const hasRepaired = typeof repairedDisplay === 'string';
  const repaired = hasRepaired ? wordErrorRate({ reference, hypothesis: repairedDisplay, lang }) : null;
  const before = hasDisplay ? shown : raw;
  const repairDigits = hasRepaired ? digitRunAccuracy({ reference, hypothesis: repairedDisplay }) : null;

  return {
    id,
    kind,
    lang,
    weight,
    reference,
    hypothesis,
    display,
    repairedDisplay,
    scoredDisplay: hasDisplay,
    scoredRepair: hasRepaired,
    raw,
    displayRate: shown,
    repairedRate: repaired,
    // Our contribution to the error. Negative = we improved on the provider.
    damage: hasDisplay ? shown.errors - raw.errors : 0,
    // v4.155.0: words the lexicon saved. Negative = the lexicon HURT.
    repairGain: hasRepaired ? before.errors - repaired.errors : 0,
    // A repair that moves a digit is a bug, whatever the WER says.
    repairChangedDigits: hasRepaired
      ? (repairDigits?.missed || []).length !== digits.missed.length ||
        (repairDigits?.invented || []).length !== digits.invented.length
      : false,
    term,
    digits,
    critical,
    confusions: collectConfusions(shown ? shown.ops : raw.ops),
  };
};

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * v4.155.0 — how often each kind of call actually happens, per the interpreter.
 * The corpus is deliberately broader than the day (we still want legal covered),
 * but the headline number must not be dominated by cases that almost never
 * occur: roughly 95% medical, a few percent legal (bills, insurance, police).
 * A case may override with its own `weight`.
 */
export const KIND_MIX_WEIGHT = { medical: 1, general: 1, legal: 0.2 };

/** Weighted mean — the same metrics, but each case counts as often as it happens. */
const weightedMean = (list, get) => {
  const total = list.reduce((a, c) => a + (c.weight ?? 1), 0);
  if (!total) return 0;
  return list.reduce((a, c) => a + get(c) * (c.weight ?? 1), 0) / total;
};

/** Aggregate: overall + per domain slice + the worst confusions. */
export const summarizeEval = (cases = []) => {
  const scored = cases.filter(Boolean);
  const slice = (list) => {
    if (!list.length) return null;
    const displayScored = list.filter((c) => c.scoredDisplay);
    const repairScored = list.filter((c) => c.scoredRepair);
    return {
      cases: list.length,
      werRaw: mean(list.map((c) => c.raw.wer)),
      werDisplay: displayScored.length ? mean(displayScored.map((c) => c.displayRate.wer)) : null,
      damage: displayScored.length ? mean(displayScored.map((c) => c.damage)) : null,
      repairGain: repairScored.length ? mean(repairScored.map((c) => c.repairGain)) : null,
      termAccuracy: mean(list.map((c) => c.term.accuracy)),
      digitRecall: mean(list.map((c) => c.digits.recall)),
      criticalRecall: mean(list.map((c) => c.critical.recall)),
    };
  };
  /** Same numbers, weighted by how often the case happens in a real day. */
  const weightedSlice = (list) => {
    if (!list.length) return null;
    const displayScored = list.filter((c) => c.scoredDisplay);
    const repairScored = list.filter((c) => c.scoredRepair);
    return {
      cases: list.length,
      weight: Number(list.reduce((a, c) => a + (c.weight ?? 1), 0).toFixed(2)),
      werRaw: weightedMean(list, (c) => c.raw.wer),
      werDisplay: displayScored.length ? weightedMean(displayScored, (c) => c.displayRate.wer) : null,
      damage: displayScored.length ? weightedMean(displayScored, (c) => c.damage) : null,
      repairGain: repairScored.length ? weightedMean(repairScored, (c) => c.repairGain) : null,
      termAccuracy: weightedMean(list, (c) => c.term.accuracy),
      digitRecall: weightedMean(list, (c) => c.digits.recall),
      criticalRecall: weightedMean(list, (c) => c.critical.recall),
    };
  };
  const byKind = {};
  [...new Set(scored.map((c) => c.kind))].forEach((k) => {
    byKind[k] = slice(scored.filter((c) => c.kind === k));
  });
  const confusionCounts = {};
  scored.forEach((c) => {
    c.confusions.forEach(({ ref, hyp }) => {
      const k = `${ref} → ${hyp}`;
      confusionCounts[k] = (confusionCounts[k] || 0) + 1;
    });
  });
  return {
    total: scored.length,
    overall: slice(scored),
    // v4.155.0: the number that matches an actual day of interpreting.
    mix: weightedSlice(scored),
    byKind,
    worstCases: [...scored]
      .sort((a, b) => (b.displayRate?.wer ?? b.raw.wer) - (a.displayRate?.wer ?? a.raw.wer))
      .slice(0, 10)
      .map((c) => ({ id: c.id, kind: c.kind, wer: c.displayRate?.wer ?? c.raw.wer })),
    confusions: Object.entries(confusionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([pair, count]) => ({ pair, count })),
    missedTerms: [
      ...new Set(scored.flatMap((c) => c.term.missed || [])),
    ].slice(0, 20),
    // Keyterm force-fitting watch: terms that appear when the reference has none.
    inventedTerms: [
      ...new Set(scored.flatMap((c) => c.term.invented || [])),
    ].slice(0, 20),
    droppedPhrases: [
      ...new Set(scored.flatMap((c) => c.critical.dropped || [])),
    ].slice(0, 20),
  };
};

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const num = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`);

/** Markdown table for humans. Pure — a CLI can print it later. */
export const renderEvalReport = (summary, { title = 'STT eval' } = {}) => {
  const rows = [
    ['all', summary.overall],
    ...Object.entries(summary.byKind).map(([k, v]) => [k, v]),
  ].filter(([, v]) => v);
  const header =
    '| slice | cases | WER raw | WER display | damage | term acc | digits | critical | repair |\n' +
    '|---|---|---|---|---|---|---|---|---|';
  const body = rows
    .map(([name, v]) => {
      const d = v.damage == null ? '—' : `${v.damage > 0 ? '+' : ''}${v.damage.toFixed(2)}`;
      return `| ${name} | ${v.cases} | ${pct(v.werRaw)} | ${pct(v.werDisplay)} | ${d} | ${pct(v.termAccuracy)} | ${pct(v.digitRecall)} | ${pct(v.criticalRecall)} | ${num(v.repairGain)} |`;
    })
    .join('\n');

  // v4.155.0: the row that matches an actual day (95% medical / 5% legal).
  const mix = summary.mix
    ? `\n\n**Real-world mix** (cases weighted by how often they happen — weight ${summary.mix.weight}): ` +
      `WER raw ${pct(summary.mix.werRaw)}, WER display ${pct(summary.mix.werDisplay)}, ` +
      `term acc ${pct(summary.mix.termAccuracy)}, digits ${pct(summary.mix.digitRecall)}, ` +
      `critical ${pct(summary.mix.criticalRecall)}, repair ${num(summary.mix.repairGain)}`
    : '';

  const conf =
    summary.confusions.length > 0
      ? `\n\n**Worst confusions**\n${summary.confusions.map((c) => `- ${c.pair} (${c.count})`).join('\n')}`
      : '';
  const missed = summary.missedTerms.length
    ? `\n\n**Missed terms**: ${summary.missedTerms.join(', ')}`
    : '';
  const dropped = summary.droppedPhrases.length
    ? `\n\n**DROPPED critical phrases**: ${summary.droppedPhrases.join(', ')}`
    : '';
  const invented = summary.inventedTerms?.length
    ? `\n\n**INVENTED terms** (keyterm force-fitting watch): ${summary.inventedTerms.join(', ')}`
    : '';
  const worst = summary.worstCases.length
    ? `\n\n**Worst cases**: ${summary.worstCases.map((c) => `${c.id} (${pct(c.wer)})`).join(', ')}`
    : '';
  return `## ${title}\n\n${header}\n${body}${mix}${conf}${missed}${dropped}${invented}${worst}\n`;
};
