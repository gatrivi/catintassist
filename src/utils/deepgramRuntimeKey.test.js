import {
  getEffectiveDeepgramKey,
  isValidDeepgramApiKey,
  setRuntimeDeepgramKey,
  clearRememberedKey,
} from './deepgramRuntimeKey';

describe('getEffectiveDeepgramKey', () => {
  const origEnv = process.env.REACT_APP_DEEPGRAM_API_KEY;

  afterEach(() => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = origEnv;
    clearRememberedKey();
  });

  test('prefers REACT_APP_DEEPGRAM_API_KEY over runtime', () => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = 'env_key_1234567890';
    setRuntimeDeepgramKey('runtime_key_1234567890');
    expect(getEffectiveDeepgramKey()).toBe('env_key_1234567890');
  });

  test('isValidDeepgramApiKey rejects placeholders', () => {
    expect(isValidDeepgramApiKey('your_deepgram_api_key_here')).toBe(false);
    expect(isValidDeepgramApiKey('short')).toBe(false);
  });
});
