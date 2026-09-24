import { shouldAutoHold, shouldAutoResume } from './holdState';

describe('holdState auto hold/resume', () => {
  it('auto-holds only on recent intent + 30s continuous silence', () => {
    expect(shouldAutoHold({ isHold: false, holdIntentAgeMs: 30000, silenceSecs: 30 })).toBe(true);
    expect(shouldAutoHold({ isHold: false, holdIntentAgeMs: 30000, silenceSecs: 29.9 })).toBe(false);
    expect(shouldAutoHold({ isHold: false, holdIntentAgeMs: 61000, silenceSecs: 30 })).toBe(false);
    expect(shouldAutoHold({ isHold: true, holdIntentAgeMs: 1000, silenceSecs: 30 })).toBe(false);
  });

  it('auto-resumes on any speech while holding', () => {
    expect(shouldAutoResume({ isHold: true, silenceSecs: 0.5 })).toBe(true);
    expect(shouldAutoResume({ isHold: true, silenceSecs: 1.9 })).toBe(true);
    expect(shouldAutoResume({ isHold: true, silenceSecs: 5 })).toBe(false);
    expect(shouldAutoResume({ isHold: false, silenceSecs: 0 })).toBe(false);
  });
});
