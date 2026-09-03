import {
  getDeepgramBlockReason,
  getDeepgramSettingsPrompt,
  notifyDeepgramKeyNeeded,
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

  test('locked-vault prompt gives the one-step recovery', () => {
    const prompt = getDeepgramSettingsPrompt('vault_locked', 'connect');
    expect(prompt.body).toMatch(/blocked/i);
    expect(prompt.body).toMatch(/press Unlock/i);
  });

  test('locked key failure opens the Deepgram recovery settings', () => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = '';
    clearRememberedKey();
    localStorage.setItem('dg_cipher', 'saved-token');
    const open = jest.fn();
    window.addEventListener('cat_show_settings', open);
    notifyDeepgramKeyNeeded();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0].detail).toMatchObject({
      section: 'deepgram',
      reason: 'vault_locked',
      trigger: 'connect',
    });
    window.removeEventListener('cat_show_settings', open);
  });

  test('hasBundledDeepgramKey tracks env at build', () => {
    process.env.REACT_APP_DEEPGRAM_API_KEY = 'env_key_1234567890';
    expect(hasBundledDeepgramKey()).toBe(true);
    process.env.REACT_APP_DEEPGRAM_API_KEY = '';
    expect(hasBundledDeepgramKey()).toBe(false);
  });
});
