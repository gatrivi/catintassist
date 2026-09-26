import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FAILURE } from '../utils/deepgramDiagnostics';
import { getDeepgramKeyInfo } from '../utils/deepgramRuntimeKey';
import { isSocketHealthy } from '../utils/dgStatus';
import { isConnectedButSilent } from '../utils/connectEvidence';

const mk = (done, active, failed) => {
  // Important: failure must not look like "the whole app is useless".
  // Keep the meaning as "something failed, diagnostics available".
  if (failed) return { mark: '!', color: '#ef4444' };
  if (done) return { mark: '✓', color: '#34d399' };
  if (active) return { mark: '→', color: '#f59e0b' };
  return { mark: '•', color: 'rgba(255,255,255,0.35)' };
};

const CATEGORY_LABEL = {
  [FAILURE.AUTH]: 'API key / auth',
  [FAILURE.NETWORK]: 'Network / firewall',
  [FAILURE.AUDIO]: 'Audio stream',
  [FAILURE.TIMEOUT]: 'Timeout (no audio sent)',
  [FAILURE.QUOTA]: 'Quota / billing',
  [FAILURE.UNKNOWN]: 'Unknown',
};

/**
 * Deepgram connect diagnostics:
 * - Default is a single-line chip (never impacts header layout height).
 * - Full rows render only in an absolutely-positioned tooltip/popover on demand.
 */
export const ConnectionDiagnosticsBar = ({
  connectProgress,
  connectionState,
  connectionMessage,
  compact = false,
}) => {
  const s = connectProgress || {};
  const [, setKeyTick] = useState(0);
  useEffect(() => {
    const bump = () => setKeyTick((t) => t + 1);
    window.addEventListener('cat_deepgram_runtime_key_changed', bump);
    return () => window.removeEventListener('cat_deepgram_runtime_key_changed', bump);
  }, []);
  const liveKey = getDeepgramKeyInfo();
  const keyResolved = Boolean(liveKey.key);
  const keySource = liveKey.source || s.keySource || '?';
  const keyMasked = liveKey.masked || s.keyMasked || '';
  const isConnected = connectionState === 'connected';
  const isConnecting = !isConnected && (connectionState === 'connecting' || s.phase === 'connecting');
  const isError = !isConnected && connectionState === 'error';
  const hasFailureDetailsText = (isConnecting || isError) && !!(connectionMessage || s.lastError);

  const pinnedRef = useRef(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsPos, setDetailsPos] = useState({ left: 8, top: 40 });

  // v4.153.0: "connected" used to hide this bar entirely — which is exactly
  // when the worst bug lived (sockets open, recorder silent, no text at all).
  // A connection that never sent audio is NOT healthy and must be visible.
  const connectedSinceRef = useRef(0);
  const [silentWhileConnected, setSilentWhileConnected] = useState(false);
  useEffect(() => {
    if (isConnected) {
      if (!connectedSinceRef.current) connectedSinceRef.current = Date.now();
    } else {
      connectedSinceRef.current = 0;
      setSilentWhileConnected(false);
    }
  }, [isConnected]);
  useEffect(() => {
    const t = setInterval(() => {
      setSilentWhileConnected(
        isConnectedButSilent({
          connectionState,
          audioChunksSent: !!connectProgress?.audioChunksSent,
          connectedSince: connectedSinceRef.current,
        }),
      );
    }, 1000);
    return () => clearInterval(t);
  }, [isConnected, connectionState, connectProgress?.audioChunksSent]);

  useEffect(() => {
    // Close when we return to ready/idle: no connecting/error + no failure text.
    const shouldStayVisible = isConnecting || isError || silentWhileConnected;
    if (!shouldStayVisible) {
      pinnedRef.current = false;
      setDetailsOpen(false);
    }
  }, [isConnecting, isError, silentWhileConnected]);

  const catLabel = useMemo(() => {
    const cat = s.failureCategory;
    return cat ? CATEGORY_LABEL[cat] || cat : null;
  }, [s.failureCategory]);

  const shouldShowAnything =
    (silentWhileConnected || !isConnected) && (isConnecting || isError || hasFailureDetailsText || silentWhileConnected);
  if (!shouldShowAnything) return null;

  const step1 = keyResolved;
  // v4.148.0: 'skipped' (Multilingual single-socket) counts as open.
  const step2a = isSocketHealthy(s.socketEn);
  const step2b = isSocketHealthy(s.socketEs);
  const step3 = !!s.audioStreamReady;
  const step4 = !!s.audioChunksSent;
  const step5 = !!s.transcriptReceived;
  const failed = isError;

  const socketOk = step2a || step2b;
  const isFailureLike = isError;
  const markForChip = silentWhileConnected
    ? { mark: '!', color: '#f59e0b' }
    : isFailureLike
    ? { mark: '!', color: '#ef4444' }
    : isConnecting
      ? { mark: '>', color: '#f59e0b' }
      : { mark: '.', color: 'rgba(255,255,255,0.35)' };
  const chipMainLabel = silentWhileConnected
    ? (compact ? 'DG up, no audio' : 'Deepgram connected but no audio is flowing')
    : isFailureLike
    ? (compact ? 'Deepgram down' : 'Deepgram down: transcription unavailable')
    : hasFailureDetailsText
      ? (compact ? 'Deepgram check' : 'Deepgram check: details available')
      : 'Connecting...';
  const chipStateClass = silentWhileConnected
    ? ' is-connecting'
    : isFailureLike
      ? ' is-failed'
      : isConnecting
        ? ' is-connecting'
        : '';
  // In compact header mode the chip must never steal layout space.
  // Full step-by-step checks live only in the hover/focus/click tooltip.
  const showInlineChecks = false;

  const openDetails = (pinned, target) => {
    if (target?.getBoundingClientRect) {
      const rect = target.getBoundingClientRect();
      setDetailsPos({
        left: Math.min(Math.max(rect.left, 8), window.innerWidth - 336),
        top: Math.min(rect.bottom + 6, window.innerHeight - 120),
      });
    }
    if (pinned) pinnedRef.current = true;
    setDetailsOpen(true);
  };

  const rows = [
    {
      label: `API key (${keySource} ${keyMasked})`.trim(),
      ...mk(step1, !step1 && s.phase === 'connecting', failed && !step1),
    },
    {
      label: `EN socket${s.socketEnClose ? ` — ${s.socketEnClose}` : ''}`,
      ...mk(step2a, s.socketEn === 'connecting', s.socketEn === 'error'),
    },
    {
      label: `ES socket${s.socketEsClose ? ` — ${s.socketEsClose}` : ''}`,
      ...mk(step2b, s.socketEs === 'connecting', s.socketEs === 'error'),
    },
    {
      label: 'Audio stream attached',
      ...mk(step3, !step3 && step1, failed && !step3),
    },
    {
      label: 'Audio chunks sent to Deepgram',
      ...mk(step4, step3 && !step4, false),
    },
    {
      label: 'Transcript received',
      ...mk(step5, step4 && !step5, false),
    },
  ];


  const detailsTitle = silentWhileConnected
    ? 'Deepgram connected but no audio is flowing'
    : failed
    ? 'Deepgram failure: transcription unavailable'
    : 'Connecting to Deepgram…';
  const detailsTitleWithCat = catLabel ? `${detailsTitle} [${catLabel}]` : detailsTitle;

  let actionNow = null;
  if (silentWhileConnected) {
    // The nastiest one: looks connected, hears nothing.
    actionNow =
      'Sockets are open but no audio reached Deepgram. Check the tab still shares audio (or the mic is unmuted), then press CONNECT again (double-press re-picks the tab).';
  } else if (failed) {
    // Keep this brutally direct so you can get back to work fast.
    if (s.failureCategory === FAILURE.AUTH) {
      actionNow = 'Fix API key / auth: paste correct Deepgram key, then try again (Zap if stuck).';
    } else if (s.failureCategory === FAILURE.QUOTA) {
      actionNow = 'Fix quota/billing: verify plan quota is available, then try again (Zap if stuck).';
    } else if (s.failureCategory === FAILURE.NETWORK) {
      actionNow = 'Fix network/firewall: allow Deepgram WebSocket + outbound, then try again (Zap if stuck).';
    } else if (s.failureCategory === FAILURE.AUDIO) {
      actionNow = 'Fix audio stream: ensure tab audio is shared, mic perms OK, then try again (Zap if stuck).';
    } else if (s.failureCategory === FAILURE.TIMEOUT) {
      actionNow = 'Fix timeout: make sure audio is being sent (tab/mic), then try again (Zap if stuck).';
    } else {
      actionNow = 'Deepgram is not reachable right now: try Zap, then check API key, network, and audio permissions.';
    }
  }

  return (
    <div
      className="connection-diagnostics-wrap"
      onMouseLeave={() => {
        if (!pinnedRef.current) setDetailsOpen(false);
      }}
    >
      <button
        type="button"
        className={`connection-diagnostics-bar connection-diagnostics-chip${compact ? ' is-compact' : ''}${chipStateClass}`}
        aria-expanded={detailsOpen}
        aria-describedby={detailsOpen ? 'connection-diagnostics-details' : undefined}
        aria-label={detailsTitleWithCat}
        data-tooltip={`${detailsTitleWithCat}. Click for checks.`}
        onMouseEnter={(e) => openDetails(false, e.currentTarget)}
        onFocus={(e) => openDetails(false, e.currentTarget)}
        onClick={(e) => openDetails(true, e.currentTarget)}
      >
        <span className="connection-diagnostics-chip-main">
          <span className="connection-diagnostics-chip-mark" style={{ color: markForChip.color }}>
            {markForChip.mark}
          </span>
          <span className="connection-diagnostics-chip-label">{chipMainLabel}</span>
          {showInlineChecks && (
            <span className="connection-diagnostics-chip-checks">
              <span className={`connection-diagnostics-chip-check${step1 ? ' is-ok' : ''}`}>
                {step1 ? '✓' : '×'} key
              </span>
              <span className="connection-diagnostics-chip-check-sep">·</span>
              <span className={`connection-diagnostics-chip-check${socketOk ? ' is-ok' : ''}`}>
                {socketOk ? '✓' : '×'} socket
              </span>
            </span>
          )}
          <span className="connection-diagnostics-chip-details">· Details</span>
        </span>
      </button>

      {detailsOpen && createPortal((
        <div
          id="connection-diagnostics-details"
          className={`connection-diagnostics-details${compact ? ' is-compact' : ''}${failed ? ' is-failed' : ''}`}
          role="tooltip"
          aria-label={detailsTitleWithCat}
          style={{
            left: detailsPos.left,
            top: detailsPos.top,
          }}
          onMouseLeave={() => {
            if (!pinnedRef.current) setDetailsOpen(false);
          }}
        >
          <div className="connection-diagnostics-details-head">
            <div className="connection-diagnostics-details-head-title">
              {detailsTitle}
              {catLabel && <span className="connection-diagnostics-details-cat">[{catLabel}]</span>}
            </div>
            <button
              type="button"
              className="connection-diagnostics-close-btn"
              onClick={() => {
                pinnedRef.current = false;
                setDetailsOpen(false);
              }}
              aria-label="Hide diagnostics details"
              title="Hide diagnostics"
            >
              ×
            </button>
          </div>

          <div className="connection-diagnostics-details-rows">
            {rows.map((row) => (
              <div key={row.label} className="connection-diagnostics-details-row">
                <span className="connection-diagnostics-details-row-mark" style={{ color: row.color }}>
                  {row.mark}
                </span>
                <span className="connection-diagnostics-details-row-label">{row.label}</span>
              </div>
            ))}
          </div>

          {(failed || silentWhileConnected) && actionNow && (
            <div className="connection-diagnostics-details-action">
              <strong>Do this now:</strong> {actionNow}
            </div>
          )}

          {(connectionMessage || s.lastError) && (
            <div className="connection-diagnostics-details-error">
              {connectionMessage || s.lastError}
              {s.lastCloseCode != null && (
                <span className="connection-diagnostics-details-ws">
                  WS close {s.lastCloseCode}
                  {s.lastCloseReason ? `: ${s.lastCloseReason}` : ''}
                </span>
              )}
            </div>
          )}
        </div>
      ), document.body)}
    </div>
  );
};

