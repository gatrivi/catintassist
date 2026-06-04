import React, { useEffect, useState, useRef } from 'react';

/**
 * Single digit odometer column — rolls forward only (mechanical counter).
 */
const RollingDigit = ({ digit, height = 14, speed = 0.35, liveMode = false }) => {
  const numericDigit = parseInt(digit, 10);
  const isInvalid = Number.isNaN(numericDigit);

  const [offset, setOffset] = useState(() => (isInvalid ? 0 : numericDigit * height));
  const prevDigitRef = useRef(numericDigit);
  const cycleRef = useRef(isInvalid ? 0 : numericDigit);
  const [noAnim, setNoAnim] = useState(false);

  useEffect(() => {
    if (isInvalid || numericDigit === prevDigitRef.current) return;

    setNoAnim(false);
    const prev = prevDigitRef.current;
    let diff = numericDigit - prev;
    if (diff < 0) diff += 10;
    if (diff === 0) diff = 10;

    cycleRef.current += diff;
    setOffset(cycleRef.current * height);
    prevDigitRef.current = numericDigit;

    const timer = setTimeout(() => {
      if (cycleRef.current >= 20) {
        setNoAnim(true);
        cycleRef.current = numericDigit;
        setOffset(numericDigit * height);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setNoAnim(false));
        });
      }
    }, speed * 1000 + 40);

    return () => clearTimeout(timer);
  }, [numericDigit, height, speed, isInvalid]);

  if (isInvalid) {
    return (
      <span
        className="rolling-char"
        style={{ height, width: '0.45em' }}
      >
        {digit}
      </span>
    );
  }

  const strip = Array.from({ length: 30 }, (_, i) => i % 10);

  return (
    <div className="digit-container" style={{ height, width: liveMode ? '0.55em' : '0.6em' }}>
      <div
        className="digit-strip"
        style={{
          transform: `translateY(-${offset}px)`,
          transition: noAnim ? 'none' : `transform ${liveMode ? Math.min(speed, 0.14) : speed}s cubic-bezier(0.34, 1.2, 0.64, 1)`,
        }}
      >
        {strip.map((n, i) => (
          <div
            key={i}
            className="digit-value"
            style={{
              height,
              fontSize: height * 0.82,
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Odometer-style number display (currency, integers).
 * Use with LiveRollingNumber for smooth per-second income roll.
 */
export const RollingNumber = ({
  value,
  prefix = '',
  suffix = '',
  height = 14,
  className = '',
  format = true,
  liveMode = false,
}) => {
  let displayValue = String(value);
  const isPureNumber =
    typeof value === 'number' ||
    (!Number.isNaN(parseFloat(value)) && Number.isFinite(parseFloat(value)) && !String(value).includes(':'));

  if (isPureNumber && format) {
    const num = Math.round(parseFloat(value));
    displayValue = Number.isFinite(num) ? Math.abs(num).toLocaleString('es-AR') : '0';
    if (Number.isFinite(num) && num < 0 && !prefix.includes('-')) prefix = `-${prefix}`;
  }

  const fullString = prefix + displayValue + suffix;
  const chars = fullString.split('');
  const digitsOnly = chars.filter((c) => !Number.isNaN(parseInt(c, 10)) && c !== ' ');
  const totalDigits = digitsOnly.length;
  let digitsFound = 0;

  return (
    <div
      className={`rolling-number-wrapper ${className}`}
      style={{ height, display: 'inline-flex', alignItems: 'center', fontFamily: 'var(--font-mono)' }}
    >
      {chars.map((char, i) => {
        const isDigit = !Number.isNaN(parseInt(char, 10)) && char !== ' ';

        if (!isDigit) {
          return (
            <span
              key={`s-${i}`}
              className="rolling-char"
              style={{
                width: char === '.' || char === ':' ? '0.3em' : char === '$' ? '0.5em' : '0.35em',
                textAlign: 'center',
                opacity: char === ' ' ? 0 : 0.75,
                fontFamily: 'var(--font-mono)',
                fontSize: height * 0.75,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {char === ' ' ? '\u00a0' : char}
            </span>
          );
        }

        const fromRight = totalDigits - 1 - digitsFound;
        digitsFound++;
        const speed = liveMode ? 0.06 + fromRight * 0.018 : 0.35 + fromRight * 0.06;

        return (
          <RollingDigit
            key={`d-${fromRight}`}
            digit={char}
            height={height}
            speed={speed}
            liveMode={liveMode}
          />
        );
      })}
    </div>
  );
};
