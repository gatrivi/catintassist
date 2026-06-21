import React, { useCallback, useEffect, useState } from 'react';
import { HelpIcon } from './HeaderIcons';
import { isAppGuideDone, markAppGuideDone } from '../utils/appGuideStorage';
import { loadGuideLang, saveGuideLang } from '../utils/guideLangStorage';
import { getGuideSteps, GUIDE_UI } from '../content/appGuideContent';
import { useGuideHost } from '../contexts/GuideHostContext';

const AppGuideOverlay = ({ onClose, lang, onLangChange }) => {
  const { prepareGuideView } = useGuideHost();
  const steps = getGuideSteps(lang);
  const ui = GUIDE_UI[lang] || GUIDE_UI.en;
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState(null);

  const disableOnboardingAnimations = (() => {
    try {
      return localStorage.getItem('catint_onboarding_anim_disabled_v1') === '1';
    } catch {
      return false;
    }
  })();

  const current = steps[step];
  const isLast = step >= steps.length - 1;

  useEffect(() => {
    if (current?.viewAction) {
      prepareGuideView(current.viewAction);
    }
  }, [step, current, prepareGuideView]);

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
    const t = setTimeout(measureTarget, 120);
    const onLayout = () => measureTarget();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [step, measureTarget, lang]);

  const finishGuide = () => {
    prepareGuideView({ workspace: 'scoreboard', closeSettings: true, expandMetrics: false });
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

  const toggleLang = () => {
    const next = lang === 'en' ? 'es' : 'en';
    saveGuideLang(next);
    onLangChange(next);
    setStep(0);
  };

  const cardStyle = spot
    ? {
        top: Math.min(spot.top + spot.height + 12, window.innerHeight - 220),
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
        <div className="app-guide-card-top">
          <div className="app-guide-progress">
            {steps.map((_, i) => (
              <span key={i} className={`app-guide-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
            ))}
          </div>
          <button type="button" className="app-guide-lang-toggle" onClick={toggleLang} title="Switch guide language">
            {ui.langToggle}
          </button>
        </div>
        <h2 className="app-guide-title">{current.title}</h2>
        <p className="app-guide-body">{current.body}</p>
        <div className="app-guide-actions">
          <button type="button" className="app-guide-btn ghost" onClick={finishGuide}>{ui.skip}</button>
          {step > 0 && (
            <button type="button" className="app-guide-btn ghost" onClick={goPrev}>{ui.back}</button>
          )}
          <button type="button" className="app-guide-btn primary" onClick={goNext}>
            {isLast ? ui.done : ui.next}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Help control — opens bilingual guided tour. */
export const AppGuideButton = ({ className = '' }) => {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(loadGuideLang);
  const showPulse = !isAppGuideDone();

  useEffect(() => {
    const openGuide = () => {
      setLang(loadGuideLang());
      setOpen(true);
    };
    window.addEventListener('cat_open_app_guide', openGuide);
    return () => window.removeEventListener('cat_open_app_guide', openGuide);
  }, []);

  return (
    <>
      <button
        type="button"
        className={`app-guide-scoreboard-btn${showPulse ? ' app-guide-scoreboard-btn--pulse' : ''}${className ? ` ${className}` : ''}`}
        onClick={() => setOpen(true)}
        title="Help tour — how to use CatIntAssist (EN/ES)"
        aria-label="Open app guide"
      >
        <HelpIcon size={14} />
      </button>
      {open && (
        <AppGuideOverlay
          lang={lang}
          onLangChange={setLang}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};
