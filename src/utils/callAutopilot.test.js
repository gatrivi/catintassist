import {
  DEFAULT_START_PHRASES,
  DEFAULT_END_PHRASES,
  AUTOPILOT_MIN_CALL_SECS,
  matchCallStartPhrase,
  matchCallEndPhrase,
  canAutopilotStart,
  canAutopilotEnd,
  phrasesToText,
  textToPhrases,
  loadAutopilotPhrases,
} from './callAutopilot';

describe('callAutopilot phrase matching', () => {
  const phrases = { start: DEFAULT_START_PHRASES, end: DEFAULT_END_PHRASES, queue: undefined };

  test('start phrase matches anywhere in the utterance', () => {
    expect(matchCallStartPhrase('ok, the call is being bridged now', phrases)).toBe('call is being bridged');
    expect(matchCallStartPhrase('I HAVE A CALL FOR YOU', { ...phrases, queue: [] })).toBe('i have a call for you');
  });

  test('no start phrase → null', () => {
    expect(matchCallStartPhrase('hello, how can I help you today', phrases)).toBeNull();
    expect(matchCallStartPhrase('', phrases)).toBeNull();
  });

  test('queue wording in the same utterance vetoes the start', () => {
    const queued = 'please continue to hold, we are connecting you with the next available interpreter';
    expect(matchCallStartPhrase(queued, { ...phrases, queue: ['please continue to hold'] })).toBeNull();
    // but a plain bridge line with no queue wording still starts
    expect(matchCallStartPhrase('the call is being bridged', { ...phrases, queue: ['please continue to hold'] })).toBe('call is being bridged');
  });

  test('end phrase matches', () => {
    expect(matchCallEndPhrase('the caller has disconnected the call', phrases)).toBe('caller has disconnected');
    expect(matchCallEndPhrase('thank you for using our service goodbye', phrases)).toBe('thank you for using');
    expect(matchCallEndPhrase('she said the call has ended abruptly', phrases)).toBe('call has ended');
  });

  test('end phrase absent → null', () => {
    expect(matchCallEndPhrase('my name is María, how are you', phrases)).toBeNull();
  });
});

describe('callAutopilot gates', () => {
  test('canAutopilotStart requires armed + idle + out of cooldown', () => {
    expect(canAutopilotStart({ enabled: true, isActive: false, isZombie: false, cooldownRemainsMs: 0 })).toBe(true);
    expect(canAutopilotStart({ enabled: false, isActive: false, isZombie: false, cooldownRemainsMs: 0 })).toBe(false);
    expect(canAutopilotStart({ enabled: true, isActive: true, isZombie: false, cooldownRemainsMs: 0 })).toBe(false);
    expect(canAutopilotStart({ enabled: true, isActive: false, isZombie: true, cooldownRemainsMs: 0 })).toBe(false);
    expect(canAutopilotStart({ enabled: true, isActive: false, isZombie: false, cooldownRemainsMs: 5000 })).toBe(false);
  });

  test('canAutopilotEnd requires armed + live call + not hold + past echo window', () => {
    expect(canAutopilotEnd({ enabled: true, isActive: true, isHold: false, callAgeSecs: 120 })).toBe(true);
    expect(canAutopilotEnd({ enabled: true, isActive: true, isHold: true, callAgeSecs: 120 })).toBe(false);
    expect(canAutopilotEnd({ enabled: true, isActive: false, isHold: false, callAgeSecs: 120 })).toBe(false);
    expect(canAutopilotEnd({ enabled: true, isActive: true, isHold: false, callAgeSecs: AUTOPILOT_MIN_CALL_SECS - 1 })).toBe(false);
    expect(canAutopilotEnd({ enabled: false, isActive: true, isHold: false, callAgeSecs: 120 })).toBe(false);
  });
});

describe('callAutopilot settings text round-trip', () => {
  test('phrasesToText → textToPhrases preserves both lists', () => {
    const prev = { start: ['call is being bridged'], end: ['caller has disconnected'], queue: ['please continue to hold'] };
    const text = phrasesToText(prev);
    const out = textToPhrases(text, prev);
    expect(out.start).toEqual(prev.start);
    expect(out.end).toEqual(prev.end);
    expect(out.queue).toEqual(prev.queue); // queue list passes through untouched
  });

  test('textToPhrases splits on the comment headers', () => {
    const prev = { start: ['a'], end: ['b'], queue: ['q'] };
    const out = textToPhrases('# one phrase per line — a transcript containing any of these STARTS the call\nx\ny\n\n# a transcript containing any of these ENDS it (10s cancellable)\nz', prev);
    expect(out.start).toEqual(['x', 'y']);
    expect(out.end).toEqual(['z']);
  });

  test('empty edit keeps previous lists', () => {
    const prev = { start: ['a'], end: ['b'], queue: ['q'] };
    const out = textToPhrases('# nothing', prev);
    expect(out.start).toEqual(prev.start);
    expect(out.end).toEqual(prev.end);
  });
});

describe('loadAutopilotPhrases', () => {
    test('falls back to defaults on garbage storage', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('not-json{');
      expect(loadAutopilotPhrases().start).toEqual(DEFAULT_START_PHRASES);
      jest.restoreAllMocks();
    });
});
