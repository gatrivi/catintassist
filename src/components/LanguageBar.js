import React, { useState, useRef, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  FULL_SUPPORT_LANGS,
  PARTIAL_SUPPORT_LANGS,
  ALL_LANGS,
  DEFAULT_LANG_PAIR,
  getLangShort,
} from '../config/languages';

const HOLD_MS = 450;

export const LanguageBar = () => {
  const { sourceLang, targetLang, setCustomPair, resetToDefault } = useLanguage();
  const [showHelp, setShowHelp] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [holdHint, setHoldHint] = useState(false);
  const [pickSource, setPickSource] = useState(sourceLang);
  const [pickTarget, setPickTarget] = useState(targetLang);
  const holdTimer = useRef(null);
  const didHold = useRef(false);

  const openPicker = useCallback(() => {
    setPickSource(sourceLang);
    setPickTarget(targetLang);
    setShowPicker(true);
    setHoldHint(false);
  }, [sourceLang, targetLang]);

  const onPanePointerDown = () => {
    didHold.current = false;
    holdTimer.current = setTimeout(() => {
      didHold.current = true;
      openPicker();
    }, HOLD_MS);
  };

  const onPanePointerUp = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (!didHold.current) {
      setHoldHint(true);
      setTimeout(() => setHoldHint(false), 2200);
    }
  };

  const onPanePointerLeave = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };

  const applyPair = () => {
    if (pickSource === pickTarget) return;
    if (pickSource === DEFAULT_LANG_PAIR.source && pickTarget === DEFAULT_LANG_PAIR.target) {
      resetToDefault();
    } else {
      setCustomPair({ source: pickSource, target: pickTarget });
    }
    setShowPicker(false);
  };

  return (
    <div className="language-bar">
      <div
        className="language-bar-panes"
        onPointerDown={onPanePointerDown}
        onPointerUp={onPanePointerUp}
        onPointerLeave={onPanePointerLeave}
        onPointerCancel={onPanePointerLeave}
        role="button"
        tabIndex={0}
        aria-label={`Languages: ${getLangShort(sourceLang)} to ${getLangShort(targetLang)}. Hold to change.`}
      >
        <span className="language-pane language-pane-source">{getLangShort(sourceLang)}</span>
        <span className="language-pane-arrow">→</span>
        <span className="language-pane language-pane-target">{getLangShort(targetLang)}</span>
      </div>

      <button
        type="button"
        className="language-bar-help-btn"
        onClick={() => setShowHelp((v) => !v)}
        title="Language support"
        aria-label="Language support info"
      >
        ?
      </button>

      {holdHint && (
        <div className="language-hold-hint" role="status">
          Hold to select languages
        </div>
      )}

      {showHelp && (
        <div className="language-help-popover">
          <div className="language-help-title">Language support</div>
          <table className="language-support-table">
            <thead>
              <tr>
                <th>Language</th>
                <th>STT</th>
                <th>Trans</th>
              </tr>
            </thead>
            <tbody>
              {FULL_SUPPORT_LANGS.map((l) => (
                <tr key={l.code} className="lang-row-full">
                  <td>{l.flag} {l.label}</td>
                  <td>✓</td>
                  <td>✓</td>
                </tr>
              ))}
              {PARTIAL_SUPPORT_LANGS.map((l) => (
                <tr key={l.code}>
                  <td>{l.flag} {l.label}</td>
                  <td>{l.sttOk ? '✓' : '–'}</td>
                  <td>{l.transOk ? '✓' : '~'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="language-help-note">
            ENG ↔ SPA is full interpreter mode. Other pairs work best via 🎤 mic connect.
          </p>
        </div>
      )}

      {showPicker && (
        <div className="language-picker-overlay" onClick={() => setShowPicker(false)}>
          <div className="language-picker-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="language-picker-title">Select languages</div>
            <p className="language-picker-sub">I speak → They read</p>
            <div className="language-picker-row">
              <label>
                I speak
                <select value={pickSource} onChange={(e) => setPickSource(e.target.value)}>
                  {ALL_LANGS.map((l) => (
                    <option key={`s-${l.code}`} value={l.code}>{l.flag} {l.label}</option>
                  ))}
                </select>
              </label>
              <span className="language-picker-arrow">→</span>
              <label>
                They read
                <select value={pickTarget} onChange={(e) => setPickTarget(e.target.value)}>
                  {ALL_LANGS.filter((l) => l.code !== pickSource).map((l) => (
                    <option key={`t-${l.code}`} value={l.code}>{l.flag} {l.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="language-picker-actions">
              <button type="button" className="btn" onClick={() => { resetToDefault(); setShowPicker(false); }}>
                Reset ENG ↔ SPA
              </button>
              <button type="button" className="btn btn-primary" onClick={applyPair} disabled={pickSource === pickTarget}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
