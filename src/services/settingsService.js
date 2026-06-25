/** Cloud-syncable prefs only — no transcripts, stats, API keys, or notes. v4.74.0 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { LANG_PAIR_CHANGED_EVENT } from '../utils/languageConfig';

export const SETTINGS_DOC_VERSION = 1;
export const SETTINGS_CHANGED_EVENT = 'cat_cloud_settings_changed';

/** localStorage keys safe to mirror in Firestore users/{uid}/settings/main */
export const CLOUD_SYNC_KEYS = [
  'catint_lang_pair_v1',
  'CATINTASSIST_SINK_ID',
  'CATINTASSIST_MIC_ID',
  'CATINTASSIST_LOCAL_VOL',
  'CATINTASSIST_SINK_VOL',
  'AUDIO_MUTED',
  'catint_trans_mood',
  'catint_speech_auto_v1',
  'catint_call_detect',
  'catint_call_focus',
  'catint_auto_attach_enabled_v1',
  'catint_toolbar_visible',
  'catint_notes_open',
  'catintassist_visible_cards',
  'catint_component_visibility_v1',
  'catint_scoreboard_preset_v1',
  'catint_visible_metrics_v1',
  'catint_onboarding_anim_disabled_v1',
  'catint_personal_dock',
  'catint_default_bg_index_v1',
  'catint_workspace_view',
  'catint_workspace_initialized',
  'catint_studio_hint_seen',
  'catint_guide_lang_v1',
  'catint_off_call_metrics_expanded_v1',
];

const IMPORT_DONE_PREFIX = 'catint_cloud_import_done_';

const dispatchSettingsChanged = () => {
  try {
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(LANG_PAIR_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent('cat_component_visibility_changed'));
    window.dispatchEvent(new CustomEvent('cat_wellbeing_dock_changed'));
  } catch {
    /* ignore */
  }
};

export const collectLocalSettings = () => {
  const local = {};
  if (typeof window === 'undefined') return local;
  CLOUD_SYNC_KEYS.forEach((key) => {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) local[key] = value;
    } catch {
      /* ignore */
    }
  });
  return local;
};

export const hasLocalSettingsToImport = () => Object.keys(collectLocalSettings()).length > 0;

export const applySettingsToLocal = (localMap = {}) => {
  if (typeof window === 'undefined') return 0;
  let count = 0;
  CLOUD_SYNC_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(localMap, key)) return;
    try {
      localStorage.setItem(key, localMap[key]);
      count += 1;
    } catch {
      /* ignore */
    }
  });
  if (count > 0) dispatchSettingsChanged();
  return count;
};

export const settingsDocRef = (uid) => {
  if (!db || !uid) return null;
  return doc(db, 'users', uid, 'settings', 'main');
};

export const isImportDoneForUser = (uid) => {
  if (!uid) return true;
  try {
    return localStorage.getItem(`${IMPORT_DONE_PREFIX}${uid}`) === '1';
  } catch {
    return false;
  }
};

export const markImportDoneForUser = (uid) => {
  if (!uid) return;
  try {
    localStorage.setItem(`${IMPORT_DONE_PREFIX}${uid}`, '1');
  } catch {
    /* ignore */
  }
};

export const pullSettingsFromCloud = async (uid) => {
  if (!isFirebaseConfigured() || !uid) return null;
  const ref = settingsDocRef(uid);
  if (!ref) return null;
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  const localMap = data?.local && typeof data.local === 'object' ? data.local : {};
  applySettingsToLocal(localMap);
  return { ...data, local: localMap };
};

export const pushSettingsToCloud = async (uid, localMap = collectLocalSettings()) => {
  if (!isFirebaseConfigured() || !uid) return false;
  const ref = settingsDocRef(uid);
  if (!ref) return false;
  await setDoc(
    ref,
    {
      v: SETTINGS_DOC_VERSION,
      local: localMap,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return true;
};

/** First login: merge browser prefs into empty cloud doc. */
export const importLocalSettingsToCloud = async (uid) => {
  const localMap = collectLocalSettings();
  await pushSettingsToCloud(uid, localMap);
  markImportDoneForUser(uid);
  return Object.keys(localMap).length;
};

export const shouldOfferImport = (uid, cloudDoc) => {
  if (!uid || isImportDoneForUser(uid)) return false;
  if (cloudDoc?.local && Object.keys(cloudDoc.local).length > 0) {
    markImportDoneForUser(uid);
    return false;
  }
  return hasLocalSettingsToImport();
};
