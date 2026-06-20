import React from 'react';
import { dismissNewcomerGuidePermanent } from '../utils/newcomerGuide';

/**
 * Plain-language onboarding when the transcript area is empty.
 * Props drive which step is highlighted.
 */
export const NewcomerIdleGuide = ({
  audioAttached = false,
  micTestMode = false,
  connectionState = 'disconnected',
  isActive = false,
  onHideSession,
}) => {
  const step = isActive ? 3 : audioAttached ? 2 : 1;
  const connecting = connectionState === 'connecting';

  const stepStyle = (n) => ({
    padding: '0.5rem 0.65rem',
    borderRadius: 6,
    border: step === n ? '1px solid rgba(16,185,129,0.55)' : '1px solid rgba(255,255,255,0.08)',
    background: step === n ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
    fontSize: '0.78rem',
    lineHeight: 1.45,
    color: step === n ? '#e2e8f0' : 'rgba(255,255,255,0.55)',
  });

  const dismissBtn = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    color: 'rgba(255,255,255,0.65)',
    cursor: 'pointer',
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '0.2rem 0.45rem',
  };

  return (
    <div
      style={{
        maxWidth: '28rem',
        margin: '0 auto',
        padding: '1rem 1.25rem',
        textAlign: 'left',
        fontFamily: 'var(--font-mono, monospace)',
        position: 'relative',
      }}
    >
      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', marginBottom: '0.35rem' }}>
        Welcome to CatIntAssist
      </div>
      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
        The cat&apos;s interpreter assistant.
        <br />
        Currently: <span style={{ color: '#93c5fd' }}>English</span>
        {' '}&rarr;{' '}
        <span style={{ color: '#6ee7b7' }}>Spanish</span>
        <br />
        <span style={{ opacity: 0.7 }}>More languages coming soon.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <div style={stepStyle(1)}>
          <strong>Step 1 — Connect</strong>
          <br />
          Press the green button above. It says{' '}
          <em>&quot;Click to connect tab&quot;</em>.
          <br />
          Pick the browser tab where the conversation is happening. Check{' '}
          <strong>Share audio</strong> if the browser asks.
        </div>

        <div style={stepStyle(2)}>
          <strong>Step 2 — Start interpreting</strong>
          <br />
          When the tab is connected, press the green button once more. It will say{' '}
          <em>&quot;Start interpreting&quot;</em>.
          {connecting && (
            <span style={{ display: 'block', marginTop: 4, color: '#fbbf24' }}>
              Connecting now…
            </span>
          )}
        </div>

        <div style={stepStyle(3)}>
          <strong>Step 3 — Stop when done</strong>
          <br />
          Press the red stop button when the call ends.
        </div>
      </div>

      <div
        style={{
          marginTop: '0.85rem',
          padding: '0.5rem 0.65rem',
          borderRadius: 6,
          border: micTestMode ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.06)',
          background: micTestMode ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.45,
        }}
      >
        <strong>On a phone or no tab to share?</strong> Tap the mic button, then the green button.
        Your microphone will listen instead of another tab.
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        {onHideSession && (
          <button type="button" style={dismissBtn} onClick={onHideSession}>
            Hide
          </button>
        )}
        <button
          type="button"
          style={{ ...dismissBtn, borderColor: 'rgba(148,163,184,0.35)' }}
          onClick={() => {
            dismissNewcomerGuidePermanent();
            onHideSession?.();
          }}
        >
          Don&apos;t show again
        </button>
      </div>
    </div>
  );
};
