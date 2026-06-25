import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
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

const AuthContext = createContext(null);
const PUSH_INTERVAL_MS = 45000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured());
  const [authError, setAuthError] = useState(null);
  const [syncState, setSyncState] = useState('idle'); // idle | pulling | pushing | error
  const [importPrompt, setImportPrompt] = useState(null);
  const pushTimerRef = useRef(null);

  const pushCloud = useCallback(async (uid) => {
    if (!uid) return;
    setSyncState('pushing');
    try {
      await pushSettingsToCloud(uid, collectLocalSettings());
      await pushSoundboardToCloud(uid);
      setSyncState('idle');
      setAuthError(null);
    } catch (err) {
      console.warn('Cloud push failed:', err);
      setSyncState('error');
      setAuthError(err?.message || 'Cloud sync failed');
    }
  }, []);

  const handleSignedIn = useCallback(async (nextUser) => {
    const uid = nextUser?.uid;
    if (!uid) return;
    setSyncState('pulling');
    try {
      const cloudDoc = await pullSettingsFromCloud(uid);
      await pullSoundboardFromCloud(uid);
      if (shouldOfferImport(uid, cloudDoc)) {
        setImportPrompt({ uid, keyCount: Object.keys(collectLocalSettings()).length });
      } else {
        setImportPrompt(null);
      }
      setSyncState('idle');
      setAuthError(null);
    } catch (err) {
      console.warn('Cloud pull failed:', err);
      setSyncState('error');
      setAuthError(err?.message || 'Cloud sync failed');
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setAuthReady(true);
      return undefined;
    }

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
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      if (pushTimerRef.current) clearInterval(pushTimerRef.current);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [user, pushCloud]);

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
