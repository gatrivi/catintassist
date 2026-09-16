import React, { createContext, useContext } from 'react';

/** Build copyable selector: prefer #id, else [data-guide="…"]. */
export const buildElementSelector = ({ elementId, guideKey, fallback }) => {
  if (elementId) return `#${elementId}`;
  if (guideKey) return `[data-guide="${guideKey}"]`;
  return fallback || '';
};

const ElementHintContext = createContext(null);

/** Global host — v4.112.2: passive tooltips retired (HudInspector ⌖ picker
 * covers element select). Kept as a pass-through so existing imports mount
 * cleanly; renders children only, no portal, no hover listeners. */
export const ElementHintProvider = ({ children }) => {
  return <>{children}</>;
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
 * v4.112.2: passive hover tooltips retired — pass-through wrapper.
 * Renders the child unchanged (native `title` restored) so the HudInspector
 * ⌖ picker is the single element-select path.
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
  return React.Children.only(children);
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
