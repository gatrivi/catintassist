import { shouldAutoHold, shouldAutoResume } from './holdState';

describe('holdState auto hold/resume', () => {
  it('auto-holds on recent intent + 3s silence', () => {
    expect(shouldAutoHold({ isHold: false, holdIntentAgeMs: 5000, silenceSecs: 3 })).toBe(true);
    expect(shouldAutoHold({ isHold: false, holdIntentAgeMs: 5000, silenceSecs: 2.9 })).toBe(false);
    expect(shouldAutoHold({ isHold: false, holdIntentAgeMs: 31000, silenceSecs: 10 })).toBe(false);
    expect(shouldAutoHold({ isHold: true, holdIntentAgeMs: 1000, silenceSecs: 10 })).toBe(false);
  });

  it('auto-resumes on any speech while holding', () => {
    expect(shouldAutoResume({ isHold: true, silenceSecs: 0.5 })).toBe(true);
    expect(shouldAutoResume({ isHold: true, silenceSecs: 1.9 })).toBe(true);
    expect(shouldAutoResume({ isHold: true, silenceSecs: 5 })).toBe(false);
    expect(shouldAutoResume({ isHold: false, silenceSecs: 0 })).toBe(false);
  });
});
