/**
 * Time-track mirror in Firestore `users/{uid}/timetrack/main` (v4.99.0).
 * localStorage stays the durability source — this service only mirrors it so a
 * browser wipe or a second machine can restore the on/off-call day ledger.
 * Follows the settingsService pattern: one-shot getDoc/setDoc, no live listeners.
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import {
  buildTimeTrackSnapshot,
  mergeCloudDays,
  TIMETRACK_CHANGED_EVENT,
} from '../utils/timeTrackSync';

export const TIMETRACK_DOC_VERSION = 1;

const readLocalJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const timetrackDocRef = (uid) => (!db || !uid) ? null : doc(db, 'users', uid, 'timetrack', 'main');

/** Build today's snapshot from the localStorage durability keys. */
export const collectLocalTimeTrack = (todayStr = new Date().toDateString()) =>
  buildTimeTrackSnapshot({
    dailyLog: readLocalJson('catintassist_daily_log', {}),
    historyTimeline: readLocalJson('catintassist_history_timeline', {}),
    todayTimeline: readLocalJson('catintassist_timeline', []),
    stats: readLocalJson('catintassist_stats', {}),
    todayStr,
  });

export const pullTimeTrackFromCloud = async (uid) => {
  if (!isFirebaseConfigured() || !uid) return null;
  const ref = timetrackDocRef(uid);
  if (!ref) return null;
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

/** Merge a cloud pull into localStorage — missing past days only. Returns count. */
export const applyCloudTimeTrack = (cloudDoc, todayStr = new Date().toDateString()) => {
  const cloudDays = cloudDoc?.days && typeof cloudDoc.days === 'object' ? cloudDoc.days : {};
  const merged = mergeCloudDays({
    dailyLog: readLocalJson('catintassist_daily_log', {}),
    historyTimeline: readLocalJson('catintassist_history_timeline', {}),
    cloudDays,
    todayStr,
  });
  if (merged.imported === 0) return 0;
  try {
    localStorage.setItem('catintassist_daily_log', JSON.stringify(merged.dailyLog));
    localStorage.setItem('catintassist_history_timeline', JSON.stringify(merged.historyTimeline));
    window.dispatchEvent(new CustomEvent(TIMETRACK_CHANGED_EVENT, { detail: { imported: merged.imported } }));
  } catch {
    return 0;
  }
  return merged.imported;
};

// Dirty-check: skip identical pushes (free-tier writes are the budget).
let lastPushedJson = null;

/** Push a snapshot; skipped when nothing banked has changed since last push. */
export const pushTimeTrackToCloud = async (uid, todayStr = new Date().toDateString()) => {
  if (!isFirebaseConfigured() || !uid) return false;
  const ref = timetrackDocRef(uid);
  if (!ref) return false;
  const days = collectLocalTimeTrack(todayStr);
  const payload = JSON.stringify(days);
  if (payload === lastPushedJson) return false;
  await setDoc(ref, {
    v: TIMETRACK_DOC_VERSION,
    days,
    updatedAt: serverTimestamp(),
  });
  lastPushedJson = payload;
  return true;
};
