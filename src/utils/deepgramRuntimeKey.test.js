import {
  getEffectiveDeepgramKey,
  getDeepgramKeySource,
  getDeepgramKeyInfo,
  hasConflictingDeepgramKeys,
  isValidDeepgramApiKey,
  setRuntimeDeepgramKey,
  clearRememberedKey,
  maskDeepgramKey,
} from './deepgramRuntimeKey';

describe('getEffectiveDeepgramKey', () => {
  const origEnv = process.env.REACT_APP_DEEPGRAM_API_KEY;

  afterEach(() => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = origEnv;
    clearRememberedKey();
  });

  test('prefers runtime key over REACT_APP_DEEPGRAM_API_KEY', () => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = 'env_key_1234567890';
    setRuntimeDeepgramKey('runtime_key_1234567890');
    expect(getEffectiveDeepgramKey()).toBe('runtime_key_1234567890');
    expect(getDeepgramKeySource()).toBe('runtime');
  });

  test('falls back to env when no runtime', () => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = 'env_key_1234567890';
    clearRememberedKey();
    expect(getEffectiveDeepgramKey()).toBe('env_key_1234567890');
    expect(getDeepgramKeySource()).toBe('env');
  });

  test('hasConflictingDeepgramKeys when both differ', () => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = 'env_key_1234567890';
    setRuntimeDeepgramKey('runtime_key_1234567890');
    expect(hasConflictingDeepgramKeys()).toBe(true);
  });

  test('maskDeepgramKey shows last four chars', () => {
    expect(maskDeepgramKey('sk-abc1234567890')).toBe('...7890');
  });

  test('isValidDeepgramApiKey rejects placeholders', () => {
    expect(isValidDeepgramApiKey('your_deepgram_api_key_here')).toBe(false);
    expect(isValidDeepgramApiKey('short')).toBe(false);
  });

  test('getDeepgramKeyInfo returns masked active key', () => {
    setRuntimeDeepgramKey('runtime_key_1234567890');
    const info = getDeepgramKeyInfo();
    expect(info.source).toBe('runtime');
    expect(info.masked).toBe('...7890');
  });
});
