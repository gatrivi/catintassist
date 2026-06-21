import React, { useEffect, useState } from 'react';
import { ScrambleText } from './ScrambleText';
import { peekDefaultBackgroundUrl } from '../utils/defaultBackgrounds';
import {
  isOnboardingAnimationsDisabled,
  markSplashSeenThisSession,
} from '../utils/splashStorage';

const MORPH_MS = 2200;
const AUTO_DISMISS_MS = 4200;

/** Session splash — once per browser tab session. */
export const SplashScreen = ({ onComplete }) => {
  const fast = isOnboardingAnimationsDisabled();
  const [phase, setPhase] = useState(fast ? 'done' : 'brand');
  const [visible, setVisible] = useState(true);
  const bgUrl = peekDefaultBackgroundUrl();

  useEffect(() => {
    if (fast) {
      markSplashSeenThisSession();
      onComplete?.();
      setVisible(false);
      return undefined;
    }
    const t1 = setTimeout(() => setPhase('morph'), 700);
    const t2 = setTimeout(() => setPhase('dedication'), MORPH_MS);
    const t3 = setTimeout(() => {
      setVisible(false);
      markSplashSeenThisSession();
      onComplete?.();
    }, AUTO_DISMISS_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [fast, onComplete]);

  const dismissNow = () => {
    markSplashSeenThisSession();
    setVisible(false);
    onComplete?.();
  };

  if (!visible) return null;

  return (
    <div
      className="splash-screen"
      role="dialog"
      aria-label="CatIntAssist splash"
      onClick={dismissNow}
      style={{ backgroundImage: `url(${bgUrl})` }}
    >
      <div className="splash-vignette" aria-hidden />
      <div className="splash-content">
        <h1 className="splash-title">
          {phase === 'brand' && 'CatIntAssist'}
          {(phase === 'morph' || phase === 'dedication' || phase === 'done') && (
            <ScrambleText value="cat's interpreter assistant" charMs={fast ? 8 : 22} />
          )}
        </h1>
        <p
          className={`splash-dedication${phase === 'dedication' || phase === 'done' ? ' is-visible' : ''}`}
        >
          Dedicated to Truffles and Charcoal
        </p>
        {!fast && (
          <button type="button" className="splash-skip" onClick={(e) => { e.stopPropagation(); dismissNow(); }}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
};
