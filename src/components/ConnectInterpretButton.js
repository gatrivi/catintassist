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
}) => {
  const timeoutRef = useRef(null);
  const lastClickAtRef = useRef(0);

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
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      onDouble?.();
      return;
    }

    lastClickAtRef.current = now;
    timeoutRef.current = setTimeout(() => {
      lastClickAtRef.current = 0;
      timeoutRef.current = null;
      onSingle?.();
    }, DOUBLE_TAP_MS);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`connect-interpret-btn btn-primaryish ${flash ? 'connect-interpret-flash' : ''}`}
      style={{
        ...style,
        background: '#10b981',
        color: '#fff',
        border: '1px solid rgba(16,185,129,0.35)',
      }}
      title={doubleTitle ? `${singleTitle || 'Connect'} (double tap: ${doubleTitle})` : singleTitle || 'Connect'}
      aria-label={singleTitle || 'Connect'}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <span aria-hidden style={{ display: 'inline-flex', transform: 'translateY(-0.5px)' }}>
          <PlayIcon />
        </span>
        <span>Connect</span>
      </span>
    </button>
  );
};

