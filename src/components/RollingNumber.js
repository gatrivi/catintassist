import React, { useEffect, useState, useRef } from 'react';

/**
 * RollingNumber Component
 * A digit-by-digit rolling animator for currency and numbers.
 * Fixed: stable keys for numeric values, unbounded offset growth prevented.
 */
const RollingDigit = ({ digit, height = 24, speed = 1.5 }) => {
  const [offset, setOffset] = useState(() => digit * height);
  const prevDigitRef = useRef(digit);
  const cycleRef = useRef(digit);
  const [noAnim, setNoAnim] = useState(false);

  useEffect(() => {
    if (digit === prevDigitRef.current) return;

    setNoAnim(false);
    const prev = prevDigitRef.current;
    let diff = digit - prev;
    if (diff < 0) diff += 10;
    if (diff === 0) diff = 10; // spin full cycle if same digit

    cycleRef.current += diff;
    setOffset(cycleRef.current * height);
    prevDigitRef.current = digit;

    // After animation, snap back to single-cycle range to prevent unbounded growth
    const timer = setTimeout(() => {
      setNoAnim(true);
      const normalized = digit * height;
      cycleRef.current = digit;
      setOffset(normalized);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setNoAnim(false));
      });
    }, speed * 1000 + 50);

    return () => clearTimeout(timer);
  }, [digit, height, speed]);

  // 2 cycles (20 digits) is plenty since we normalize after every transition
  const strip = Array.from({ length: 20 }, (_, i) => i % 10);

  return (
    <div style={{
      height, width: '0.68em', overflow: 'hidden', position: 'relative',
      display: 'inline-block', fontVariantNumeric: 'tabular-nums',
      background: '#000', margin: '0 0.5px', border: '1px solid #18181b'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        transform: `translateY(-${offset}px)`,
        transition: noAnim ? 'none' : `transform ${speed}s cubic-bezier(0.4, 0, 0.2, 1)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        {strip.map((n, i) => (
          <div key={i} style={{
            height, display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', color: 'inherit',
            fontSize: height > 15 ? 'inherit' : '0.65rem',
            fontFamily: 'var(--font-mono)', fontWeight: 800
          }}>{n}</div>
        ))}
      </div>
    </div>
  );
};

export const RollingNumber = ({ value, prefix = '', suffix = '', height = 24, className = '' }) => {
  const num = typeof value === 'number' ? value : NaN;
  const isNumeric = !isNaN(num);

  if (isNumeric) {
    const absNum = Math.abs(Math.round(num));
    const isNegative = num < 0;
    const digits = String(absNum).split('');
    const len = digits.length;

    const elements = [];
    prefix.split('').forEach((c, i) => elements.push({ type: 'static', char: c, key: `p-${i}` }));
    if (isNegative) elements.push({ type: 'static', char: '-', key: 'neg' });

    digits.forEach((d, i) => {
      const fromRight = len - 1 - i;
      elements.push({ type: 'digit', digit: parseInt(d), key: `d-${fromRight}`, fromRight });
      if (fromRight > 0 && fromRight % 3 === 0) {
        elements.push({ type: 'static', char: '.', key: `sep-${fromRight}` });
      }
    });

    suffix.split('').forEach((c, i) => elements.push({ type: 'static', char: c, key: `s-${i}` }));

    return (
      <div className={`rolling-number-wrapper ${className}`} style={{
        height, display: 'inline-flex', alignItems: 'center', overflow: 'hidden', background: 'transparent'
      }}>
        {elements.map(el => {
          if (el.type === 'static') {
            return <span key={el.key} style={{
              width: el.char === '.' ? '0.3em' : '0.4em',
              textAlign: 'center', opacity: 0.5, fontFamily: 'var(--font-mono)'
            }}>{el.char}</span>;
          }
          const speed = 0.8 + (el.fromRight * 0.1);
          return <RollingDigit key={el.key} digit={el.digit} height={height} speed={speed} />;
        })}
      </div>
    );
  }

  // Fallback for non-numeric strings: old behavior with index keys
  const displayValue = String(value);
  const chars = (prefix + displayValue + suffix).split('');
  return (
    <div className={`rolling-number-wrapper ${className}`} style={{
      height, display: 'inline-flex', alignItems: 'center', overflow: 'hidden', background: 'transparent'
    }}>
      {chars.map((char, i) => {
        const reverseIdx = chars.length - 1 - i;
        const isNum = !isNaN(parseInt(char));
        const speed = isNum ? 0.8 + (reverseIdx * 0.1) : 1.2;
        return <RollingDigit key={i} digit={char} height={height} speed={speed} />;
      })}
    </div>
  );
};
