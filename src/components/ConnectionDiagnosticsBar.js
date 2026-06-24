import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FAILURE } from '../utils/deepgramDiagnostics';

const mk = (done, active, failed) => {
  if (failed) return { mark: '✗', color: '#ef4444' };
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
  const isConnecting = connectionState === 'connecting' || s.phase === 'connecting';
  const isError = connectionState === 'error' || s.phase === 'error';
  const hasFailureDetailsText = !!(connectionMessage || s.lastError);

  const pinnedRef = useRef(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    // Close when we return to ready/idle: no connecting/error + no failure text.
    const shouldStayVisible = isConnecting || isError;
    if (!shouldStayVisible) {
      pinnedRef.current = false;
      setDetailsOpen(false);
    }
  }, [isConnecting, isError]);

  const catLabel = useMemo(() => {
    const cat = s.failureCategory;
    return cat ? CATEGORY_LABEL[cat] || cat : null;
  }, [s.failureCategory]);

  const shouldShowAnything = isConnecting || isError || hasFailureDetailsText;
  if (!shouldShowAnything) return null;

  const step1 = !!s.keyResolved;
  const step2a = s.socketEn === 'open';
  const step2b = s.socketEs === 'open';
  const step3 = !!s.audioStreamReady;
  const step4 = !!s.audioChunksSent;
  const step5 = !!s.transcriptReceived;
  const failed = isError;

  const socketOk = step2a || step2b;
  const isFailureLike = isError || hasFailureDetailsText;
  const markForChip = isFailureLike
    ? { mark: '×', color: '#ef4444' }
    : isConnecting
      ? { mark: '→', color: '#f59e0b' }
      : { mark: '•', color: 'rgba(255,255,255,0.35)' };
  const chipMainLabel = isFailureLike ? (compact ? 'Conn failed' : 'Connection failed') : 'Connecting…';
  const chipStateClass = isFailureLike ? ' is-failed' : isConnecting ? ' is-connecting' : '';
  const showInlineChecks = compact && (isError || hasFailureDetailsText);

  const openDetails = (pinned) => {
    if (pinned) pinnedRef.current = true;
    setDetailsOpen(true);
  };
  const closeDetailsIfUnpinned = () => {
    if (!pinnedRef.current) setDetailsOpen(false);
  };

  const rows = [
    {
      label: `API key (${s.keySource || '?'} ${s.keyMasked || ''})`.trim(),
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


  const detailsTitle = failed ? 'Connection failed' : 'Connecting to Deepgram…';
  const detailsTitleWithCat = catLabel ? `${detailsTitle} [${catLabel}]` : detailsTitle;

  return (
    <div className="connection-diagnostics-wrap">
      <button
        type="button"
        className={`connection-diagnostics-chip${compact ? ' is-compact' : ''}${chipStateClass}`}
        title={detailsTitleWithCat}
        aria-expanded={detailsOpen}
        aria-label={detailsTitleWithCat}
        onClick={() => openDetails(true)} // click/tap pins the popover
        onMouseEnter={() => openDetails(false)}
        onMouseLeave={closeDetailsIfUnpinned}
        onFocus={() => openDetails(false)}
        onBlur={closeDetailsIfUnpinned}
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

      {detailsOpen && (
        <div
          className={`connection-diagnostics-details${compact ? ' is-compact' : ''}${failed ? ' is-failed' : ''}`}
          role="tooltip"
          aria-label={detailsTitleWithCat}
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
      )}
    </div>
  );
};
