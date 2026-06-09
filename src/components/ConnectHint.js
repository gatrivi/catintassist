import React, { useState } from 'react';

const HINT_KEY = 'catint_connect_hint_dismissed';

export const ConnectHint = () => {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(HINT_KEY) === '1'; } catch (_) { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(HINT_KEY, '1'); } catch (_) {}
  };

  return (
    <div className="connect-hint-banner" role="note">
      <span><strong>Tap</strong> 🎤 mic · <strong>Double-tap</strong> 📺 tab audio (interpreter mode)</span>
      <button type="button" className="connect-hint-dismiss" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
};
