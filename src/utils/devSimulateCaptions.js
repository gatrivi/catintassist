import { applyTranscriptFormatting } from './transcriptFormat';
import {
  loadLanguagePair,
  laneSideForLang,
  normalizeLang,
} from './languageConfig';

let devBubbleCounter = 0;

export const DEV_SIM_STORAGE_KEY = 'catint_dev_sim_v1';

/** Dev sim available in non-production builds or when explicitly unlocked. */
export const isDevSimEnabled = () => {
  if (process.env.NODE_ENV !== 'production') return true;
  try {
    return localStorage.getItem(DEV_SIM_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Build a caption bubble shaped like Deepgram output (for TranscriptionBoard + useTranslate). */
export function createDevCaption({
  text,
  lang = 'en',
  isFinal = true,
  turnId = null,
  isSplit = false,
  turnWordCount = null,
  mockTranslation = null,
}) {
  const pair = loadLanguagePair();
  const normalizedLang = normalizeLang(lang);
  const side = laneSideForLang(normalizedLang, pair);
  const sealed = applyTranscriptFormatting(String(text || '').trim(), normalizedLang);
  const id = `dev-${Date.now()}-${++devBubbleCounter}`;
  const turn = turnId || `turn-dev-${Date.now()}`;
  const words = sealed.split(/\s+/).filter(Boolean).length;

  return {
    id,
    lang: normalizedLang,
    text: sealed,
    turnId: turn,
    turnWordCount: turnWordCount ?? words,
    isFinal: !!isFinal,
    isSplit: !!isSplit,
    enFinalized: side === 'en' ? sealed : '',
    esFinalized: side === 'es' ? sealed : '',
    enInterim: '',
    esInterim: '',
    enFull: side === 'en' ? sealed : '',
    esFull: side === 'es' ? sealed : '',
    ...(mockTranslation != null && mockTranslation !== ''
      ? { _devMockTranslation: String(mockTranslation) }
      : {}),
  };
}

const LONG_EN =
  'Well, I need to schedule an appointment for next Tuesday because my doctor said the results came back and we should discuss the treatment options, the medication dosage, and whether I need any follow-up labs before the end of the month when my insurance renews and the copay might change.';

/** Named scenarios for regression debugging (transcription layout, splits, translation). */
export const DEV_SIM_PRESETS = {
  phone_spelled: {
    label: 'Phone (EN words)',
    ensureCall: true,
    steps: [
      {
        text: 'My callback number is five five five one two three four five six seven.',
        lang: 'en',
      },
    ],
  },
  phone_digits: {
    label: 'Phone (digits)',
    ensureCall: true,
    steps: [
      {
        text: 'Please call me back at 5551234567 before five pm.',
        lang: 'en',
      },
    ],
  },
  long_en: {
    label: 'Long EN (60+ words)',
    ensureCall: true,
    steps: [{ text: LONG_EN, lang: 'en' }],
  },
  split_same_turn: {
    label: 'Split same turn',
    ensureCall: true,
    steps: [
      {
        text: 'First part of the message about your lab results and next steps.',
        lang: 'en',
        mockTranslation: 'Primera parte del mensaje sobre sus resultados de laboratorio y próximos pasos.',
        turnKey: 'split-turn',
      },
      { delayMs: 400 },
      {
        text: 'Second part covers billing and your forty dollar copay for the visit.',
        lang: 'en',
        turnKey: 'split-turn',
        isSplit: true,
      },
    ],
  },
  mock_bad_trans: {
    label: 'Mock bad translation',
    ensureCall: true,
    steps: [
      {
        text: 'Your appointment is confirmed for March fifteenth at ten am.',
        lang: 'en',
        mockTranslation: 'bueno',
      },
    ],
  },
  en_then_es: {
    label: 'EN then ES',
    ensureCall: true,
    steps: [
      { text: 'The nurse will call you back within twenty four hours.', lang: 'en' },
      { delayMs: 600 },
      {
        text: 'Perfecto, entonces espero la llamada mañana por la mañana.',
        lang: 'es',
      },
    ],
  },
  es_medical: {
    label: 'ES medical',
    ensureCall: true,
    steps: [
      {
        text: 'Necesito una receta para la metformina de quinientos miligramos dos veces al día.',
        lang: 'es',
      },
    ],
  },
  interim_finalize: {
    label: 'Interim → final',
    ensureCall: true,
    steps: [
      {
        action: 'interim_finalize',
        text: 'I am checking your account now',
        finalText: 'I am checking your account now and I see the balance is forty two dollars.',
        lang: 'en',
        finalizeAfterMs: 900,
      },
    ],
  },
};

const ensureDevCallUi = () => {
  try {
    window.dispatchEvent(new CustomEvent('cat_demo_scenario', { detail: 'ui_call' }));
  } catch (_) {}
};

const appendCaption = (updateCaptions, cap, sharedTurnId) => {
  const bubble = createDevCaption({
    ...cap,
    turnId: cap.turnKey ? sharedTurnId[cap.turnKey] : cap.turnId,
    isSplit: cap.isSplit,
    mockTranslation: cap.mockTranslation,
  });
  if (cap.turnKey && !sharedTurnId[cap.turnKey]) {
    sharedTurnId[cap.turnKey] = bubble.turnId;
  }
  updateCaptions((prev) => [...prev, bubble].slice(-150));
  return bubble;
};

export async function runDevSimAction(detail, { updateCaptions, clearCaptions }) {
  if (!isDevSimEnabled()) return;

  const action = detail.action || 'inject';
  const sharedTurnId = {};

  if (detail.ensureCall !== false && (detail.ensureCall || action === 'preset')) {
    ensureDevCallUi();
    await sleep(80);
  }

  switch (action) {
    case 'clear':
      clearCaptions?.();
      return;

    case 'preset': {
      const preset = DEV_SIM_PRESETS[detail.name];
      if (!preset) return;
      if (preset.ensureCall) ensureDevCallUi();
      for (const step of preset.steps) {
        if (step.delayMs) {
          await sleep(step.delayMs);
          continue;
        }
        if (step.action === 'interim_finalize') {
          const interim = createDevCaption({
            text: step.text,
            lang: step.lang,
            isFinal: false,
          });
          updateCaptions((prev) => [...prev, interim].slice(-150));
          await sleep(step.finalizeAfterMs || 800);
          const finalText = step.finalText || step.text;
          updateCaptions((prev) =>
            prev.map((c) =>
              c.id === interim.id
                ? {
                    ...createDevCaption({
                      text: finalText,
                      lang: step.lang,
                      isFinal: true,
                      turnId: interim.turnId,
                      mockTranslation: step.mockTranslation,
                    }),
                    id: interim.id,
                  }
                : c,
            ).slice(-150),
          );
          continue;
        }
        appendCaption(updateCaptions, step, sharedTurnId);
      }
      return;
    }

    case 'interim_finalize': {
      const interim = createDevCaption({
        text: detail.text,
        lang: detail.lang || 'en',
        isFinal: false,
      });
      updateCaptions((prev) => [...prev, interim].slice(-150));
      await sleep(detail.finalizeAfterMs || 800);
      const finalText = detail.finalText || detail.text;
      updateCaptions((prev) =>
        prev.map((c) =>
          c.id === interim.id
            ? {
                ...createDevCaption({
                  text: finalText,
                  lang: detail.lang || 'en',
                  isFinal: true,
                  turnId: interim.turnId,
                  mockTranslation: detail.mockTranslation,
                }),
                id: interim.id,
              }
            : c,
        ).slice(-150),
      );
      return;
    }

    case 'inject':
    default: {
      if (detail.ensureCall) ensureDevCallUi();
      const cap = createDevCaption({
        text: detail.text || '',
        lang: detail.lang || 'en',
        isFinal: detail.isFinal !== false,
        isSplit: !!detail.isSplit,
        turnId: detail.turnId,
        mockTranslation: detail.mockTranslation,
      });
      updateCaptions((prev) => [...prev, cap].slice(-150));
      return cap;
    }
  }
}

/** Console helper: window.__catDevSim.preset('phone_digits') */
export function attachDevSimConsole(api) {
  if (!isDevSimEnabled() || typeof window === 'undefined') return;
  window.__catDevSim = api;
}
