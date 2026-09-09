import { isSttVerbose } from './useDeepgram';

describe('isSttVerbose (CPU: console flood gate)', () => {
  it('defaults off, opts in via localStorage', () => {
    localStorage.clear();
    expect(isSttVerbose()).toBe(false);
    localStorage.setItem('catint_stt_verbose', '1');
    expect(isSttVerbose()).toBe(true);
  });
});
