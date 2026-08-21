import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LEGAL_SECTIONS, LEGAL_VERSION, LEGAL_CONTACT } from '../content/legal';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Legal text viewer / first-run consent gate.
 *
 * mode="consent": blocking — no overlay-click or Escape close; user must
 * Accept (records consent) or Decline (shows notice, app stays blocked).
 * mode="view": informational — Escape / ✕ / overlay click close.
 */
export const LegalModal = ({
  open = false,
  mode = 'view',
  initialSection = 'terms',
  onAccept,
  onClose,
}) => {
  const [sectionId, setSectionId] = useState(initialSection);
  const [declined, setDeclined] = useState(false);
  const panelRef = useRef(null);
  const isConsent = mode === 'consent';

  useEffect(() => {
    if (open) {
      setSectionId(initialSection);
      setDeclined(false);
    }
  }, [open, initialSection]);

  // Focus trap + Escape (view mode only).
  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    const first = panel.querySelector(FOCUSABLE);
    first?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !isConsent) {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (el) => !el.disabled && el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    panel.addEventListener('keydown', onKeyDown);
    return () => panel.removeEventListener('keydown', onKeyDown);
  }, [open, isConsent, onClose]);

  const handleAccept = useCallback(() => {
    onAccept?.();
  }, [onAccept]);

  const section = LEGAL_SECTIONS.find((s) => s.id === sectionId) || LEGAL_SECTIONS[0];

  if (!open) return null;

  return (
    <div
      className="legal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-title"
      onClick={isConsent ? undefined : (e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        ref={panelRef}
        className="legal-panel"
        style={{
          width: 'min(680px, 96vw)',
          maxHeight: 'min(86vh, 640px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#0b1220',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          color: '#fff',
          fontFamily: 'monospace',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 14px 8px',
          }}
        >
          <h3 id="legal-title" style={{ margin: 0, fontSize: 14 }}>
            {isConsent ? 'Welcome to CatIntAssist' : 'Legal'}{' '}
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
              v{LEGAL_VERSION}
            </span>
          </h3>
          {!isConsent && (
            <button
              type="button"
              aria-label="Close legal information"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 4,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                padding: '2px 8px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '0 14px 8px' }}>
          {LEGAL_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSectionId(s.id)}
              aria-pressed={section.id === s.id}
              style={{
                background: section.id === s.id ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 4,
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                padding: '3px 8px',
              }}
            >
              {s.title}
            </button>
          ))}
        </div>

        <div
          className="legal-body"
          role="document"
          aria-label={section.title}
          style={{
            overflowY: 'auto',
            padding: '4px 14px 12px',
            fontSize: 11,
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.82)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {section.blocks.map((block, i) => {
            if (block.type === 'h') {
              return (
                <h4
                  key={i}
                  style={{ color: '#93c5fd', fontSize: 11, margin: '12px 0 4px' }}
                >
                  {block.text}
                </h4>
              );
            }
            if (block.type === 'ul') {
              return (
                <ul key={i} style={{ margin: '4px 0 8px', paddingLeft: 18 }}>
                  {block.items.map((item, j) => (
                    <li key={j} style={{ marginBottom: 4 }}>{item}</li>
                  ))}
                </ul>
              );
            }
            return <p key={i} style={{ margin: '6px 0' }}>{block.text}</p>;
          })}
          <p style={{ margin: '10px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
            Not legal advice. Contact: {LEGAL_CONTACT.owner} · {LEGAL_CONTACT.email}
          </p>
        </div>

        {isConsent && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '10px 14px 12px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={handleAccept}
              style={{
                background: 'rgba(34,197,94,0.35)',
                border: '1px solid rgba(34,197,94,0.6)',
                borderRadius: 4,
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                padding: '6px 14px',
              }}
            >
              I have read and agree
            </button>
            <button
              type="button"
              onClick={() => setDeclined(true)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 4,
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                padding: '6px 14px',
              }}
            >
              Decline
            </button>
            {declined && (
              <span role="alert" style={{ color: '#f59e0b', fontSize: 10 }}>
                Agreement is required to use CatIntAssist. Review the sections above or
                contact {LEGAL_CONTACT.email}.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LegalModal;
