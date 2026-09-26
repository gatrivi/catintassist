import {
  STT_LATENCY_MODES,
  buildListenUrl,
  getInterimFlushMs,
  getInterimProcessThrottleMs,
  getMediaRecorderTimeslice,
  getMediaRecorderOptions,
  buildAudioOnlyStream,
  getDeepgramModel,
  loadSttLatencyMode,
  saveSttLatencyMode,
  toggleSttLatencyMode,
  readSttBias,
  saveSttBias,
  STT_BIAS_MEDICAL_MODEL,
  STT_BIAS_KEYTERM,
  STT_BIAS_USER_KEYTERMS,
} from './deepgramListenConfig';
import { clearCorrections, saveCorrection } from './transcriptCorrections';

describe('deepgramListenConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('defaults to fast mode', () => {
    expect(loadSttLatencyMode()).toBe('fast');
  });

  test('buildListenUrl includes words and mode endpointing', () => {
    const fast = buildListenUrl('en', 'fast');
    expect(fast).toContain('model=nova-3-general');
    expect(fast).toContain('numerals=true');
    expect(fast).toContain('filler_words=true');
    expect(fast).toContain('words=true');
    expect(fast).toContain('endpointing=150');
    const bal = buildListenUrl('es', 'balanced');
    expect(bal).toContain('model=nova-3-general');
    expect(bal).toContain('endpointing=300');
  });

  test('uses nova-3-general for all lanes (medical+filler_words unsupported)', () => {
    expect(getDeepgramModel('en-US')).toBe('nova-3-general');
    expect(getDeepgramModel('es-419')).toBe('nova-3-general');
    expect(getDeepgramModel('multi')).toBe('nova-3-general');
  });

  test('buildAudioOnlyStream strips video tracks', () => {
    if (typeof MediaStream === 'undefined') return;
    const audio = { kind: 'audio', enabled: true, muted: false };
    const video = { kind: 'video', enabled: true, muted: false };
    const stream = {
      getAudioTracks: () => [audio],
      getVideoTracks: () => [video],
    };
    const audioOnly = buildAudioOnlyStream(stream);
    expect(audioOnly).not.toBeNull();
    expect(audioOnly.getAudioTracks()).toEqual([audio]);
    expect(audioOnly.getVideoTracks()).toEqual([]);
  });

  test('getMediaRecorderOptions prefers webm/opus when supported', () => {
    const opts = getMediaRecorderOptions();
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      expect(opts?.mimeType).toBe('audio/webm;codecs=opus');
    } else if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')) {
      expect(opts?.mimeType).toBe('audio/webm');
    } else {
      expect(opts).toBeUndefined();
    }
  });

  test('fast mode uses aggressive timings', () => {
    expect(getMediaRecorderTimeslice('fast')).toBe(100);
    expect(getInterimProcessThrottleMs('fast')).toBe(100);
    expect(getInterimFlushMs('fast')).toBe(100);
    expect(STT_LATENCY_MODES.balanced.mediaRecorderMs).toBe(250);
  });

  test('save and toggle persist mode', () => {
    saveSttLatencyMode('balanced');
    expect(loadSttLatencyMode()).toBe('balanced');
    expect(toggleSttLatencyMode()).toBe('fast');
    expect(loadSttLatencyMode()).toBe('fast');
  });

  // ── v4.157.0 provider biasing ────────────────────────────────────────────
  describe('provider biasing (v4.157.0)', () => {
    test('THE PROMISE: unbiased URL is byte-identical to v4.154.0', () => {
      // Locked on purpose. If this string ever changes, Deepgram gets something
      // we did not ask for (and the bill changes with it).
      expect(buildListenUrl('en', 'fast')).toBe(
        'wss://api.deepgram.com/v1/listen?model=nova-3-general&smart_format=true&' +
          'numerals=true&filler_words=true&words=true&language=en&interim_results=true&' +
          'endpointing=150',
      );
      // and an explicitly-empty bias object changes nothing
      expect(buildListenUrl('en', 'fast', {})).toBe(buildListenUrl('en', 'fast'));
      expect(buildListenUrl('es', 'balanced', { medicalModel: false, keyterm: false })).toBe(
        buildListenUrl('es', 'balanced'),
      );
    });

    test('every switch starts OFF', () => {
      expect(readSttBias()).toEqual({ medicalModel: false, keyterm: false, userKeyterms: false });
    });

    test('medical model: EN only, never ES (the app is a two-lane EN/ES structure)', () => {
      expect(getDeepgramModel('en', { medicalModel: true })).toBe('nova-3-medical');
      expect(getDeepgramModel('en-US', { medicalModel: true })).toBe('nova-3-medical');
      expect(getDeepgramModel('es', { medicalModel: true })).toBe('nova-3-general');
      expect(getDeepgramModel('es-419', { medicalModel: true })).toBe('nova-3-general');
      // off = today's behaviour
      expect(getDeepgramModel('en', { medicalModel: false })).toBe('nova-3-general');
      expect(getDeepgramModel('en')).toBe('nova-3-general');
    });

    test('medical model switch changes only the model in the URL', () => {
      const url = buildListenUrl('en', 'fast', { medicalModel: true });
      expect(url).toContain('model=nova-3-medical');
      expect(url).not.toContain('keyterm=');
    });

    test('keyterm switch appends the domain list, and nothing else moves', () => {
      const plain = buildListenUrl('en', 'fast');
      const biased = buildListenUrl('en', 'fast', { keyterm: true });
      expect(biased).toContain('keyterm=albuterol');
      // the head of the query is untouched
      expect(biased.split('&keyterm=')[0]).toBe(plain);
      expect(biased).toContain('model=nova-3-general'); // medical model still off
    });

    test('keyterm biasing is per lane (ES gets Spanish terms)', () => {
      const en = buildListenUrl('en', 'fast', { keyterm: true });
      const es = buildListenUrl('es', 'fast', { keyterm: true });
      expect(en).toContain('keyterm=albuterol');
      expect(en).not.toContain('keyterm=amoxicilina');
      expect(es).toContain('keyterm=amoxicilina');
    });

    test('only the literal "1" enables a bias switch', () => {
      localStorage.setItem(STT_BIAS_MEDICAL_MODEL, 'true');
      localStorage.setItem(STT_BIAS_KEYTERM, 'yes');
      localStorage.setItem(STT_BIAS_USER_KEYTERMS, 'on');
      expect(readSttBias()).toEqual({ medicalModel: false, keyterm: false, userKeyterms: false });
    });

    test('saveSttBias round-trips and always returns the truth', () => {
      expect(saveSttBias({ medicalModel: true, keyterm: true, userKeyterms: true })).toEqual({
        medicalModel: true,
        keyterm: true,
        userKeyterms: true,
      });
      expect(readSttBias()).toEqual({ medicalModel: true, keyterm: true, userKeyterms: true });
      // a partial save must not leave a stale switch on
      expect(saveSttBias({ keyterm: true })).toEqual({
        medicalModel: false,
        keyterm: true,
        userKeyterms: false,
      });
    });

    test('a broken storage means NO bias (never silently spend 2x)', () => {
      const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('no storage');
      });
      expect(readSttBias()).toEqual({ medicalModel: false, keyterm: false, userKeyterms: false });
      spy.mockRestore();
    });

    // ── v4.158.0: user corrections, and the promise that they stay home ────
    describe('user corrections as keyterms (v4.158.0)', () => {
      const corr = (corrected, lang = 'en') => ({ sourceHeard: 'xx', corrected, lang, createdAt: 1 });

      beforeEach(() => {
        localStorage.clear();
        clearCorrections();
      });

      test('nothing the user typed leaves the machine unless they say so', () => {
        saveCorrection({ sourceHeard: 'mid vail', corrected: 'Midvale', lang: 'en' });
        // keyterm ON, user corrections OFF -> lexicon only
        const off = buildListenUrl('en', 'fast', { keyterm: true, userKeyterms: false });
        expect(off).toContain('keyterm=albuterol');
        expect(off).not.toContain('Midvale');
        // both ON -> the correction leads the list
        const on = buildListenUrl('en', 'fast', { keyterm: true, userKeyterms: true });
        expect(on).toContain('keyterm=Midvale');
      });

      test('user keyterms without keyterm bias send nothing at all', () => {
        saveCorrection({ sourceHeed: 'mid vail', corrected: 'Midvale', lang: 'en' });
        const url = buildListenUrl('en', 'fast', { userKeyterms: true });
        expect(url).toBe(buildListenUrl('en', 'fast'));
        expect(url).not.toContain('keyterm=');
      });

      test('the ES socket never receives the English correction', () => {
        saveCorrection({ sourceHeard: 'mid vail', corrected: 'Midvale', lang: 'en' });
        const es = buildListenUrl('es', 'fast', { keyterm: true, userKeyterms: true });
        expect(es).not.toContain('Midvale');
      });

      test('a dose typed as a correction still never leaves the machine', () => {
        saveCorrection({ sourceHeard: 'five hundred', corrected: '500 mg', lang: 'en' });
        const url = buildListenUrl('en', 'fast', { keyterm: true, userKeyterms: true });
        expect(url).not.toContain('500');
      });
    });
  });
});
