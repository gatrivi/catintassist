import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export const HoverTooltip = ({
  tip,
  children,
  className = '',
  style,
  onClick,
  block = false,
}) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef(null);
  const Wrapper = block ? 'div' : 'span';

  const show = useCallback(() => {
    if (!tip || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setVisible(true);
  }, [tip]);

  const hide = useCallback(() => setVisible(false), []);

  if (!tip) {
    if (block || className || style || onClick) {
      return (
        <Wrapper className={className} style={style} onClick={onClick}>
          {children}
        </Wrapper>
      );
    }
    return children;
  }

  return (
    <>
      <Wrapper
        ref={ref}
        className={`hover-tip-anchor${className ? ` ${className}` : ''}`}
        style={style}
        onClick={onClick}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </Wrapper>
      {visible && createPortal(
        <div
          className="hover-tip-popup"
          style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
          role="tooltip"
        >
          {tip}
        </div>,
        document.body
      )}
    </>
  );
};
