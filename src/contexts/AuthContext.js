import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase';
import {
  collectLocalSettings,
  importLocalSettingsToCloud,
  markImportDoneForUser,
  pullSettingsFromCloud,
  pushSettingsToCloud,
  shouldOfferImport,
} from '../services/settingsService';
import {
  importLocalSoundboardToCloud,
  pullSoundboardFromCloud,
  pushSoundboardToCloud,
} from '../services/soundboardMetaService';
import {
  applyCloudTimeTrack,
  pullTimeTrackFromCloud,
  pushTimeTrackToCloud,
} from '../services/timeTrackService';

const AuthContext = createContext(null);
const PUSH_INTERVAL_MS = 45000;
const REPULL_MIN_GAP_MS = 2 * 60 * 1000; // v4.139.0: focus re-pull throttle

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured());
  const [authError, setAuthError] = useState(null);
  const [syncState, setSyncState] = useState('idle'); // idle | pulling | pushing | error
  const [importPrompt, setImportPrompt] = useState(null);
  const pushTimerRef = useRef(null);
  const lastPullAtRef = useRef(0);

  const pushCloud = useCallback(async (uid) => {
    if (!uid) return;
    setSyncState('pushing');
    try {
      await pushSettingsToCloud(uid, collectLocalSettings());
      await pushSoundboardToCloud(uid);
      await pushTimeTrackToCloud(uid); // v4.99.0: day ledger mirror (dirty-checked)
      setSyncState('idle');
      setAuthError(null);
    } catch (err) {
      console.warn('Cloud push failed:', err);
      setSyncState('error');
      setAuthError(err?.message || 'Cloud sync failed');
    }
  }, []);

  // One pull of settings + soundboard + timetrack. Used at sign-in and on
  // window focus (v4.139.0) so an alternated browser/Pake session sees fresh minutes.
  const pullCloud = useCallback(async (uid) => {
    setSyncState('pulling');
    try {
      const cloudDoc = await pullSettingsFromCloud(uid);
      await pullSoundboardFromCloud(uid);
      // v4.99.0: restore the on/off-call day ledger (missing past days only).
      try {
        const cloudTimeTrack = await pullTimeTrackFromCloud(uid);
        if (cloudTimeTrack) applyCloudTimeTrack(cloudTimeTrack);
      } catch (ttErr) {
        console.warn('Time-track pull failed:', ttErr);
      }
      if (shouldOfferImport(uid, cloudDoc)) {
        setImportPrompt({ uid, keyCount: Object.keys(collectLocalSettings()).length });
      } else {
        setImportPrompt(null);
      }
      lastPullAtRef.current = Date.now();
      setSyncState('idle');
      setAuthError(null);
    } catch (err) {
      console.warn('Cloud pull failed:', err);
      setSyncState('error');
      setAuthError(err?.message || 'Cloud sync failed');
    }
  }, []);

  const handleSignedIn = useCallback(async (nextUser) => {
    const uid = nextUser?.uid;
    if (!uid) return;
    await pullCloud(uid);
  }, [pullCloud]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setAuthReady(true);
      return undefined;
    }

    // v4.139.0: surface redirect sign-in failures (Pake popup fallback path).
    getRedirectResult(auth).catch((err) => {
      setAuthError(err?.message || 'Google sign-in failed');
    });

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        await handleSignedIn(nextUser);
      } else {
        setImportPrompt(null);
        setSyncState('idle');
      }
    });

    return () => unsub();
  }, [handleSignedIn]);

  useEffect(() => {
    if (!user?.uid) {
      if (pushTimerRef.current) clearInterval(pushTimerRef.current);
      return undefined;
    }

    const uid = user.uid;
    pushTimerRef.current = setInterval(() => {
      pushCloud(uid);
    }, PUSH_INTERVAL_MS);

    const onUnload = () => {
      pushSettingsToCloud(uid, collectLocalSettings()).catch(() => {});
      pushSoundboardToCloud(uid).catch(() => {});
      pushTimeTrackToCloud(uid).catch(() => {});
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      if (pushTimerRef.current) clearInterval(pushTimerRef.current);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [user, pushCloud]);

  // v4.139.0: alternating browser/Pake use — re-pull on focus after a gap so
  // this instance shows the minutes the other one banked (missing-days merge only).
  useEffect(() => {
    if (!user?.uid) return undefined;
    const uid = user.uid;
    const onFocus = () => {
      if (Date.now() - lastPullAtRef.current < REPULL_MIN_GAP_MS) return;
      pullCloud(uid);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, pullCloud]);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured() || !auth || !googleProvider) {
      setAuthError('Firebase is not configured. Add REACT_APP_FIREBASE_* env vars.');
      return null;
    }
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') return null;
      // v4.139.0: Pake/WebView2 may block popups — fall back to full-page redirect.
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(err?.code)) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return null; // page redirects; session resumes via onAuthStateChanged
        } catch (redirectErr) {
          setAuthError(redirectErr?.message || 'Google sign-in failed');
          throw redirectErr;
        }
      }
      setAuthError(err?.message || 'Google sign-in failed');
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    if (user?.uid) await pushCloud(user.uid);
    await firebaseSignOut(auth);
    setImportPrompt(null);
  }, [user, pushCloud]);

  const confirmImport = useCallback(async () => {
    const uid = importPrompt?.uid || user?.uid;
    if (!uid) return 0;
    setSyncState('pushing');
    try {
      const settingsCount = await importLocalSettingsToCloud(uid);
      await importLocalSoundboardToCloud(uid);
      setImportPrompt(null);
      setSyncState('idle');
      return settingsCount;
    } catch (err) {
      setSyncState('error');
      setAuthError(err?.message || 'Import failed');
      throw err;
    }
  }, [importPrompt, user]);

  const dismissImport = useCallback(() => {
    const uid = importPrompt?.uid || user?.uid;
    if (uid) markImportDoneForUser(uid);
    setImportPrompt(null);
  }, [importPrompt, user]);

  const value = useMemo(
    () => ({
      user,
      uid: user?.uid || null,
      authReady,
      authConfigured: isFirebaseConfigured(),
      authError,
      syncState,
      importPrompt,
      signInWithGoogle,
      signOut,
      confirmImport,
      dismissImport,
      pushCloud: () => (user?.uid ? pushCloud(user.uid) : Promise.resolve()),
    }),
    [user, authReady, authError, syncState, importPrompt, signInWithGoogle, signOut, confirmImport, dismissImport, pushCloud],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
