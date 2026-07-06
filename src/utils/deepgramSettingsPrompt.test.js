import {
  getDeepgramBlockReason,
  getDeepgramSettingsPrompt,
} from './deepgramSettingsPrompt';
import { clearRememberedKey, hasBundledDeepgramKey } from './deepgramRuntimeKey';

describe('deepgramSettingsPrompt', () => {
  const origEnv = process.env.REACT_APP_DEEPGRAM_API_KEY;

  afterEach(() => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = origEnv;
    clearRememberedKey();
    localStorage.clear();
  });

  test('no_key prompt explains connect failure', () => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = '';
    const prompt = getDeepgramSettingsPrompt('bundled_missing', 'connect');
    expect(prompt.title).toMatch(/build key/i);
    expect(prompt.body).toMatch(/Connect could not start/i);
  });

  test('block reason null when env key present', () => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = 'env_key_1234567890';
    expect(getDeepgramBlockReason()).toBeNull();
  });

  test('hasBundledDeepgramKey tracks env at build', () => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = 'env_key_1234567890';
    expect(hasBundledDeepgramKey()).toBe(true);
    process.env.REACT_APP_DEEPGRAM_API_KEY = '';
    expect(hasBundledDeepgramKey()).toBe(false);
  });
});
