/**
 * Phase 0 smoke checklist — proves coded systems on the real stack.
 * Does NOT re-run STT/translate harnesses; tracks operator verification + live probes.
 */
import { APP_VERSION } from '../constants/version';
import { hasConfiguredDeepgramKey } from './deepgramRuntimeKey';
import { getTranslationKeyStatus } from './translationRuntimeKeys';

export const PHASE0_SMOKE_STORAGE_KEY = 'catint_phase0_smoke_v1';

/** @typedef {'pass'|'fail'|'skip'|'unchecked'} SmokeStatus */

/**
 * Fixed Phase 0 items (ROADMAP). Operator marks after real-stack smoke.
 * `probe` = optional auto hint from live session (never auto-passes alone).
 */
export const PHASE0_SMOKE_ITEMS = [
  {
    id: 'split_both_translated',
    label: 'Long utterance → bubble split → both segments translated',
    how: 'Speak 50+ words (or fixture long_en / phone). Confirm both bubbles have real translation — not blank / “bueno” on the first part.',
    docs: 'docs/ROADMAP.md Phase 0',
    harnessHint: 'Settings → Behavior → Test Harness (STT) + live translate',
  },
  {
    id: 'revenant_reattach',
    label: 'Refresh mid-call → yellow re-attach; timer + translations preserved',
    how: 'Start call, get 2+ sealed bubbles with translations, refresh. Yellow banner → re-attach. Timer continues; captions + sealed translations return from IDB.',
    docs: 'docs/ROADMAP.md Phase 0',
    harnessHint: 'Live only (revenant / isZombieCall)',
  },
  {
    id: 'phone_digits_survive',
    label: '9–10 digit phone sequences survive overlap prune',
    how: 'Say fake 5551234567 (or play phone-number fixture). Digits remain in sealed bubble text.',
    docs: 'docs/handoff/01_number_protection.md',
    harnessHint: 'Test Harness → phone-number fixture',
  },
  {
    id: 'weak_beats_empty',
    label: 'Weak translation beats empty',
    how: 'Force a weak/passthrough path (or kill free tier). Pane must show source or weak text — never silent blank on a sealed bubble.',
    docs: 'AGENTS.md + translation-reliability-harness.md',
    harnessHint: 'npm run test:translation; live with keys off briefly',
  },
  {
    id: 'no_connect_thrash',
    label: 'No status UI thrash on connect',
    how: 'Attach + CONNECT. Status strip / connect phases settle without flicker loops.',
    docs: '.cursor/RULES/ui-thrash.md',
    harnessHint: 'Live tab/mic attach',
  },
  {
    id: 'enes_tiebreak',
    label: 'EN/ES column tie-break sane',
    how: 'Short EN then ES turns. Bubbles land on correct side/color; no flip-flop on digits-only lines.',
    docs: 'docs/transcription-pane/README.md',
    harnessHint: 'Test Harness → bilingual-switch',
  },
  {
    id: 'stt_harness_visible',
    label: 'STT fixture harness visible & runnable (v4.81)',
    how: 'Settings → Behavior → Test Harness appears; Play sync on phone-number shows OK.',
    docs: 'docs/development/transcription-test-harness.md',
    harnessHint: 'TestHarnessPanel',
    coded: true,
  },
  {
    id: 'translate_harness_coded',
    label: 'Translation reliability harness coded (v4.82)',
    how: 'npm run test:translation green; sealed translations persist on caption.translations.',
    docs: 'docs/development/translation-reliability-harness.md',
    harnessHint: 'npm run test:translation',
    coded: true,
  },
];

const emptyState = () => ({
  version: APP_VERSION,
  updatedAt: null,
  items: Object.fromEntries(
    PHASE0_SMOKE_ITEMS.map((i) => [i.id, { status: 'unchecked', note: '', at: null }]),
  ),
});

export function loadPhase0SmokeState() {
  try {
    const raw = localStorage.getItem(PHASE0_SMOKE_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const base = emptyState();
    if (parsed?.items && typeof parsed.items === 'object') {
      for (const id of Object.keys(base.items)) {
        if (parsed.items[id]) base.items[id] = { ...base.items[id], ...parsed.items[id] };
      }
    }
    base.updatedAt = parsed.updatedAt || null;
    return base;
  } catch {
    return emptyState();
  }
}

export function savePhase0SmokeState(state) {
  const next = { ...state, version: APP_VERSION, updatedAt: Date.now() };
  try {
    localStorage.setItem(PHASE0_SMOKE_STORAGE_KEY, JSON.stringify(next));
  } catch (_) {}
  return next;
}

export function setPhase0SmokeItem(id, status, note = '') {
  const state = loadPhase0SmokeState();
  if (!state.items[id]) return state;
  state.items[id] = {
    status,
    note: String(note || '').slice(0, 200),
    at: Date.now(),
  };
  return savePhase0SmokeState(state);
}

export function resetPhase0SmokeState() {
  const state = emptyState();
  return savePhase0SmokeState(state);
}

export function summarizePhase0Smoke(state = loadPhase0SmokeState()) {
  const ids = PHASE0_SMOKE_ITEMS.map((i) => i.id);
  let pass = 0;
  let fail = 0;
  let skip = 0;
  let unchecked = 0;
  for (const id of ids) {
    const s = state.items[id]?.status || 'unchecked';
    if (s === 'pass') pass += 1;
    else if (s === 'fail') fail += 1;
    else if (s === 'skip') skip += 1;
    else unchecked += 1;
  }
  const blocking = PHASE0_SMOKE_ITEMS.filter((i) => !i.coded);
  const blockingPass = blocking.every((i) => state.items[i.id]?.status === 'pass');
  return {
    pass,
    fail,
    skip,
    unchecked,
    total: ids.length,
    blockingPass,
    phase0Green: blockingPass && fail === 0,
  };
}

/**
 * Live stack probes — hints only. Never auto-mark Phase 0 pass.
 * @param {{ isActive?: boolean, isZombieCall?: boolean, captions?: any[], connectionState?: string, connectProgress?: object, micTestMode?: boolean, tabStreamReady?: boolean }} live
 */
export function probePhase0LiveStack(live = {}) {
  const dg = hasConfiguredDeepgramKey();
  const tr = getTranslationKeyStatus();
  const paidTranslate = !!(tr.deepl || tr.azure || tr.openai);
  const captions = Array.isArray(live.captions) ? live.captions : [];
  const finals = captions.filter((c) => c && c.isFinal !== false);
  const withTranslations = finals.filter((c) => {
    if (c.userTranslationOverride) return true;
    const t = c.translations;
    if (!t || typeof t !== 'object') return false;
    return Object.keys(t).length > 0;
  });
  const digitBlob = finals.map((c) => c.text || '').join(' ');
  const hasFakePhone = /555\D*123\D*4567|5551234567/.test(digitBlob.replace(/\s/g, ''));
  const splitBubbles = finals.filter((c) => c.isSplit).length;

  let sttTraceLen = 0;
  let perfMsgs = 0;
  try {
    if (typeof window !== 'undefined') {
      sttTraceLen = window.__catintSttTrace?.length || 0;
      perfMsgs = window.__ciaPerf?.deepgramMessages || 0;
    }
  } catch (_) {}

  return {
    deepgramKey: dg,
    paidTranslate,
    translateKeys: tr,
    isActive: !!live.isActive,
    isZombieCall: !!live.isZombieCall,
    connectionState: live.connectionState || 'unknown',
    audioHint: live.micTestMode
      ? 'mic'
      : live.tabStreamReady
        ? 'tab'
        : live.connectionState === 'connected'
          ? 'connected'
          : 'none',
    captionCount: captions.length,
    finalCount: finals.length,
    sealedTranslationCount: withTranslations.length,
    splitBubbleCount: splitBubbles,
    hasFakePhoneDigits: hasFakePhone,
    sttTraceLen,
    deepgramMessages: perfMsgs,
    connectProgress: live.connectProgress || null,
    version: APP_VERSION,
  };
}

export function isPhase0SmokeEnabled() {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.REACT_APP_DEV_TEST_HARNESS === 'true';
}
