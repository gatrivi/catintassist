import React from 'react';
import { render } from '@testing-library/react';
import { StableTextMorph, typeStepMs, typeTotalMs, TYPE_TOTAL_MAX_MS } from './StableTextMorph';

describe('typed reveal (v4.183.0)', () => {
  test('short words: 28ms per char', () => expect(typeStepMs(5)).toBe(28));
  test('long runs never take longer than the cap', () => expect(typeTotalMs(400)).toBeLessThanOrEqual(TYPE_TOTAL_MAX_MS));
  test('appended words type in char by char, old words stay plain', () => {
    const { container, rerender } = render(<StableTextMorph text="I can" continuityKey="a" protectionsActive={false} />);
    rerender(<StableTextMorph text="I can help you" continuityKey="a" protectionsActive={false} />);
    const chars = container.querySelectorAll('.stm-char');
    expect(chars.length).toBeGreaterThan(0);
    expect(Array.from(chars).map((c) => c.textContent).join('')).toContain('help');
    expect(container.textContent.replace(/\s+/g, ' ')).toContain('I can');
  });
});
