import React from 'react';

/**
 * Stable monospace display for dashboard metrics.
 * Replaces RollingNumber — no digit-strip animation, no layout jitter.
 */
export const StatNumber = ({
  value,
  prefix = '',
  suffix = '',
  size = 'md',
  format = true,
  className = '',
  title,
}) => {
  let body = '–';

  if (value !== null && value !== undefined && value !== '') {
    const str = String(value);
    const isTimeLike = str.includes(':');
    const isNumeric =
      typeof value === 'number' ||
      (!isTimeLike && str.trim() !== '' && !Number.isNaN(parseFloat(str)));

    if (isNumeric && format) {
      const num = Math.round(parseFloat(value));
      body = Number.isFinite(num) ? Math.abs(num).toLocaleString('es-AR') : '–';
      if (Number.isFinite(num) && num < 0 && !prefix.startsWith('-')) {
        prefix = `-${prefix}`;
      }
    } else {
      body = str;
    }
  }

  return (
    <span
      className={`stat-number stat-number--${size}${className ? ` ${className}` : ''}`}
      title={title}
    >
      {prefix}
      {body}
      {suffix}
    </span>
  );
};
