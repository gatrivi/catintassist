import React from 'react';

export const UpdateAppBanner = ({ show, onDismiss, onUpdate }) => {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'auto',
        top: '42px',
        zIndex: 10050,
        background: 'rgba(15, 23, 42, 0.92)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
        borderRadius: 10,
        padding: '10px 12px',
        maxWidth: 'min(92vw, 820px)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ fontWeight: 950, fontSize: '0.9rem', color: '#f87171' }}>
          New version available
        </div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)' }}>
          Update without losing your call transcript.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
        <button
          onClick={onUpdate}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: '1px solid rgba(239, 68, 68, 0.6)',
            padding: '8px 10px',
            borderRadius: 8,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(37, 99, 235, 0.35)',
          }}
        >
          Update app
        </button>

        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '8px 10px',
            borderRadius: 8,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
};

