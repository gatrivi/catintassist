/** @jest-environment jsdom */
import { prefersReducedMotion } from './motionPreference';

describe('motionPreference', () => {
  test('prefersReducedMotion returns boolean', () => {
    expect(typeof prefersReducedMotion()).toBe('boolean');
  });
});
