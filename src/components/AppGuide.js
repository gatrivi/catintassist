import React, { useCallback, useEffect, useState } from 'react';
import { isAppGuideDone, markAppGuideDone } from '../utils/appGuideStorage';

const GUIDE_STEPS = [
  {
    target: null,
    title: 'Welcome to CatIntAssist',
    body: 'A real-time interpreter cockpit: live transcription, side-by-side translation, and a gamified earnings HUD. This tour takes ~60 seconds.',
  },
  {
    target: '[data-guide="connect"]',
    title: '1 · Connect to the call tab',
    body: 'Press the green button. Pick the browser tab with your interpreter line and allow audio. The stream stays attached between calls so you rarely re-prompt.',
  },
  {
    target: '[data-guide="transcript"]',
    title: '2 · Live transcript + translation',
    body: 'White text = what was said. Gray italic = translation. English stays left, Spanish stays right (auto-flips). Bubbles split at sentence endings (. ! ?).',
  },
  {
    target: '[data-guide="bubble-rail"]',
    title: '3 · Bubble rail (center)',
    body: 'Three bars = translate → process → ready. Number = words in this speaking turn (one count per pause; orange at 34, red at 40). Triangle = play translation audio.',
  },
  {
    target: '[data-guide="stop"]',
    title: '4 · End the call',
    body: 'Red stop is always in the sticky top bar. Banks minutes and earnings to your daily scoreboard. Use ⚡ Zap if audio stalls without hanging up.',
  },
  {
    target: '[data-guide="notes"]',
    title: '5 · Quick notes',
    body: 'Opens the notes panel (works during calls). Jot names, numbers, and terms — auto-saves. Bottom dock is shifted left for Chrome split-pane.',
  },
  {
    target: '[data-guide="pin"]',
    title: '6 · Pin important lines',
    body: 'Click 📍 on any bubble to pin voicemail or callouts to the top. Pins survive CLEAR LOG. Use COPY_PINNED in the footer to export.',
  },
  {
    target: '[data-guide="scoreboard"]',
    title: '7 · Scoreboard & goals',
    body: 'Track minutes, AR$ bounty, breaks, and pace. Tap 🎯 weekly goal pill for the commitment wheel. Vignette color = call / break / idle.',
  },
  {
    target: null,
    title: '8 · Power tips & demo mode',
    body: 'Space = force EN/ES detect (30s). Highlight text → Linguee lookup. Shift+D cycles demo scenarios (connect, goal, break, reset). Version tag top-right confirms your build.',
  },
];

const AppGuideOverlay = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState(null);

  const disableOnboardingAnimations = (() => {
    try {
      return localStorage.getItem('catint_onboarding_anim_disabled_v1') === '1';
    } catch {
      return false;
    }
  })();

  const current = GUIDE_STEPS[step];
  const isLast = step >= GUIDE_STEPS.length - 1;

  const measureTarget = useCallback(() => {
    if (!current?.target) {
      setSpot(null);
      return;
    }
    const el = document.querySelector(current.target);
    if (!el) {
      setSpot(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 6;
    setSpot({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }, [current]);

  useEffect(() => {
    measureTarget();
    const onLayout = () => measureTarget();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    const t = setTimeout(measureTarget, 80);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
      clearTimeout(t);
    };
  }, [step, measureTarget]);

  const finishGuide = () => {
    markAppGuideDone();
    onClose();
  };

  const goNext = () => {
    if (isLast) {
      finishGuide();
      return;
    }
    setStep((s) => s + 1);
  };

  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  const cardStyle = spot
    ? {
        top: Math.min(spot.top + spot.height + 12, window.innerHeight - 200),
        left: Math.max(12, Math.min(spot.left, window.innerWidth - 320)),
        maxWidth: 'min(300px, calc(100vw - 24px))',
      }
    : {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 'min(340px, calc(100vw - 32px))',
      };

  return (
    <div className="app-guide-root" role="dialog" aria-modal="true" aria-label="App guide">
      <button type="button" className="app-guide-backdrop" onClick={finishGuide} aria-label="Close guide" />
      {spot && (
        <div
          className="app-guide-spotlight"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            animation: disableOnboardingAnimations ? 'none' : undefined,
          }}
        />
      )}
      <div className="app-guide-card" style={cardStyle}>
        <div className="app-guide-progress">
          {GUIDE_STEPS.map((_, i) => (
            <span key={i} className={`app-guide-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>
        <h2 className="app-guide-title">{current.title}</h2>
        <p className="app-guide-body">{current.body}</p>
        <div className="app-guide-actions">
          <button type="button" className="app-guide-btn ghost" onClick={finishGuide}>Skip</button>
          {step > 0 && (
            <button type="button" className="app-guide-btn ghost" onClick={goPrev}>Back</button>
          )}
          <button type="button" className="app-guide-btn primary" onClick={goNext}>
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Help control for scoreboard / header (not the transcript footer). */
export const AppGuideButton = ({ autoOpenIfNew = false }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (autoOpenIfNew && !isAppGuideDone()) {
      setOpen(true);
    }
  }, [autoOpenIfNew]);

  return (
    <>
      <button
        type="button"
        className="app-guide-scoreboard-btn"
        onClick={() => setOpen(true)}
        title="How to use & test CatIntAssist"
        aria-label="Open app guide"
      >
        ?
      </button>
      {open && <AppGuideOverlay onClose={() => setOpen(false)} />}
    </>
  );
};
