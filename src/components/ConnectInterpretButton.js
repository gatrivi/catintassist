import React, { useEffect, useMemo, useRef } from 'react';
import { PlayIcon } from './HeaderWidgets';

const DOUBLE_TAP_MS = 280;

export const ConnectInterpretButton = ({
  onSingle,
  onDouble,
  flash = false,
  disabled = false,
  size = 'top', // 'top' | 'idle'
  singleTitle,
  doubleTitle,
  label = 'Connect',
  requireDoubleTapIndicator = false,
  onArmDoubleTap,
  pendingDoubleTapTitle = 'Tap again to start',
}) => {
  const timeoutRef = useRef(null);
  const lastClickAtRef = useRef(0);
  const [isPendingDoubleTap, setIsPendingDoubleTap] = React.useState(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const style = useMemo(() => {
    if (size === 'idle') {
      return {
        width: '100%',
        padding: '0.75rem 1rem',
        fontSize: '0.95rem',
        borderRadius: '10px',
        fontWeight: 900,
        letterSpacing: '0.02em',
      };
    }
    return {
      padding: '0.35rem 0.55rem',
      fontSize: '0.75rem',
      borderRadius: '8px',
      fontWeight: 900,
      letterSpacing: '0.02em',
    };
  }, [size]);

  const handleClick = () => {
    if (disabled) return;
    const now = Date.now();
    const last = lastClickAtRef.current;
    const isDouble = last && (now - last) <= DOUBLE_TAP_MS;

    if (isDouble) {
      lastClickAtRef.current = 0;
      setIsPendingDoubleTap(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      onDouble?.();
      return;
    }

    lastClickAtRef.current = now;
    timeoutRef.current = setTimeout(() => {
      lastClickAtRef.current = 0;
      timeoutRef.current = null;
      setIsPendingDoubleTap(false);
      // If the parent says double-tap is required, first tap only arms UI.
      if (!requireDoubleTapIndicator) onSingle?.();
    }, DOUBLE_TAP_MS);

    if (requireDoubleTapIndicator) {
      setIsPendingDoubleTap(true);
      onArmDoubleTap?.();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`connect-interpret-btn btn-primaryish ${flash || isPendingDoubleTap ? 'connect-interpret-flash' : ''}`}
      style={{
        ...style,
        background: '#10b981',
        color: '#fff',
        border: '1px solid rgba(16,185,129,0.35)',
      }}
      title={doubleTitle
        ? (requireDoubleTapIndicator
            ? `${label} — double-tap required (2nd click opens picker).`
            : `${singleTitle || label} (double tap: ${doubleTitle})`)
        : (singleTitle || label)}
      aria-label={singleTitle || label}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <span aria-hidden style={{ display: 'inline-flex', transform: 'translateY(-0.5px)' }}>
          <PlayIcon />
        </span>
        <span>{isPendingDoubleTap ? pendingDoubleTapTitle : label}</span>
      </span>
    </button>
  );
};

