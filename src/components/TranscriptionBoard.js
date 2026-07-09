import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTTS } from '../hooks/useTTS';
import { useTranslate } from '../hooks/useTranslate';
import { useSession, safeSet } from '../contexts/SessionContext';
import { useAudioSettings } from '../contexts/AudioSettingsContext';
import { truncateDeviceLabel } from '../utils/audioSelfTest';
import {
  applyDisplayProtections,
  copyableDigits,
  copyableSensitiveValue,
  NUMBER_HIGHLIGHT_REGEX,
  splitHighlightSegments,
} from '../utils/sensitiveDataProtector';
import { formatTranscriptForDisplay, collectCopyableEntities } from '../utils/transcriptFormat';
import { ScrambleText } from './ScrambleText';
import { StableLiveTranscriptText } from './StableLiveTranscriptText';
import { buildCaptionContinuityKeys } from '../utils/stableLiveTranscript';
import { alignWordConfidence, confidenceVisualFor } from '../utils/wordConfidenceAlign';
import { flagVanish, traceCaptionArrayDiff, observeDomVanish } from '../utils/vanishTrace';
import { nextLiveHeightLock } from '../utils/liveBubbleHeight';
import {
  isCaptionPinned,
  migratePinnedCaptions,
  togglePinEntry,
} from '../utils/pinnedCaptions';
import { NewcomerIdleGuide } from './NewcomerIdleGuide';
import { isNewcomerGuideDismissed } from '../utils/newcomerGuide';
import { isTranslationStuckForRetranslate } from '../utils/translationQuality';
import {
  isComponentVisible,
  useComponentVisibilityRefresh,
} from '../utils/componentVisibility';
import {
  loadLanguagePair,
  isEnEsProtectionMode,
  shouldReverseBubble,
  normalizeLang,
  getOppositeLang,
  LANG_PAIR_CHANGED_EVENT,
} from '../utils/languageConfig';
import { BubbleCorrectionEditor } from './BubbleCorrectionEditor';
import {
  saveCorrection,
  applySttCorrections,
  CORRECTION_KIND,
  CORRECTIONS_CHANGED_EVENT,
} from '../utils/transcriptCorrections';

// EL TABLERO DE TEXTO: Aquí es donde aparece todo lo que dicen en la llamada.
// Muestra quién habla, lo traduce y te deja copiar los números con un clic.
const getBubbleStyle = (text, isCurrent, lang, pair) => {
  if (!text) return {};
  const wordCount = text.trim().split(/\s+/).length;
  const p = pair || loadLanguagePair();
  const isRight = normalizeLang(lang) === normalizeLang(p.right);

  let baseBorder = isRight ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)';
  let baseBg = isRight ? 'rgba(16, 185, 129, 0.03)' : 'rgba(59, 130, 246, 0.03)';

  if (wordCount >= 40) {
    baseBorder = 'rgba(239, 68, 68, 0.6)';
    baseBg = 'rgba(239, 68, 68, 0.03)';
  } else if (wordCount >= 34) {
    baseBorder = 'rgba(245, 158, 11, 0.6)';
    baseBg = 'rgba(245, 158, 11, 0.03)';
  }

  return { borderLeft: `3px solid ${baseBorder}`, backgroundColor: baseBg };
};

const processDisplayText = (raw, lang, applyNumberWords, protectionsActive) => {
  const spelled = formatTranscriptForDisplay(raw, lang);
  if (!protectionsActive) return spelled;
  return applyDisplayProtections(spelled, lang, { applyNumberWords });
};

/** Stable split — dates as one unit, then numbers. */
const splitDisplaySegments = (segment) => {
  if (!segment) return [];
  return splitHighlightSegments(segment);
};

const commonWordPrefixLen = (a = '', b = '') => {
  const aParts = a.match(/\S+\s*/g) || [];
  const bParts = b.match(/\S+\s*/g) || [];
  let len = 0;
  const n = Math.min(aParts.length, bParts.length);
  for (let i = 0; i < n; i += 1) {
    if (aParts[i].trim() !== bParts[i].trim()) break;
    len += bParts[i].length;
  }
  return len;
};

/** Blue tail slice — same pipeline for bubble text + tailPreviewText. */
const resolveTailHighlight = (repairedText, rawText, tailPreviewText, lang, applyNumberWords, protectionsActive) => {
  if (!tailPreviewText?.trim() || !repairedText) return null;

  const processedTail = processDisplayText(tailPreviewText, lang, applyNumberWords, protectionsActive);
  let idx = repairedText.indexOf(processedTail);

  // Fallback when sealed bubble text diverges slightly from raw tail preview.
  if (idx < 0 && rawText?.trim().endsWith(tailPreviewText.trim())) {
    idx = Math.max(0, repairedText.length - processedTail.length);
  }
  if (idx < 0) return null;

  const highlight = repairedText.slice(idx, idx + processedTail.length);
  return {
    before: repairedText.slice(0, idx),
    highlight,
    after: repairedText.slice(idx + highlight.length),
  };
};

/** One-click copy chip for names, spelled text, etc. */
const CopyChip = ({ value, label, kind = 'default' }) => {
  if (!value) return null;
  return (
    <button
      type="button"
      className={`copy-chip copy-chip--${kind}`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
      }}
      title={`Click to copy ${label}: ${value}`}
    >
      <span className="copy-chip-kind">{label}</span>
      <span className="copy-chip-value">{value}</span>
      <span className="copy-chip-icon" aria-hidden>⎘</span>
    </button>
  );
};

const InteractiveText = ({
  text,
  scramble = true,
  applyNumberWords = false,
  lang = 'en',
  protectionsActive = true,
  tailPreviewText = null,
  wordConfidence = null,
  isFinal = true,
}) => {
  const copyEntities = useMemo(() => (text ? collectCopyableEntities(text, lang) : []), [text, lang]);
  const repairedText = useMemo(
    () => (text ? processDisplayText(text, lang, applyNumberWords, protectionsActive) : ''),
    [text, lang, applyNumberWords, protectionsActive],
  );
  const alignedWords = useMemo(
    () => alignWordConfidence(repairedText, wordConfidence),
    [repairedText, wordConfidence],
  );
  const tailSlice = useMemo(
    () => (text ? resolveTailHighlight(repairedText, text, tailPreviewText, lang, applyNumberWords, protectionsActive) : null),
    [repairedText, text, tailPreviewText, lang, applyNumberWords, protectionsActive],
  );
  const previousTextRef = useRef('');
  const liveStablePrefixLen = useMemo(() => {
    if (!scramble || !previousTextRef.current || !repairedText) return 0;
    return commonWordPrefixLen(previousTextRef.current, repairedText);
  }, [repairedText, scramble]);

  useEffect(() => {
    previousTextRef.current = repairedText;
  }, [repairedText]);

  const handleCopy = useCallback((value, type = 'number') => {
    const clean = (type === 'date' || type === 'dosage' || type === 'money')
      ? copyableSensitiveValue(value, type)
      : copyableDigits(value);
    if (!clean) return;
    navigator.clipboard.writeText(clean);
  }, []);

  const renderPart = useCallback((seg, i, keyPrefix = '', forcePlain = false, opts = {}) => {
    const { confidenceClass = '', liveScramble = false } = opts;
    const partKey = `${keyPrefix}${i}`;
    const useScramble = scramble && !forcePlain;
    if (typeof seg === 'string') {
      if (seg && seg.match(NUMBER_HIGHLIGHT_REGEX)) {
        return (
          <span
            key={partKey}
            className={`phone-number highlight-number${confidenceClass}`}
            onClick={(e) => { e.stopPropagation(); handleCopy(seg, 'number'); }}
            title={`Click to copy: ${copyableDigits(seg)}`}
            style={{ cursor: 'copy', backgroundColor: 'rgba(252, 211, 77, 0.1)', color: '#fcd34d', padding: '0 2px', borderRadius: '2px', fontWeight: 600, display: 'inline' }}
          >
            {useScramble ? <ScrambleText value={seg} liveMode={liveScramble} /> : seg}
          </span>
        );
      }
      return useScramble ? (
        <ScrambleText key={partKey} value={seg} className={confidenceClass.trim()} liveMode={liveScramble} />
      ) : (
        <span key={partKey} className={confidenceClass.trim()}>{seg}</span>
      );
    }
    if (seg?.type === 'date' || seg?.type === 'number' || seg?.type === 'dosage' || seg?.type === 'money') {
      const copyVal = seg.copyValue
        || (seg.type === 'number' ? copyableDigits(seg.value) : copyableSensitiveValue(seg.value, seg.type));
      const kindClass = seg.type === 'number' ? 'phone-number' : `${seg.type}-unit`;
      return (
        <span
          key={partKey}
          className={`${kindClass} highlight-number${confidenceClass}`}
          onClick={(e) => { e.stopPropagation(); handleCopy(seg.value, seg.type); }}
          title={`Click to copy: ${copyVal}`}
          style={{ cursor: 'copy', backgroundColor: 'rgba(252, 211, 77, 0.1)', color: '#fcd34d', padding: '0 2px', borderRadius: '2px', fontWeight: 600, display: 'inline' }}
        >
          {useScramble ? <ScrambleText value={seg.value} liveMode={liveScramble} /> : seg.value}
        </span>
      );
    }
    const plain = seg?.value ?? '';
    return useScramble ? (
      <ScrambleText key={partKey} value={plain} className={confidenceClass.trim()} liveMode={liveScramble} />
    ) : (
      <span key={partKey} className={confidenceClass.trim()}>{plain}</span>
    );
  }, [scramble, handleCopy]);

  const renderSegment = useCallback((segment, keyPrefix = '', forcePlain = false, opts = {}) => {
    if (!segment) return null;
    return splitDisplaySegments(segment).map((p, i) => renderPart(p, i, keyPrefix, forcePlain, opts));
  }, [renderPart]);

  const renderConfidenceText = useCallback((
    value = repairedText,
    wordOffset = 0,
    forcePlain = !scramble,
    keyRoot = 'cw',
    liveTail = false,
  ) => {
    if (!alignedWords?.length || !value) return null;
    let wordIndex = 0;
    return value.split(/(\s+)/).map((token, idx) => {
      if (!token) return null;
      if (/^\s+$/.test(token)) return <span key={`space-${idx}`}>{token}</span>;
      const meta = alignedWords[wordOffset + wordIndex] || null;
      wordIndex += 1;
      const visual = confidenceVisualFor(meta?.confidence, isFinal);
      const title = Number.isFinite(meta?.confidence)
        ? `Deepgram confidence ${Math.round(meta.confidence * 100)}%`
        : undefined;
      return (
        <span
          key={`word-${idx}`}
          className={`confidence-word${visual.className ? ` ${visual.className}` : ''}`}
          style={{ color: visual.color, opacity: visual.opacity }}
          title={title}
        >
          {renderSegment(token, `${keyRoot}-${idx}-`, forcePlain, {
            liveScramble: !forcePlain && liveTail,
          })}
        </span>
      );
    });
  }, [alignedWords, isFinal, repairedText, renderSegment, scramble]);

  const renderLiveDiffText = useCallback(() => {
    if (!scramble || liveStablePrefixLen <= 0 || liveStablePrefixLen >= repairedText.length) return null;
    const stable = repairedText.slice(0, liveStablePrefixLen);
    const tail = repairedText.slice(liveStablePrefixLen);
    const stableWords = stable.trim() ? stable.trim().split(/\s+/).length : 0;
    return (
      <>
        {alignedWords?.length
          ? renderConfidenceText(stable, 0, true, 'stable', false)
          : renderSegment(stable, 'stable-', true)}
        <span className="transcript-live-tail">
          {alignedWords?.length
            ? renderConfidenceText(tail, stableWords, false, 'tail', true)
            : renderSegment(tail, 'tail-', false, { liveScramble: true })}
        </span>
      </>
    );
  }, [alignedWords, liveStablePrefixLen, repairedText, renderConfidenceText, renderSegment, scramble]);

  if (!text) return null;

  // Phase A: chips only on sealed bubbles; trailing (after text), not a slab above.
  // Phase D: spelling stays spoken paragraph; Spelled chip via collectCopyableEntities.
  const chipRow = isFinal && copyEntities.length > 0 ? (
    <span className="copy-chip-row copy-chip-row--trailing">
      {copyEntities.map((ent) => (
        <CopyChip key={`${ent.kind}-${ent.value}`} value={ent.value} label={ent.label} kind={ent.kind} />
      ))}
    </span>
  ) : null;

  if (tailSlice) {
    const beforeWords = tailSlice.before.trim() ? tailSlice.before.trim().split(/\s+/).length : 0;
    const highlightWords = tailSlice.highlight.trim() ? tailSlice.highlight.trim().split(/\s+/).length : 0;
    return (
      <>
        {alignedWords.length
          ? renderConfidenceText(tailSlice.before, 0, true, 'pre', false)
          : renderSegment(tailSlice.before, 'pre-')}
        <span className="transcript-tail-preview">
          {alignedWords.length
            ? renderConfidenceText(tailSlice.highlight, beforeWords, true, 'tail', false)
            : renderSegment(tailSlice.highlight, 'tail-', true)}
        </span>
        {alignedWords.length
          ? renderConfidenceText(tailSlice.after, beforeWords + highlightWords, true, 'post', false)
          : renderSegment(tailSlice.after, 'post-')}
        {chipRow}
      </>
    );
  }

  const liveDiffText = renderLiveDiffText();
  if (liveDiffText) {
    return (
      <>
        {liveDiffText}
        {chipRow}
      </>
    );
  }

  const confidenceText = renderConfidenceText(repairedText, 0, !scramble, 'cw', scramble && !isFinal);
  if (confidenceText) {
    return (
      <>
        {confidenceText}
        {chipRow}
      </>
    );
  }

  return (
    <>
      {renderSegment(repairedText)}
      {chipRow}
    </>
  );
};

const MemoInteractiveText = React.memo(InteractiveText);
const BubbleRail = ({
  engineStatus,
  turnWordCount,
  showTurnWordCount,
  isThisPlaying,
  canPlay,
  onPlayClick,
}) => {
  const steps = ['translating', 'processing', 'ready'];
  const currentIndex = steps.indexOf(engineStatus === 'buffering' ? 'processing' : engineStatus);
  const wc = turnWordCount || 0;
  const showWc = showTurnWordCount && wc > 0;
  const wcColor = wc >= 40 ? 'var(--danger)' : wc >= 34 ? '#f59e0b' : 'var(--text-muted)';
  const tprTitle = 'T=transcribe · P=process · R=ready · Word count = whole turn (resets after ~2.5s silence)';

  return (
    <div className="bubble-rail" title={tprTitle}>
      <svg className="bubble-rail-tpr" width="11" height="8" viewBox="0 0 11 8" aria-hidden>
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={i * 4}
            y="0"
            width="2.5"
            height="8"
            rx="0.5"
            fill={
              i <= currentIndex
                ? i === 2
                  ? '#10b981'
                  : '#3b82f6'
                : 'rgba(255,255,255,0.12)'
            }
          />
        ))}
      </svg>
      {showWc && (
        <span className="bubble-rail-wc" style={{ color: wcColor }} title={`${wc} words`}>
          {wc > 99 ? '99' : wc}
        </span>
      )}
      <button
        type="button"
        className="bubble-rail-play"
        onClick={onPlayClick}
        disabled={!isThisPlaying && !canPlay}
        title={isThisPlaying ? 'Stop' : canPlay ? 'Play translation' : 'Waiting for audio'}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
          {isThisPlaying ? (
            <>
              <rect x="2" y="2" width="3" height="8" fill="currentColor" />
              <rect x="7" y="2" width="3" height="8" fill="currentColor" />
            </>
          ) : (
            <path d="M2 1.5 L9 6 L2 10.5 Z" fill="currentColor" />
          )}
        </svg>
      </button>
    </div>
  );
};

const TranslatedBubble = ({
  id,
  text,
  lang,
  playTTS,
  stopTTS,
  playingUrl,
  prefetchTTS,
  reverse = false,
  ttsMode,
  turnWordCount,
  showTurnWordCount,
  shouldPrefetch,
  isPinned,
  onTogglePin,
  forceTranslateKey = 0,
  onManualRetranslate,
  tailPreviewText = null,
  wordConfidence = null,
  isFinal = true,
  allowAutoRetranslate = true,
  languagePair = null,
  protectionsActive = true,
  mockTranslation = null,
  userCorrected = false,
  userTranslationOverride = null,
  persistedTranslations = null,
  onPersistTranslation = null,
  onEditSource,
  onEditTranslation,
  canEdit = true,
  correctionsRev = 0,
  continuityKey = '',
}) => {
  const { translationMood } = useSession();
  const displaySourceText = useMemo(() => {
    if (userCorrected) return text;
    return applySttCorrections(text, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, lang, userCorrected, correctionsRev]);

  const { translation, audioUrl, engineStatus, translationMeta, targetLang } = useTranslate(
    displaySourceText,
    lang,
    prefetchTTS,
    shouldPrefetch,
    translationMood,
    forceTranslateKey,
    {
      isFinal,
      mockTranslation,
      userTranslationOverride,
      captionId: id,
      persistedTranslations,
      onPersistTranslation,
    },
  );
  const isThisPlaying = playingUrl && audioUrl && playingUrl === audioUrl;
  const transcriptColor = '#ffffff';
  const translationColor = '#a1a1aa';

  const isTranslationStuck = isTranslationStuckForRetranslate(
    displaySourceText,
    translation,
    lang,
    targetLang,
    translationMeta,
  );
  const isTranslationMissing = engineStatus === 'ready' && !translation?.trim();

  // UX: if a message is clearly "untranslated", we should just try again,
  // and only show a ↻ button as a fallback.
  const shouldAutoRetranslate =
    allowAutoRetranslate &&
    !isPinned &&
    engineStatus === 'ready' &&
    (isTranslationStuck || isTranslationMissing);
  const [autoRetranslatePending, setAutoRetranslatePending] = useState(false);
  const [hasAutoRetranslated, setHasAutoRetranslated] = useState(false);

  useEffect(() => {
    setAutoRetranslatePending(false);
    setHasAutoRetranslated(false);
  }, [id]);

  useEffect(() => {
    if (!shouldAutoRetranslate) return;
    if (hasAutoRetranslated || autoRetranslatePending) return;

    setAutoRetranslatePending(true);
    const t = setTimeout(() => {
      onManualRetranslate?.();
      setHasAutoRetranslated(true);
      setAutoRetranslatePending(false);
    }, 200);

    return () => clearTimeout(t);
  }, [shouldAutoRetranslate, hasAutoRetranslated, autoRetranslatePending, onManualRetranslate]);

  const isProblemTranslation = isTranslationStuck || isTranslationMissing;
  const showManualRetranslateBtn =
    !isPinned && engineStatus === 'ready' && isProblemTranslation && hasAutoRetranslated && !autoRetranslatePending;
  const showEdit = canEdit && isFinal && onEditSource;
  const openSourceEdit = () => onEditSource?.(displaySourceText);
  const openTranslationEdit = () => onEditTranslation?.(translation || userTranslationOverride || '');
  const sourceUsesNumberWords =
    protectionsActive && normalizeLang(lang) === 'en';
  const targetUsesNumberWords =
    protectionsActive && normalizeLang(targetLang) === 'en';
  // v4.84: never scramble live STT source; sealed source stays plain (no typewriter).
  const sourceScramble = false;
  const targetScramble = false;
  const translationFailed =
    engineStatus === 'ready' && !translation?.trim() && translationMeta?.quality === 'failed';
  const translationTitle = translationFailed
    ? 'Translation failed — check Settings → Translation for engine status'
    : undefined;
  const useStableLiveSource = !isFinal;

  return (
    <div className={`translated-bubble-row${reverse ? ' is-reverse' : ''}${userCorrected || userTranslationOverride ? ' is-user-corrected' : ''}${useStableLiveSource ? ' is-live-source' : ' is-sealed-source'}`}>
      <div
        className={`bubble-col bubble-col-source${showEdit ? ' bubble-col--editable' : ''}`}
        style={{ textAlign: reverse ? 'right' : 'left', position: 'relative' }}
        onDoubleClick={showEdit ? openSourceEdit : undefined}
      >
        <div className="bubble-line" style={{ color: transcriptColor }}>
          {useStableLiveSource ? (
            <StableLiveTranscriptText
              text={displaySourceText}
              lang={lang}
              applyNumberWords={sourceUsesNumberWords}
              protectionsActive={protectionsActive}
              continuityKey={continuityKey || id}
            />
          ) : (
            <MemoInteractiveText
              text={displaySourceText}
              scramble={sourceScramble}
              applyNumberWords={sourceUsesNumberWords}
              lang={lang}
              protectionsActive={protectionsActive}
              tailPreviewText={null}
              wordConfidence={wordConfidence}
              isFinal={isFinal}
            />
          )}
        </div>
        {showEdit && (
          <button
            type="button"
            className="bubble-edit-btn"
            onClick={openSourceEdit}
            title="Fix transcription (double-click)"
            aria-label="Fix transcription"
          >
            ✎
          </button>
        )}
      </div>

      <div
        data-guide="bubble-rail"
        className="bubble-col bubble-col-rail"
        style={{ position: 'relative', minWidth: '6ch' }}
      >
        {showManualRetranslateBtn ? (
          <button
            type="button"
            className="bubble-rail-retranslate-btn"
            onClick={onManualRetranslate}
            title="Retrigger translation for this message"
            aria-label="Retrigger translation"
          >
            {reverse ? '←' : '→'} ↻
          </button>
        ) : (
          <BubbleRail
            engineStatus={engineStatus}
            turnWordCount={turnWordCount}
            showTurnWordCount={showTurnWordCount}
            isThisPlaying={isThisPlaying}
            canPlay={Boolean(translation && audioUrl)}
            onPlayClick={() => (isThisPlaying ? stopTTS() : playTTS(translation, targetLang, audioUrl))}
          />
        )}
      </div>

      <div
        className={`bubble-col bubble-col-translation${showEdit ? ' bubble-col--editable' : ''}`}
        style={{ color: translationColor, textAlign: 'left', position: 'relative' }}
        title={translationTitle}
        onDoubleClick={showEdit ? openTranslationEdit : undefined}
      >
        <div className="bubble-line bubble-line-translation">
          {translation ? (
            <MemoInteractiveText text={translation} scramble={targetScramble} applyNumberWords={targetUsesNumberWords} lang={targetLang} protectionsActive={protectionsActive} />
          ) : translationFailed ? (
            <span style={{ opacity: 0.3, fontSize: '0.7rem' }}>⚠️ translation failed</span>
          ) : autoRetranslatePending || engineStatus === 'translating' ? (
            <span style={{ opacity: 0.2 }}>...</span>
          ) : engineStatus === 'ready' ? (
            <span style={{ opacity: 0.25, fontSize: '0.7rem' }}>…</span>
          ) : (
            <span style={{ opacity: 0.2 }}>...</span>
          )}
        </div>
        {showEdit && (
          <button
            type="button"
            className="bubble-edit-btn bubble-edit-btn--translation"
            onClick={openTranslationEdit}
            title="Fix translation (double-click)"
            aria-label="Fix translation"
          >
            ✎
          </button>
        )}
      </div>
    </div>
  );
};

const translatedBubblePropsEqual = (prev, next) =>
  prev.id === next.id &&
  prev.text === next.text &&
  prev.lang === next.lang &&
  prev.isFinal === next.isFinal &&
  prev.tailPreviewText === next.tailPreviewText &&
  prev.wordConfidence === next.wordConfidence &&
  prev.forceTranslateKey === next.forceTranslateKey &&
  prev.allowAutoRetranslate === next.allowAutoRetranslate &&
  prev.reverse === next.reverse &&
  prev.showTurnWordCount === next.showTurnWordCount &&
  prev.turnWordCount === next.turnWordCount &&
  prev.shouldPrefetch === next.shouldPrefetch &&
  prev.isPinned === next.isPinned &&
  prev.ttsMode === next.ttsMode &&
  prev.playingUrl === next.playingUrl &&
  prev.protectionsActive === next.protectionsActive &&
  prev.userCorrected === next.userCorrected &&
  prev.userTranslationOverride === next.userTranslationOverride &&
  prev.persistedTranslations === next.persistedTranslations &&
  prev.onPersistTranslation === next.onPersistTranslation &&
  prev.canEdit === next.canEdit &&
  prev.correctionsRev === next.correctionsRev &&
  prev.continuityKey === next.continuityKey &&
  prev.languagePair?.left === next.languagePair?.left &&
  prev.languagePair?.right === next.languagePair?.right;

const MemoTranslatedBubble = React.memo(TranslatedBubble, translatedBubblePropsEqual);

export const TranscriptionBoard = ({
  captions,
  onClearAll,
  onReconnect,
  lastDataTime,
  connectProgress = null,
  connectionState = 'disconnected',
  audioAttached = false,
  micTestMode = false,
}) => {
  const bottomRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const isScrolledUpRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const lastScrollKeyRef = useRef('');
  const ttsMode = 'manual';
  const [pinnedCaptions, setPinnedCaptions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('catint_pinned_msgs')) || [];
    } catch {
      return [];
    }
  });
  const [translationBumps, setTranslationBumps] = useState({});
  const [newcomerSessionHidden, setNewcomerSessionHidden] = useState(false);
  const [languagePair, setLanguagePair] = useState(loadLanguagePair);
  const protectionsActive = isEnEsProtectionMode(languagePair);
  const { playTTS, stopTTS, isPlaying, playingUrl, prefetchTTS } = useTTS();
  const { isActive, isZombieCall, lastCallSummary, setLastCallSummary, updateCaptions } = useSession();

  /** Persist sealed translation entries onto caption.translations (IDB via updateCaptions). */
  const persistCaptionTranslation = useCallback((capId, entry) => {
    if (!capId || !entry?.key) return;
    updateCaptions((prev) =>
      prev.map((c) => {
        if (c.id !== capId) return c;
        if (c.isFinal === false) return c; // sealed/final only
        const translations = { ...(c.translations || {}), [entry.key]: entry };
        return { ...c, translations };
      }),
    );
  }, [updateCaptions]);

  useComponentVisibilityRefresh();
  const showOffCallGuide = isComponentVisible('off_call_guide', { isActive, isZombieCall });
  const { inputDevices, outputDevices, selectedMicId, selectedSinkId } = useAudioSettings();
  const ioRouteHint = React.useMemo(() => {
    const mic = inputDevices.find((d) => d.deviceId === selectedMicId);
    const out = outputDevices.find((d) => d.deviceId === selectedSinkId);
    const micLabel = truncateDeviceLabel(mic?.label || 'Default mic');
    const outLabel = truncateDeviceLabel(out?.label || 'Default out');
    return `🎤 ${micLabel} → 🔊 ${outLabel}`;
  }, [inputDevices, outputDevices, selectedMicId, selectedSinkId]);
  const [popover, setPopover] = useState({ show: false, x: 0, y: 0, text: '' });
  const popoverTimerRef = useRef(null);
  const [correctionsRev, setCorrectionsRev] = useState(0);
  const [correctionEditor, setCorrectionEditor] = useState(null);
  const [footerStatus, setFooterStatus] = useState('');
  const [sttNow, setSttNow] = useState(Date.now());
  const liveBubbleHeightsRef = useRef(new Map());
  const lastRenderTraceRef = useRef('');
  const prevCaptionsRef = useRef([]);
  const [, setLiveHeightRev] = useState(0);

  useEffect(() => {
    const onCorrections = () => setCorrectionsRev((n) => n + 1);
    window.addEventListener(CORRECTIONS_CHANGED_EVENT, onCorrections);
    return () => window.removeEventListener(CORRECTIONS_CHANGED_EVENT, onCorrections);
  }, []);

  useEffect(() => {
    if (connectionState !== 'connected' || !connectProgress?.audioChunksSent) return undefined;
    const id = window.setInterval(() => setSttNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [connectProgress?.audioChunksSent, connectionState]);

  useEffect(() => {
    traceCaptionArrayDiff(prevCaptionsRef.current, captions, 'TranscriptionBoard.captions');
    prevCaptionsRef.current = captions;
  }, [captions]);

  // DOM-level vanish net: catches bubble remove/relocate that state diffing misses.
  useEffect(() => observeDomVanish(scrollAreaRef.current), []);

  useEffect(() => {
    const lastCap = captions[captions.length - 1];
    if (!lastCap) return;
    const key = `${captions.length}|${lastCap.id}|${lastCap.text}|${lastCap.isFinal}`;
    if (lastRenderTraceRef.current === key) return;
    lastRenderTraceRef.current = key;
    if (typeof window !== 'undefined') {
      const entry = {
        at: new Date().toISOString(),
        ms: Math.round(performance.now()),
        stage: '7 string rendered in TranscriptionBoard',
        rows: captions.length,
        id: lastCap.id,
        chars: lastCap.text?.length || 0,
        text: (lastCap.text || '').slice(0, 160),
        wordConfidenceCount: lastCap.wordConfidence?.length || 0,
        isFinal: lastCap.isFinal !== false,
      };
      const trace = (window.__catintSttTrace ??= []);
      trace.push(entry);
      if (trace.length > 300) trace.splice(0, trace.length - 300);
      console.info('[CAT STT] 7 string rendered in TranscriptionBoard', entry);
      if ((lastCap.text || '').trim() && !(lastCap.wordConfidence?.length)) {
        console.warn('[CAT STT] rendered without word confidence', {
          id: lastCap.id,
          chars: lastCap.text?.length || 0,
          text: (lastCap.text || '').slice(0, 160),
        });
      }
    }
  }, [captions]);

  const openCorrectionEditor = useCallback((cap, field, draft, extra = {}) => {
    const sourceLang = normalizeLang(cap.lang);
    const targetLang = getOppositeLang(sourceLang, languagePair);
    setCorrectionEditor({
      capId: cap.id,
      field,
      draft: draft || '',
      sttHeard: extra.sttHeard ?? cap.sttHeard ?? cap.text ?? '',
      sourceLang,
      targetLang,
      sourceText: cap.text || '',
    });
  }, [languagePair]);

  const closeCorrectionEditor = useCallback(() => setCorrectionEditor(null), []);

  const handleCorrectionSave = useCallback(() => {
    if (!correctionEditor) return;
    const { capId, field, draft, sttHeard, sourceLang, targetLang, sourceText } = correctionEditor;
    const trimmed = (draft || '').trim();
    if (!trimmed) return;

    if (field === 'source') {
      saveCorrection({
        sourceHeard: sttHeard,
        corrected: trimmed,
        lang: sourceLang,
        kind: CORRECTION_KIND.STT,
      });
      updateCaptions((prev) =>
        prev.map((c) =>
          c.id === capId
            ? {
                ...c,
                text: trimmed,
                userCorrected: true,
                sttHeard,
                userTranslationOverride: null,
              }
            : c,
        ),
      );
      setTranslationBumps((prev) => ({ ...prev, [capId]: (prev[capId] ?? 0) + 1 }));
    } else {
      saveCorrection({
        sourceHeard: sourceText,
        corrected: trimmed,
        lang: sourceLang,
        targetLang,
        kind: CORRECTION_KIND.GLOSSARY,
      });
      updateCaptions((prev) =>
        prev.map((c) => (c.id === capId ? { ...c, userTranslationOverride: trimmed } : c)),
      );
    }
    setCorrectionEditor(null);
  }, [correctionEditor, updateCaptions]);

  const makeEditHandlers = useCallback(
    (cap) => ({
      onEditSource: (displayText) =>
        openCorrectionEditor(cap, 'source', displayText, { sttHeard: cap.sttHeard || cap.text }),
      onEditTranslation: (currentTranslation) =>
        openCorrectionEditor(cap, 'translation', currentTranslation || cap.userTranslationOverride || ''),
    }),
    [openCorrectionEditor],
  );

  const rememberLiveBubbleHeight = useCallback((id, node, textLen = 0) => {
    if (!id || !node) return;
    const height = Math.ceil(node.getBoundingClientRect().height);
    const action = nextLiveHeightLock(liveBubbleHeightsRef.current.get(id), height, textLen);
    if (!action) return;
    if (action.release) {
      // v4.84.10: shrunk text must drop the lock entirely (old code re-locked at
      // the inflated measured height — the "void" after seal-splits).
      liveBubbleHeightsRef.current.delete(id);
      setLiveHeightRev((n) => n + 1);
      return;
    }
    liveBubbleHeightsRef.current.set(id, action.set);
    if (action.rerender) setLiveHeightRev((n) => n + 1);
  }, []);

  useEffect(() => {
    const activeLiveIds = new Set(
      captions.filter((cap) => cap?.id && cap.isFinal === false).map((cap) => cap.id),
    );
    liveBubbleHeightsRef.current.forEach((_, id) => {
      if (!activeLiveIds.has(id)) liveBubbleHeightsRef.current.delete(id);
    });
  }, [captions]);

  const handleClearLog = useCallback(() => {
    const ok = window.confirm(
      'Clear transcript log? Pinned messages stay. This cannot be undone.',
    );
    if (!ok) return;
    onClearAll?.();
    setFooterStatus('Transcript cleared');
    setTimeout(() => setFooterStatus(''), 2500);
  }, [onClearAll]);

  const handleCopyPinned = useCallback(() => {
    const pinnedText = pinnedCaptions
      .map((c) => `[${(c.lang || 'en').toUpperCase()}] ${c.text}`)
      .join('\n---\n');
    navigator.clipboard.writeText(pinnedText).then(
      () => {
        setFooterStatus(`Copied ${pinnedCaptions.length} pinned message(s)`);
        setTimeout(() => setFooterStatus(''), 2500);
      },
      () => setFooterStatus('Copy failed — check browser permissions'),
    );
  }, [pinnedCaptions]);
  
  // Smart Bubble Compression: auto-collapse long bubbles to reduce reading fatigue
  const [expandedIds, setExpandedIds] = useState(new Set());
  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    safeSet('catint_pinned_msgs', JSON.stringify(pinnedCaptions));
  }, [pinnedCaptions]);

  // Caption ids change on seal/split — keep pins aligned to the same bubble.
  useEffect(() => {
    setPinnedCaptions((prev) => {
      const next = migratePinnedCaptions(prev, captions);
      return next === prev ? prev : next;
    });
  }, [captions]);

  useEffect(() => {
    const onPairChange = (e) => setLanguagePair(e.detail || loadLanguagePair());
    window.addEventListener(LANG_PAIR_CHANGED_EVENT, onPairChange);
    return () => window.removeEventListener(LANG_PAIR_CHANGED_EVENT, onPairChange);
  }, []);

  // UX: new call start should clear pinned messages (without affecting transcript history).
  useEffect(() => {
    const onPinnedCleared = () => {
      setPinnedCaptions([]);
      safeSet('catint_pinned_msgs', JSON.stringify([]));
    };
    window.addEventListener('catint_pinned_cleared', onPinnedCleared);
    return () => window.removeEventListener('catint_pinned_cleared', onPinnedCleared);
  }, []);

  const captionRenderKeys = useMemo(
    () => buildCaptionContinuityKeys(captions),
    [captions],
  );
  const lastAudioChunkAt = connectProgress?.lastAudioChunkAt || 0;
  const showSttSoundbar = connectionState === 'connected';
  const audioHot = lastAudioChunkAt > 0 && sttNow - lastAudioChunkAt < 1400;
  const enConfidence = Number.isFinite(connectProgress?.lastSocketEnConfidence)
    ? connectProgress.lastSocketEnConfidence
    : null;
  const esConfidence = Number.isFinite(connectProgress?.lastSocketEsConfidence)
    ? connectProgress.lastSocketEsConfidence
    : null;
  const enRecent = (connectProgress?.lastSocketEnMessageAt || 0) > 0 && sttNow - connectProgress.lastSocketEnMessageAt < 4500;
  const esRecent = (connectProgress?.lastSocketEsMessageAt || 0) > 0 && sttNow - connectProgress.lastSocketEsMessageAt < 4500;
  const sttWinner =
    enConfidence !== null && esConfidence !== null
      ? enConfidence >= esConfidence ? 'en' : 'es'
      : enConfidence !== null ? 'en' : esConfidence !== null ? 'es' : null;
  const sttPipelineSteps = [
    { key: 'heard', label: 'In', title: 'Sound heard by app', at: lastAudioChunkAt },
    { key: 'sent', label: 'API', title: 'Sound sent to Deepgram', at: lastAudioChunkAt },
    { key: 'dgmsg', label: 'DG', title: 'Deepgram answered', at: connectProgress?.lastDeepgramMessageAt || 0 },
    { key: 'text', label: 'Text', title: 'Deepgram returned text', at: connectProgress?.lastTranscriptStringAt || 0 },
    { key: 'commit', label: 'UI', title: 'Text committed to UI', at: connectProgress?.lastCaptionCommitAt || 0 },
  ];

  /** One word count per silence-to-silence turn — show only on the last bubble of that turn. */
  const turnDisplayMeta = useMemo(() => {
    const lastIndexByTurn = {};
    const maxCountByTurn = {};
    captions.forEach((cap, i) => {
      const tid = cap.turnId || `solo-${cap.id}`;
      lastIndexByTurn[tid] = i;
      const tc = cap.turnWordCount ?? 0;
      if (tc > (maxCountByTurn[tid] ?? 0)) maxCountByTurn[tid] = tc;
    });
    return { lastIndexByTurn, maxCountByTurn };
  }, [captions]);

  const togglePin = (cap) => {
    setPinnedCaptions((prev) => togglePinEntry(prev, cap));
  };

  const bumpManualRetranslate = (cap) => {
    const capId = cap?.id;
    if (!capId) return;
    setTranslationBumps((prev) => ({
      ...prev,
      [capId]: (prev[capId] || 0) + 1,
    }));
  };

  useEffect(() => {
    const lastCap = captions[captions.length - 1];
    const count = captions.length;
    const lastId = lastCap?.id || '';
    const isFinal = lastCap?.isFinal !== false;
    const scrollKey = `${count}|${lastId}|${isFinal ? 'final' : 'live'}`;

    const prev = lastScrollKeyRef.current;
    const [prevCountStr, prevId, prevFinalFlag] = prev.split('|');
    const prevCount = parseInt(prevCountStr || '0', 10);
    const countIncreased = count > prevCount;
    const becameFinal = prevFinalFlag === 'live' && isFinal && prevId === lastId;

    if (!isScrolledUpRef.current && (countIncreased || becameFinal)) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
    lastScrollKeyRef.current = scrollKey;

  }, [captions]);

  const resetScrollTimer = () => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrolledUpRef.current = false;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 15000); 
  };

  const handleScroll = () => {
    if (!scrollAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight <= 35;
    if (isAtBottom) {
      isScrolledUpRef.current = false;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    } else {
      isScrolledUpRef.current = true;
      resetScrollTimer();
    }
  };

  const handleWheel = (e) => {
    if (e.deltaY < 0) {
      isScrolledUpRef.current = true;
      resetScrollTimer();
    }
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      if (popoverTimerRef.current) clearTimeout(popoverTimerRef.current);
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (text && text.length < 50) {
        popoverTimerRef.current = setTimeout(() => {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setPopover({ show: true, x: rect.left + window.scrollX, y: rect.top + window.scrollY - 40, text });
        }, 800);
      } else {
        if (popover.show) setPopover(p => ({ ...p, show: false }));
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (popoverTimerRef.current) clearTimeout(popoverTimerRef.current);
    };
  }, [popover.show]);

  const handleLookup = (text) => {
    const url = `https://www.linguee.com/english-spanish/search?source=auto&query=${encodeURIComponent(text)}`;
    window.open(url, 'LingueeLookup', 'width=800,height=600,scrollbars=yes');
    setPopover(p => ({ ...p, show: false }));
  };

  return (
    <div className="transcription-area" style={{ 
      position: 'relative', background: 'var(--panel-bg)', border: '1px solid #18181b', borderRadius: 0,
      display: 'flex', flexDirection: 'column', height: '100%'
    }}>
      {popover.show && (
        <div style={{
          position: 'fixed', top: popover.y, left: popover.x, zIndex: 10000,
          background: 'var(--accent-primary)', color: '#000', padding: '4px 10px',
          borderRadius: 0, fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer'
        }} onClick={() => handleLookup(popover.text)}>
          LOOKUP: "{popover.text}"
        </div>
      )}

      {isZombieCall && connectionState !== 'connected' && (
        <div 
          onClick={onReconnect}
          className="zombie-reattach-banner"
          style={{
            position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 1001,
            background: '#f59e0b', color: '#000', padding: '0.8rem',
            borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '0.2rem', cursor: 'pointer', fontWeight: 900, fontSize: '0.9rem',
            border: '2px solid #000', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            animation: 'pulseGlow 2s infinite'
          }}
        >
          <div style={{ fontSize: '1.2rem' }}>🟡 AUDIO DISCONNECTED — CALL STILL ACTIVE</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.9, textAlign: 'center', maxWidth: '36rem' }}>
            Click here or press the yellow 🟡 button above. Transcript and call timer are preserved — no need to Stop.
          </div>
          <div style={{ fontSize: '0.65rem', opacity: 0.85, textAlign: 'center' }}>
            {ioRouteHint} · STT: {connectionState === 'connected' ? 'disconnected (re-attach tab)' : connectionState}
          </div>
          <div style={{ fontSize: '0.7rem', marginTop: '4px', textDecoration: 'underline' }}>[RE-ATTACH AUDIO]</div>
        </div>
      )}

      {/* Post-Call Summary Toast */}
      {(!isActive && lastCallSummary) && (
        <div style={{
          position: 'absolute', top: '8px', left: '8px', right: '8px', zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '6px', padding: '0.5rem 0.7rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📋 LAST CALL SUMMARY · {lastCallSummary.timestamp}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
              {lastCallSummary.numbers.length > 0 && (
                <span>🔢 {lastCallSummary.numbers.join(', ')}</span>
              )}
              {lastCallSummary.dollars.length > 0 && (
                <span style={{ color: '#fcd34d' }}>💰 {lastCallSummary.dollars.join(', ')}</span>
              )}
              {lastCallSummary.numbers.length === 0 && lastCallSummary.dollars.length === 0 && (
                <span style={{ opacity: 0.5 }}>No key data extracted</span>
              )}
            </div>
          </div>
          <button onClick={() => setLastCallSummary(null)} type="button" aria-label="Dismiss call summary" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }} title="Dismiss">✕</button>
        </div>
      )}

      <div 
        className="scroll-area"
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }} 
        onScroll={handleScroll}
        onWheel={handleWheel}
        ref={scrollAreaRef}
      >
        {pinnedCaptions.length > 0 && (
          <div className="pinned-transcript-section" style={{
            flexShrink: 0,
            marginBottom: '0.5rem',
            paddingBottom: '0.4rem',
            borderBottom: '1px solid rgba(34, 197, 94, 0.35)',
          }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--accent-primary)', marginBottom: '0.35rem', letterSpacing: '0.06em' }}>
              📌 PINNED ({pinnedCaptions.length})
            </div>
            {pinnedCaptions.map((cap) => (
              <div key={`pin-${cap.id}`} className="transcript-bubble pinned-transcript-bubble" style={{
                marginTop: '0.35rem',
                border: '1px solid var(--accent-primary)',
                background: 'rgba(34, 197, 94, 0.1)',
                ...getBubbleStyle(cap.text, true, cap.lang, languagePair),
              }}>
                <MemoTranslatedBubble
                  id={cap.id}
                  text={cap.text}
                  lang={cap.lang}
                  playTTS={playTTS}
                  stopTTS={stopTTS}
                  playingUrl={playingUrl}
                  prefetchTTS={prefetchTTS}
                  reverse={shouldReverseBubble(cap.lang, languagePair)}
                  ttsMode={ttsMode}
                  wordCount={cap.text.trim().split(/\s+/).length}
                  shouldPrefetch={false}
                  isPinned={true}
                  onTogglePin={() => togglePin(cap)}
                  forceTranslateKey={translationBumps[cap.id] ?? 0}
                  onManualRetranslate={() => bumpManualRetranslate(cap)}
                  languagePair={languagePair}
                  protectionsActive={protectionsActive}
                  mockTranslation={cap._devMockTranslation}
                  userCorrected={Boolean(cap.userCorrected)}
                  userTranslationOverride={cap.userTranslationOverride || null}
                  persistedTranslations={cap.translations || null}
                  onPersistTranslation={persistCaptionTranslation}
                  canEdit={cap.isFinal !== false}
                  correctionsRev={correctionsRev}
                  wordConfidence={cap.wordConfidence || null}
                  {...makeEditHandlers(cap)}
                />
                <button
                  type="button"
                  className="bubble-pin-btn is-pinned"
                  onClick={() => togglePin(cap)}
                  title="Unpin message"
                  aria-label="Unpin message"
                >
                  📌
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: '1 1 auto' }} />

        {captions.length === 0 && pinnedCaptions.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isZombieCall ? 0.85 : 1 }}>
            {isZombieCall && connectionState !== 'connected' ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', textAlign: 'center', padding: '0 1rem', color: '#fbbf24' }}>
                Re-attach audio — your timer and transcript are saved. Press the green Re-attach button.
              </div>
            ) : showOffCallGuide && !newcomerSessionHidden && !isNewcomerGuideDismissed() ? (
              <NewcomerIdleGuide
                audioAttached={audioAttached}
                micTestMode={micTestMode}
                connectionState={connectionState}
                isActive={isActive}
                onHideSession={() => setNewcomerSessionHidden(true)}
              />
            ) : null}
          </div>
        )}

        {captions.map((cap, i) => {
          if (!cap.text || !cap.text.trim()) {
            if (cap.id) {
              flagVanish('ui_blank_caption_skipped', {
                id: cap.id,
                turnId: cap.turnId,
                before: '(row present)',
                after: '',
                derender: true,
                force: true,
                stage: 'TranscriptionBoard.map',
                extra: { note: 'row exists but text empty — not rendered' },
              });
            }
            return null;
          }
          const isSameAsPrevious = i > 0 && captions[i-1].lang === cap.lang;
          const wordCount = cap.text.trim().split(/\s+/).length;
          const tid = cap.turnId || `solo-${cap.id}`;
          const turnWordCount = turnDisplayMeta.maxCountByTurn[tid] ?? cap.turnWordCount ?? 0;
          const showTurnWordCount = i === turnDisplayMeta.lastIndexByTurn[tid];
          if (isCaptionPinned(pinnedCaptions, cap)) return null;
          // UI_SPLIT_HEURISTIC:
          // This is the current UI-only signal we use to trigger the "flow/move" look.
          // IMPORTANT: The real algorithm-selected moved text section happens inside
          // `useDeepgram.js` (see `ALGO_MOVED_SECTION` comment), and this heuristic may
          // differ. Blue should be attached to ONLY the moved section substring.
          const isSplitContinuation = isSameAsPrevious && wordCount < 50;
          const isLive = cap.isFinal === false;
          const isLongBubble = wordCount > 50 && !isLive;
          const isExpanded = expandedIds.has(cap.id);
          const bubbleStyle = getBubbleStyle(cap.text, isLive, cap.lang, languagePair);
          const stableMinHeight = isLive
            ? liveBubbleHeightsRef.current.get(cap.id)?.height
            : null;
          const textLen = (cap.text || '').length;

          return (
            <div
              ref={(node) =>
                isLive ? rememberLiveBubbleHeight(cap.id, node, textLen) : undefined
              }
              key={captionRenderKeys[i]}
              className={`transcript-bubble${isLive ? ' is-live' : ' is-sealed'}${isSplitContinuation ? ' is-flowed' : ''}${cap.userCorrected || cap.userTranslationOverride ? ' is-user-corrected' : ''}`}
              style={{
              marginTop: isSplitContinuation ? '0rem' : '0.25rem',
              border: '1px solid transparent',
              background: bubbleStyle.backgroundColor,
              minHeight: isLive && stableMinHeight ? `${stableMinHeight}px` : undefined,
              ...bubbleStyle
            }}>
              
              <div style={{ maxHeight: isLongBubble && !isExpanded ? '5.5rem' : 'none', overflow: isLongBubble && !isExpanded ? 'hidden' : 'visible', transition: 'max-height 0.3s ease' }}>
                <MemoTranslatedBubble 
                  id={cap.id} text={cap.text} lang={cap.lang} playTTS={playTTS} stopTTS={stopTTS} playingUrl={playingUrl} prefetchTTS={prefetchTTS} 
                  reverse={shouldReverseBubble(cap.lang, languagePair)} ttsMode={ttsMode} turnWordCount={turnWordCount} showTurnWordCount={showTurnWordCount} shouldPrefetch={i >= captions.length - 3} 
                  isPinned={false} onTogglePin={() => togglePin(cap)}
                  forceTranslateKey={translationBumps[cap.id] ?? 0}
                  onManualRetranslate={() => bumpManualRetranslate(cap)}
                  tailPreviewText={null}
                  isFinal={cap.isFinal !== false}
                  allowAutoRetranslate={i >= captions.length - 2}
                  languagePair={languagePair}
                  protectionsActive={protectionsActive}
                  mockTranslation={cap._devMockTranslation}
                  userCorrected={Boolean(cap.userCorrected)}
                  userTranslationOverride={cap.userTranslationOverride || null}
                  continuityKey={captionRenderKeys[i]}
                  persistedTranslations={cap.translations || null}
                  onPersistTranslation={persistCaptionTranslation}
                  canEdit={!isLive}
                  correctionsRev={correctionsRev}
                  wordConfidence={cap.wordConfidence || null}
                  {...makeEditHandlers(cap)}
                />
              </div>
              
              {isLongBubble && (
                <button className="bubble-expand-btn" onClick={() => toggleExpand(cap.id)}>
                  {isExpanded ? '▲ collapse' : `··· ${wordCount} words ···`}
                </button>
              )}
              
              <button
                type="button"
                className="bubble-pin-btn"
                onClick={() => togglePin(cap)}
                title="Pin message (keeps it visible at top for voicemail / callouts)"
                aria-label="Pin message"
              >
                📍
              </button>
            </div>
          );
        })}
        <div id="scroll-bottom-anchor" ref={bottomRef} style={{ height: '22px', flexShrink: 0, pointerEvents: 'none' }} />
      </div>

      {showSttSoundbar && (
        <div className={`stt-process-rail stt-process-rail--bottom${audioHot ? ' is-audio-hot' : ''}`} aria-live="polite">
          <div className="stt-sound-wave" title={audioHot ? 'Audio chunks are reaching the app and being sent to Deepgram' : 'Waiting for speech'}>
            {Array.from({ length: 14 }).map((_, i) => <span key={i} style={{ '--bar-i': i }} />)}
          </div>
          {sttPipelineSteps.map((step) => (
            <span
              key={step.key}
              className={`stt-process-step${step.at ? ' is-done' : ' is-waiting'}`}
              title={step.at ? `${step.title || step.label}: ${sttNow - step.at}ms ago` : `${step.title || step.label}: waiting`}
            >
              <span className="stt-process-dot" />
              {step.label}
            </span>
          ))}
          <span
            className={`stt-lane stt-lane--en${enRecent ? ' is-recent' : ''}${sttWinner === 'en' ? ' is-winner' : ''}`}
            title={connectProgress?.lastSocketEnHadText ? 'EN socket returned text' : 'EN socket returned no text'}
          >
            EN {enConfidence === null ? '--' : `${Math.round(enConfidence * 100)}%`}
          </span>
          <span
            className={`stt-lane stt-lane--es${esRecent ? ' is-recent' : ''}${sttWinner === 'es' ? ' is-winner' : ''}`}
            title={connectProgress?.lastSocketEsHadText ? 'ES socket returned text' : 'ES socket returned no text'}
          >
            ES {esConfidence === null ? '--' : `${Math.round(esConfidence * 100)}%`}
          </span>
          <span className="stt-process-confidence">
            w{connectProgress?.lastWordConfidenceCount || 0}
          </span>
        </div>
      )}

      <BubbleCorrectionEditor
        open={Boolean(correctionEditor)}
        field={correctionEditor?.field || 'source'}
        draft={correctionEditor?.draft || ''}
        sourceLang={correctionEditor?.sourceLang || 'en'}
        targetLang={correctionEditor?.targetLang}
        onDraftChange={(v) => setCorrectionEditor((prev) => (prev ? { ...prev, draft: v } : prev))}
        onSave={handleCorrectionSave}
        onCancel={closeCorrectionEditor}
      />

      {/* Simplified Footer Toolbar */}
      <div className="transcription-footer" data-guide="pin" style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px',
        borderTop: '1px solid #18181b', background: 'var(--panel-bg)', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.65rem'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            className="transcript-audio-safe"
            title="Transcript audio is manual only. Messages never auto-play."
          >
            Audio: manual
          </span>
          {pinnedCaptions.length > 0 && (
            <button
              type="button"
              onClick={handleCopyPinned}
              style={{ background: 'transparent', color: '#34d399', border: 'none', cursor: 'pointer' }}
              title={`Copy ${pinnedCaptions.length} pinned message(s) to clipboard`}
              aria-label={`Copy ${pinnedCaptions.length} pinned messages`}
            >
              📋 COPY_PINNED({pinnedCaptions.length})
            </button>
          )}
          {footerStatus && (
            <span className="transcription-footer-status" role="status" aria-live="polite">
              {footerStatus}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleClearLog}
            aria-label="Clear transcript log"
            title="Clear transcript (pinned messages kept)"
            style={{ background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Clear log
          </button>
          <button
            type="button"
            onClick={stopTTS}
            disabled={!isPlaying}
            aria-label="Stop AI voice playback"
            title="Stop text-to-speech"
            style={{ background: 'transparent', color: isPlaying ? 'var(--danger)' : '#333', border: 'none', cursor: isPlaying ? 'pointer' : 'default' }}
          >
            Stop voice
          </button>
        </div>
      </div>
    </div>
  );
};
