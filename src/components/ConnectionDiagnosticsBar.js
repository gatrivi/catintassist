import React, { useEffect, useMemo, useState } from 'react';
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

/** Step-by-step Deepgram connect diagnostics — always visible when connecting or error. */
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

  // If the app is not actively connecting and not in an error state, we must not
  // keep the full diagnostics expanded.
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (!isConnecting && !isError) setDetailsOpen(false);
  }, [isConnecting, isError]);

  const failureHeadline = useMemo(() => {
    if (!isError) return 'Connection failed';
    return 'Connection failed';
  }, [isError]);

  const catLabel = useMemo(() => {
    const cat = s.failureCategory;
    return cat ? CATEGORY_LABEL[cat] || cat : null;
  }, [s.failureCategory]);

  // Render decision:
  // - connecting: show the full compact diagnostics card
  // - error + not user-opened: show a small chip
  // - user-opened: show full bounded details
  const shouldShowChip = !detailsOpen && isError;
  const shouldShowStaleChip = !detailsOpen && !isConnecting && !isError && hasFailureDetailsText;

  const shouldShowDetails =
    detailsOpen &&
    // When open, show details only if the bar still has something meaningful to show.
    (isError || isConnecting || hasFailureDetailsText);

  const shouldShowAnything = isConnecting || isError || hasFailureDetailsText;

  if (!shouldShowAnything) return null;

  const step1 = !!s.keyResolved;
  const step2a = s.socketEn === 'open';
  const step2b = s.socketEs === 'open';
  const step3 = !!s.audioStreamReady;
  const step4 = !!s.audioChunksSent;
  const step5 = !!s.transcriptReceived;
  const failed = isError;

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
  // Collapsed failure chip:
  // - prevents the full card from staying open and covering transcription
  // - full details open only after user taps "Details"
  if (shouldShowChip || shouldShowStaleChip) {
    const title = catLabel ? `Connection failed [${catLabel}]` : 'Connection failed';
    return (
      <button
        type="button"
        className={`connection-diagnostics-chip${compact ? ' is-compact' : ''}`}
        title={title}
        onClick={() => setDetailsOpen(true)}
      >
        <span className="connection-diagnostics-chip-main">Connection failed</span>
        <span className="connection-diagnostics-chip-details">· Details</span>
      </button>
    );
  }

  if (!shouldShowDetails && !isConnecting) {
    // No active connection UI and details aren't open.
    return null;
  }

  return (
    <div
      className={`connection-diagnostics-details${compact ? ' is-compact' : ''}${detailsOpen ? ' is-open' : ''}`}
      style={{
        marginTop: compact ? 0 : '0.25rem',
        padding: compact ? '0.35rem 0.5rem' : '0.45rem 0.6rem',
        borderRadius: 10,
        background: failed ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)',
        border: `1px solid ${failed ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.25)'}`,
        fontSize: compact ? '0.62rem' : '0.68rem',
        lineHeight: 1.35,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 900, color: failed ? '#fca5a5' : '#fcd34d', marginBottom: 4 }}>
          {failed ? failureHeadline : 'Connecting to Deepgram…'}
          {catLabel && (
            <span style={{ marginLeft: 6, color: '#f87171', fontWeight: 800 }}>
              [{catLabel}]
            </span>
          )}
        </div>
        {detailsOpen && (
          <button
            type="button"
            className="connection-diagnostics-close-btn"
            onClick={() => setDetailsOpen(false)}
            aria-label="Hide diagnostics details"
            title="Hide diagnostics"
          >
            ×
          </button>
        )}
      </div>
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
          <span style={{ color: row.color, fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>
            {row.mark}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.85)' }}>{row.label}</span>
        </div>
      ))}
      {(connectionMessage || s.lastError) && (
        <div
          style={{
            marginTop: 6,
            paddingTop: 4,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            color: failed ? '#fecaca' : 'rgba(255,255,255,0.7)',
            fontSize: '0.62rem',
          }}
        >
          {connectionMessage || s.lastError}
          {s.lastCloseCode != null && (
            <span style={{ display: 'block', opacity: 0.75, marginTop: 2 }}>
              WS close {s.lastCloseCode}
              {s.lastCloseReason ? `: ${s.lastCloseReason}` : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
