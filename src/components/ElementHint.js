import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Build copyable selector: prefer #id, else [data-guide="…"]. */
export const buildElementSelector = ({ elementId, guideKey, fallback }) => {
  if (elementId) return `#${elementId}`;
  if (guideKey) return `[data-guide="${guideKey}"]`;
  return fallback || '';
};

const ElementHintContext = createContext(null);

/** Global host — mount once near app root (alongside GuideHostProvider). */
export const ElementHintProvider = ({ children }) => {
  const [hint, setHint] = useState(null);
  const [copied, setCopied] = useState(false);
  const hideTimerRef = useRef(null);

  const show = useCallback((payload) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setCopied(false);
    setHint(payload);
  }, []);

  const keepOpen = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const hide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setHint(null);
      setCopied(false);
    }, 180);
  }, []);

  const copySelector = useCallback(async () => {
    const sel = hint?.selector;
    if (!sel) return;
    try {
      await navigator.clipboard.writeText(sel);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (_) {
      /* clipboard blocked — ignore */
    }
  }, [hint?.selector]);

  const value = useMemo(() => ({ show, hide, keepOpen }), [show, hide, keepOpen]);

  return (
    <ElementHintContext.Provider value={value}>
      {children}
      {hint && createPortal(
        <ElementHintPanel hint={hint} copied={copied} onCopy={copySelector} onKeepOpen={keepOpen} onHide={hide} />,
        document.body,
      )}
    </ElementHintContext.Provider>
  );
};

export const useElementHint = () => {
  const ctx = useContext(ElementHintContext);
  if (!ctx) {
    return {
      show: () => {},
      hide: () => {},
      keepOpen: () => {},
    };
  }
  return ctx;
};

const placementStyle = (placement) => {
  if (placement === 'below') return 'translate(-50%, 10px)';
  return 'translate(-50%, calc(-100% - 10px))';
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/** Portal panel — rich tooltip with element selector + copy. */
export const ElementHintPanel = ({ hint, copied, onCopy, onKeepOpen, onHide }) => {
  const color = hint.color || '#3b82f6';
  return (
    <div
      className="element-hint-panel"
      style={{
        position: 'fixed',
        left: hint.x,
        top: hint.y,
        transform: placementStyle(hint.placement || 'above'),
        zIndex: 1200,
        pointerEvents: 'auto',
      }}
      onMouseEnter={() => onKeepOpen?.()}
      onMouseLeave={() => onHide?.()}
      onPointerDown={() => onKeepOpen?.()}
    >
      <div className="element-hint-accent" style={{ background: color }} />
      <div className="element-hint-head">
        {hint.icon && (
          <span className="element-hint-icon" style={{ color }}>{hint.icon}</span>
        )}
        <span className="element-hint-heading">{hint.heading}</span>
      </div>
      {hint.body && <div className="element-hint-body">{hint.body}</div>}
      {hint.selector && (
        <div className="element-hint-selector-row">
          <span className="element-hint-selector-label">Debug selector</span>
          <code className="element-hint-selector">{hint.selector}</code>
          <button
            type="button"
            className="element-hint-copy-btn"
            onClick={onCopy}
            title="Copy element selector (paste to tell the agent which control)"
          >
            {copied ? '✓' : '⎘'}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Wrap any control — hover/focus shows ElementHint with unique selector + copy.
 * Native `title` is stripped to avoid double tooltips.
 */
export const ElementHintTarget = ({
  elementId,
  guideKey,
  heading,
  body,
  icon,
  color,
  placement = 'auto',
  children,
}) => {
  const { show, hide, keepOpen } = useElementHint();
  const selector = buildElementSelector({ elementId, guideKey, fallback: heading });

  const open = (e) => {
    if (document.querySelector('.app-container[data-call-mode="true"]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const resolvedPlacement = placement === 'auto'
      ? (rect.top < 160 ? 'below' : 'above')
      : placement;
    const y = resolvedPlacement === 'above' ? rect.top : rect.bottom;
    const x = clamp(rect.left + rect.width / 2, 140, window.innerWidth - 140);
    show({
      x,
      y,
      placement: resolvedPlacement,
      selector,
      heading,
      body,
      icon,
      color,
    });
  };

  const child = React.Children.only(children);
  const { title: _dropTitle, ...rest } = child.props;

  return React.cloneElement(child, {
    ...rest,
    onMouseEnter: (e) => {
      rest.onMouseEnter?.(e);
      open(e);
    },
    onMouseLeave: (e) => {
      rest.onMouseLeave?.(e);
      hide();
    },
    onPointerDown: (e) => {
      rest.onPointerDown?.(e);
      keepOpen?.();
      open(e);
    },
    onFocus: (e) => {
      rest.onFocus?.(e);
      open(e);
    },
    onBlur: (e) => {
      rest.onBlur?.(e);
      hide();
    },
  });
};

/** Imperative helper for metric cells / bars that already manage hover coords. */
export const buildHintPayload = ({
  elementId,
  guideKey,
  heading,
  body,
  icon,
  color,
  x,
  y,
  placement = 'above',
}) => ({
  selector: buildElementSelector({ elementId, guideKey, fallback: heading }),
  heading,
  body,
  icon,
  color,
  x,
  y,
  placement,
});
