/**
 * SmartTooltip (v4.223.0) — rich floating explanation tooltip with hover delay.
 *
 * Provides fleshed-out metrics, math formulas, and guidance for dashboard numbers.
 * Default 250ms delay prevents accidental popups when sweeping the mouse.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './SmartTooltip.css';

export const SmartTooltip = ({
  title,
  badge,
  formula,
  desc,
  hint,
  tone = 'neutral',
  delay = 250,
  placement = 'auto',
  disabled = false,
  as = 'div',
  className = '',
  style = {},
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0, actualPlacement: 'above' });
  const timerRef = useRef(null);
  const triggerRef = useRef(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 300;
    
    // Choose above vs below
    let actualPlacement = placement;
    if (actualPlacement === 'auto') {
      actualPlacement = rect.top < 190 ? 'below' : 'above';
    }

    // Horizontal centering clamped to viewport
    const viewportWidth = window.innerWidth || 900;
    const centerX = rect.left + rect.width / 2;
    const halfWidth = tooltipWidth / 2;
    let x = centerX - halfWidth;
    if (x < 12) x = 12;
    if (x + tooltipWidth > viewportWidth - 12) {
      x = Math.max(12, viewportWidth - tooltipWidth - 12);
    }

    // Vertical positioning
    let y = actualPlacement === 'above' ? rect.top - 8 : rect.bottom + 8;

    setCoords({ x, y, actualPlacement });
  }, [placement]);

  const handleMouseEnter = () => {
    if (disabled || (!title && !desc && !formula)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      calculatePosition();
      setVisible(true);
    }, delay);
  };

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setVisible(false);
      }
    };
    if (visible) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleMouseLeave, { passive: true });
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleMouseLeave);
    };
  }, [visible, handleMouseLeave]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const Component = as;

  return (
    <Component
      ref={triggerRef}
      className={`smart-tooltip-wrapper ${className}`}
      style={{ display: as === 'div' ? 'block' : 'inline-flex', ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      {visible && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          className="smart-tooltip-portal"
          style={{
            left: coords.x,
            top: coords.actualPlacement === 'above' ? 'auto' : coords.y,
            bottom: coords.actualPlacement === 'above' ? `${window.innerHeight - coords.y}px` : 'auto',
          }}
        >
          {(title || badge) && (
            <div className="smart-tooltip-header">
              {title && <span className="smart-tooltip-title">{title}</span>}
              {badge && (
                <span className={`smart-tooltip-badge smart-tooltip-badge--${tone}`}>
                  {badge}
                </span>
              )}
            </div>
          )}

          {formula && (
            <div className={`smart-tooltip-formula smart-tooltip-formula--${tone}`}>
              {formula}
            </div>
          )}

          {desc && <div className="smart-tooltip-desc">{desc}</div>}

          {hint && <div className="smart-tooltip-hint">{hint}</div>}
        </div>,
        document.body
      )}
    </Component>
  );
};

export default SmartTooltip;
