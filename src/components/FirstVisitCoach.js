import React, { useEffect, useState } from 'react';
import { useAppGuide } from '../contexts/AppGuideContext';

const DEVICE_KEY = 'catint_device_onboarded';

export const FirstVisitCoach = () => {
  const { openGuide } = useAppGuide();
  const [showCallout, setShowCallout] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DEVICE_KEY)) return;
      setShowCallout(true);
      document.documentElement.setAttribute('data-flash-help', 'true');
      const t = setTimeout(() => document.documentElement.removeAttribute('data-flash-help'), 2400);
      return () => clearTimeout(t);
    } catch (_) {}
  }, []);

  const dismissAndOpenGuide = () => {
    setShowCallout(false);
    openGuide(() => {
      try { localStorage.setItem(DEVICE_KEY, '1'); } catch (_) {}
      document.documentElement.setAttribute('data-flash-connect', 'true');
      setTimeout(() => document.documentElement.removeAttribute('data-flash-connect'), 2400);
    });
  };

  if (!showCallout) return null;

  return (
    <button
      type="button"
      className="first-visit-callout"
      onClick={dismissAndOpenGuide}
      aria-label="Open app guide"
    >
      <span className="first-visit-callout-icon">?</span>
      <span>Click here if you want to learn more</span>
    </button>
  );
};
