import React, { useState, useEffect } from 'react';
import {
  dismissNewcomerGuidePermanent,
  isNewcomerGuideSnoozed,
  snoozeNewcomerGuide,
  unsnoozeNewcomerGuide,
} from '../utils/newcomerGuide';
import {
  loadLanguagePair,
  getLangLabel,
  LANG_PAIR_CHANGED_EVENT,
} from '../utils/languageConfig';
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
  const [snoozed, setSnoozed] = useState(() => isNewcomerGuideSnoozed());
  const [languagePair, setLanguagePair] = useState(loadLanguagePair);
  useEffect(() => {
    const onPairChange = (e) => setLanguagePair(e.detail || loadLanguagePair());
    window.addEventListener(LANG_PAIR_CHANGED_EVENT, onPairChange);
    return () => window.removeEventListener(LANG_PAIR_CHANGED_EVENT, onPairChange);
  }, []);
  const disableOnboardingAnimations = (() => {
    try {
      return localStorage.getItem('catint_onboarding_anim_disabled_v1') === '1';
    } catch {
      return false;
    }
  })();
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

  if (snoozed) {
    return (
      <div
        style={{
          maxWidth: '28rem',
          margin: '0 auto',
          padding: '0.75rem 1rem',
          textAlign: 'left',
          fontFamily: 'var(--font-mono, monospace)',
          position: 'relative',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          animation: disableOnboardingAnimations ? 'none' : 'fadeSlideIn 0.18s ease-out',
        }}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#e2e8f0' }}>
          Need help connecting?
        </div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', marginTop: 4, lineHeight: 1.4 }}>
          Onboarding is tucked away. Tap to show it again.
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            style={{ ...dismissBtn, borderColor: 'rgba(56,189,248,0.35)', color: '#93c5fd' }}
            onClick={() => {
              unsnoozeNewcomerGuide();
              setSnoozed(false);
            }}
          >
            Show onboarding
          </button>
          <button
            type="button"
            style={{ ...dismissBtn, borderColor: 'rgba(148,163,184,0.35)' }}
            onClick={() => {
              dismissNewcomerGuidePermanent();
              setSnoozed(false);
              onHideSession?.();
            }}
          >
            Don&apos;t show again
          </button>
        </div>
      </div>
    );
  }

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
        Currently: <span style={{ color: '#93c5fd' }}>{getLangLabel(languagePair.left)}</span>
        {' '}&rarr;{' '}
        <span style={{ color: '#6ee7b7' }}>{getLangLabel(languagePair.right)}</span>
        <br />
        <span style={{ opacity: 0.7 }}>Change pair in Settings → Language.</span>      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <div style={stepStyle(1)}>
          <strong>Step 1 — Connect &amp; start</strong>
          <br />
          Press the green button above. It says{' '}
          <em>&quot;Connect &amp; start&quot;</em>.
          <br />
          Pick the browser tab where the conversation is happening. Check{' '}
          <strong>Share audio</strong> if the browser asks — interpreting begins automatically.
        </div>

        <div style={stepStyle(2)}>
          <strong>Step 2 — Next call</strong>
          <br />
          After STOP, tab audio stays connected. Press the green button once to start the next call.
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
        <strong>On a phone or no tab to share?</strong> Turn on the 🎤 mic button (header, right side), then Connect.
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={{ ...dismissBtn, borderColor: 'rgba(16,185,129,0.45)', color: '#6ee7b7' }}
          onClick={() => {
            window.dispatchEvent(new CustomEvent('cat_open_app_guide'));
          }}
        >
          Take the tour / Ver guía
        </button>
        {onHideSession && (
          <button type="button" style={dismissBtn} onClick={onHideSession}>
            Hide
          </button>
        )}
        <button
          type="button"
          style={{ ...dismissBtn, borderColor: 'rgba(56,189,248,0.35)', color: '#93c5fd' }}
          onClick={() => {
            snoozeNewcomerGuide();
            setSnoozed(true);
          }}
        >
          Later
        </button>
        <button
          type="button"
          style={{ ...dismissBtn, borderColor: 'rgba(148,163,184,0.35)' }}
          onClick={() => {
            dismissNewcomerGuidePermanent();
            setSnoozed(false);
            onHideSession?.();
          }}
        >
          Don&apos;t show again
        </button>
      </div>
    </div>
  );
};
