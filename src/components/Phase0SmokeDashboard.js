import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { APP_VERSION } from '../constants/version';
import {
  PHASE0_SMOKE_ITEMS,
  isPhase0SmokeEnabled,
  loadPhase0SmokeState,
  setPhase0SmokeItem,
  resetPhase0SmokeState,
  summarizePhase0Smoke,
  probePhase0LiveStack,
} from '../utils/phase0SmokeChecklist';

const btn = {
  padding: '3px 7px',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e2e8f0',
  cursor: 'pointer',
  fontSize: 10,
};

const statusColor = {
  pass: '#86efac',
  fail: '#fca5a5',
  skip: '#fcd34d',
  unchecked: 'rgba(255,255,255,0.35)',
};

/**
 * Phase 0 Smoke Dashboard — operator checklist + live stack probes.
 * Does not re-implement v4.81/v4.82 harnesses.
 */
export function Phase0SmokeDashboard() {
  const {
    isActive,
    isZombieCall,
    captions,
  } = useSession();
  const [state, setState] = useState(() => loadPhase0SmokeState());
  const [probe, setProbe] = useState(() => probePhase0LiveStack({}));
  const [expanded, setExpanded] = useState(null);

  const refresh = useCallback(() => {
    setState(loadPhase0SmokeState());
    setProbe(
      probePhase0LiveStack({
        isActive,
        isZombieCall,
        captions,
      }),
    );
  }, [isActive, isZombieCall, captions]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!isPhase0SmokeEnabled()) return null;

  const summary = summarizePhase0Smoke(state);

  const mark = (id, status) => {
    setState(setPhase0SmokeItem(id, status));
  };

  const reset = () => {
    if (!window.confirm('Reset all Phase 0 smoke marks?')) return;
    setState(resetPhase0SmokeState());
  };

  return (
    <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: '#fde68a' }}>
          Phase 0 Smoke · v{APP_VERSION}
        </div>
        <div style={{ fontSize: 10, color: summary.phase0Green ? '#86efac' : 'rgba(255,255,255,0.45)' }}>
          {summary.pass}/{summary.total} pass
          {summary.fail ? ` · ${summary.fail} fail` : ''}
          {summary.unchecked ? ` · ${summary.unchecked} open` : ''}
          {summary.phase0Green ? ' · GREEN' : ''}
        </div>
        <button type="button" style={btn} onClick={refresh}>
          Refresh probes
        </button>
        <button type="button" style={btn} onClick={reset}>
          Reset marks
        </button>
      </div>

      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px', lineHeight: 1.4 }}>
        Proves coded systems on the <strong style={{ color: '#e2e8f0' }}>real stack</strong>. Marks are
        operator-owned — probes never auto-pass. Use Test Harness /{' '}
        <code style={{ color: '#fcd34d' }}>npm run test:translation</code> as helpers, then smoke live.
      </p>

      {/* Live stack strip */}
      <div
        style={{
          fontSize: 10,
          lineHeight: 1.5,
          padding: 8,
          borderRadius: 6,
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 10,
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        <div style={{ color: '#93c5fd', marginBottom: 4 }}>Live stack</div>
        <div>
          DG key: {probe.deepgramKey ? 'yes' : 'NO'} · Paid translate:{' '}
          {probe.paidTranslate ? 'yes' : 'NO (free-tier risk)'} · Call:{' '}
          {probe.isActive ? 'active' : probe.isZombieCall ? 'REVENANT' : 'idle'}
        </div>
        <div>
          Captions: {probe.captionCount} · Finals: {probe.finalCount} · Sealed translations:{' '}
          {probe.sealedTranslationCount} · Splits: {probe.splitBubbleCount}
        </div>
        <div>
          Fake phone in finals: {probe.hasFakePhoneDigits ? 'yes' : 'no'} · STT msgs:{' '}
          {probe.deepgramMessages} · Trace: {probe.sttTraceLen}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PHASE0_SMOKE_ITEMS.map((item) => {
          const row = state.items[item.id] || { status: 'unchecked' };
          const open = expanded === item.id;
          return (
            <div
              key={item.id}
              style={{
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6,
                padding: 8,
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: statusColor[row.status] || statusColor.unchecked }}>
                  [{row.status}]
                </span>
                <button
                  type="button"
                  style={{
                    ...btn,
                    flex: 1,
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    color: '#e2e8f0',
                    fontSize: 11,
                    padding: 0,
                  }}
                  onClick={() => setExpanded(open ? null : item.id)}
                >
                  {item.label}
                  {item.coded ? ' · coded' : ''}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {['pass', 'fail', 'skip', 'unchecked'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={{
                      ...btn,
                      borderColor: row.status === s ? statusColor[s] : 'rgba(255,255,255,0.15)',
                      color: row.status === s ? statusColor[s] : '#e2e8f0',
                    }}
                    onClick={() => mark(item.id, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {open ? (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 8, lineHeight: 1.4 }}>
                  <div>{item.how}</div>
                  <div style={{ marginTop: 4 }}>Helper: {item.harnessHint}</div>
                  <div style={{ marginTop: 2, color: 'rgba(255,255,255,0.35)' }}>{item.docs}</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { isPhase0SmokeEnabled };
