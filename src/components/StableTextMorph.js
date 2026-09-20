import React, { useEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from '../utils/motionPreference';
import {
  applyDisplayProtections,
  copyableDigits,
  copyableSensitiveValue,
  splitHighlightSegments,
} from '../utils/sensitiveDataProtector';
import { formatTranscriptForDisplay } from '../utils/transcriptFormat';
import { isProtectedToken } from '../utils/diffWordsStable';
import {
  SUPERSEDE_HOLD_MS,
  SUPERSEDE_MAX_EPISODE_MS,
  SUPERSEDE_MODE,
  SUPERSEDE_RETIRE_MS,
  classifySupersede,
  isEpisodeOverBudget,
  presentOpParts,
  resolveSupersedeTiming,
} from '../utils/textSupersede';
import { flagVanish } from '../utils/vanishTrace';

/** Short cue for plain continuation (growth) — unchanged since v4.84.1. */
const CUE_MS = 480;
const REDUCED_CUE_MS = 120;

const processDisplayText = (raw, lang, applyNumberWords, protectionsActive) => {
  const spelled = formatTranscriptForDisplay(raw, lang);
  if (!protectionsActive) return spelled;
  return applyDisplayProtections(spelled, lang, { applyNumberWords });
};

const SENSITIVE_TYPES = new Set(['date', 'schedule', 'number', 'dosage', 'vitals', 'money', 'address', 'email']);

const SensitiveSpan = ({ value, type = 'number' }) => {
  const copyVal = SENSITIVE_TYPES.has(type)
    ? copyableSensitiveValue(value, type)
    : copyableDigits(value);
  const kindClass = type === 'number' ? 'phone-number' : `${type}-unit`;
  return (
    <span
      className={`${kindClass} highlight-number`}
      onClick={(e) => {
        e.stopPropagation();
        if (copyVal) {
          try {
            navigator.clipboard.writeText(copyVal);
          } catch (_) {}
        }
      }}
      title={`Click to copy: ${copyVal}`}
      style={{
        cursor: 'copy',
        backgroundColor: 'rgba(252, 211, 77, 0.1)',
        color: '#fcd34d',
        padding: '0 2px',
        borderRadius: '2px',
        fontWeight: 600,
        display: 'inline',
      }}
    >
      {value}
    </span>
  );
};

const renderTokenText = (text) => {
  if (!text) return null;
  return splitHighlightSegments(text).map((seg, i) => {
    if (seg.type && SENSITIVE_TYPES.has(seg.type)) {
      return <SensitiveSpan key={`${seg.type}${i}`} value={seg.value} type={seg.type} />;
    }
    return <span key={`t${i}`}>{seg.value}</span>;
  });
};

/**
 * Continuity-preserving live transcript morph (v4.84.1) + supersede model (v4.140.0).
 *
 * Same parent stays mounted; word diff cues changes; never blank between A and B.
 * Not ScrambleText — critical reading continuity.
 *
 * v4.140.0 supersede model, for the reported symptom "words vanish while I am
 * reading them":
 *  - episode base: the first revision freezes the wording the interpreter is
 *    reading; every later revision re-diffs against THAT, so dimmed wording does
 *    not flicker back to full brightness nor accumulate as duplicates.
 *  - lifecycle: hold (readable, dimmed) -> retiring (exit fade) -> idle. Bounded
 *    twice: per episode (hold + retire) and by `SUPERSEDE_MAX_EPISODE_MS`.
 *  - decision is pure (`utils/textSupersede.js`), not inline JSX.
 */
export function StableTextMorph({
  text = '',
  lang = 'en',
  applyNumberWords = false,
  protectionsActive = true,
  continuityKey = '',
  cueMs = CUE_MS,
  wordConfidence = null,
  supersedeHoldMs = SUPERSEDE_HOLD_MS,
  supersedeRetireMs = SUPERSEDE_RETIRE_MS,
}) {
  const continuityRef = useRef(continuityKey);
  const prevDisplayRef = useRef('');
  const prevScoresRef = useRef([]);
  // While a supersede is on screen: the frozen wording + its scores + age.
  const episodeRef = useRef(null);
  // Exactly one pending stage at a time (hold | retire | plain cue).
  const timerRef = useRef(null);
  const [cue, setCue] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [reducedCue, setReducedCue] = useState(false);

  const display = useMemo(
    () => (text ? processDisplayText(text, lang, applyNumberWords, protectionsActive) : ''),
    [text, lang, applyNumberWords, protectionsActive],
  );

  const scores = useMemo(
    () => (Array.isArray(wordConfidence) ? wordConfidence : []),
    [wordConfidence],
  );

  if (continuityRef.current !== continuityKey) {
    if (prevDisplayRef.current) {
      flagVanish('morph_continuity_reset', {
        before: prevDisplayRef.current,
        after: display,
        remount: true,
        force: true,
        stage: 'StableTextMorph',
        extra: { fromKey: continuityRef.current, toKey: continuityKey },
      });
    }
    continuityRef.current = continuityKey;
    prevDisplayRef.current = '';
    prevScoresRef.current = [];
    episodeRef.current = null;
  }

  useEffect(() => {
    const prev = prevDisplayRef.current;
    const prevScores = prevScoresRef.current;
    prevDisplayRef.current = display;
    prevScoresRef.current = scores;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const schedule = (ms, fn) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        fn();
      }, ms);
    };
    const settle = () => {
      clearTimer();
      episodeRef.current = null;
      setCue(null);
      setPhase('idle');
    };

    if (!display) {
      if (prev) {
        flagVanish('morph_display_empty', {
          before: prev,
          after: '',
          derender: true,
          force: true,
          stage: 'StableTextMorph',
        });
      }
      settle();
      return () => {};
    }

    if (!prev || prev === display) {
      settle();
      return () => {};
    }

    const openEpisode = episodeRef.current;
    const baseText = openEpisode ? openEpisode.baseText : prev;
    const baseScores = openEpisode ? openEpisode.baseScores : prevScores;
    const decision = classifySupersede({
      prevText: baseText,
      nextText: display,
      prevScores: baseScores,
      nextScores: scores,
    });

    if (decision.lostTokens.length) {
      flagVanish('morph_word_diff', {
        before: baseText,
        after: display,
        lost: decision.lostTokens,
        stage: 'StableTextMorph',
        force: true,
        extra: {
          mode: decision.mode,
          reason: decision.reason,
          ops: decision.ops.filter((o) => o.type !== 'equal').map((o) => ({ type: o.type, from: o.from, text: o.text })),
        },
      });
    }

    const reduced = prefersReducedMotion();
    setReducedCue(reduced);

    // Bounded lifecycle: a long utterance keeps sending revisions. Without the
    // cap one dimmed word could ride the whole bubble, which is the duplicate
    // look we are removing. Past the cap we adopt quietly.
    const overBudget =
      Boolean(openEpisode) && isEpisodeOverBudget(openEpisode.startedAt, Date.now(), SUPERSEDE_MAX_EPISODE_MS);
    const superseding = decision.mode === SUPERSEDE_MODE.SUPERSEDE && !overBudget;

    if (!superseding) {
      episodeRef.current = null;
      const mode = overBudget && decision.mode === SUPERSEDE_MODE.SUPERSEDE
        ? SUPERSEDE_MODE.QUIET
        : decision.mode;
      setCue(mode === SUPERSEDE_MODE.NONE ? null : { ops: decision.ops, mode });
      setPhase('cue');
      schedule(reduced ? REDUCED_CUE_MS : cueMs, () => {
        setCue(null);
        setPhase('idle');
      });
      return () => clearTimer();
    }

    const timing = resolveSupersedeTiming(reduced, {
      holdMs: supersedeHoldMs,
      retireMs: supersedeRetireMs,
    });
    episodeRef.current = {
      baseText,
      baseScores,
      startedAt: openEpisode ? openEpisode.startedAt : Date.now(),
    };
    flagVanish('morph_supersede', {
      before: baseText,
      after: display,
      lost: decision.lostTokens,
      stage: 'StableTextMorph',
      force: true,
      extra: {
        reason: decision.reason,
        holdMs: timing.holdMs,
        retireMs: timing.retireMs,
        animate: timing.animate,
      },
    });

    setCue({ ops: decision.ops, mode: decision.mode });
    setPhase('cue');
    schedule(timing.holdMs, () => {
      setPhase('retiring');
      schedule(timing.retireMs, () => {
        episodeRef.current = null;
        setCue(null);
        setPhase('idle');
      });
    });
    return () => clearTimer();
  }, [display, cueMs, scores, supersedeHoldMs, supersedeRetireMs]);

  if (!display && !cue) return null;

  const renderParts = (op) => {
    let parts = presentOpParts(op, cue?.mode);
    if (!parts.length) return null;
    // Reduced motion: no ladder, the old wording leaves at once — except
    // protected tokens, which hold on screen (v4.116.0 numbers never vanish).
    if (reducedCue) {
      parts = parts.filter((p) => p.role !== 'superseded' || isProtectedToken(p.text));
    }
    // A separator without a left side is just noise.
    parts = parts.filter((p, i) => p.role !== 'arrow' || parts[i - 1]?.role === 'superseded');
    if (!parts.length) return null;

    return (
      <React.Fragment key={op.key}>
        {parts.map((part, i) => {
          if (part.role === 'equal') {
            return (
              <span key={`p${i}`} className="stm-equal">
                {renderTokenText(part.text)}
              </span>
            );
          }
          if (part.role === 'arriving') {
            return (
              <span key={`p${i}`} className="stm-arriving">
                {renderTokenText(part.text)}
              </span>
            );
          }
          if (part.role === 'adopted') {
            return (
              <span key={`p${i}`} className="stm-arriving stm-arriving--quiet">
                {renderTokenText(part.text)}
              </span>
            );
          }
          if (part.role === 'arrow') {
            return (
              <span key={`p${i}`} className="stm-arrow" aria-hidden>
                {part.text}
              </span>
            );
          }
          const protectedTok = isProtectedToken(part.text);
          return (
            <span
              key={`p${i}`}
              className={`stm-superseded${protectedTok ? ' stm-superseded--protected' : ''}`}
              aria-hidden
            >
              {/* Plain text on purpose: the superseded wording must stay readable
                  but must never be copyable — clicking it used to hand back a
                  stale phone number / dose (v4.140.0). */}
              {part.text}
            </span>
          );
        })}
      </React.Fragment>
    );
  };

  if (cue) {
    return (
      <span
        className="stable-text-morph"
        data-morphing="1"
        data-phase={phase}
        // Lets the framed word settle over the same window JS holds it for.
        style={{ '--stm-hold-ms': `${supersedeHoldMs}ms` }}
      >
        {cue.ops.map(renderParts)}
      </span>
    );
  }

  return (
    <span className="stable-text-morph" data-morphing="0" data-phase={phase}>
      {renderTokenText(display)}
    </span>
  );
}

export default StableTextMorph;
