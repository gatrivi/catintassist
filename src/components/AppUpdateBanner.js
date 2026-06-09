import React, { useCallback, useEffect, useState } from 'react';
import { applyServiceWorkerUpdate, UPDATE_EVENT } from '../registerServiceWorker';

const STORAGE_KEY = 'catint_app_build_id';

export const AppUpdateBanner = () => {
  const [show, setShow] = useState(false);
  const [remoteBuild, setRemoteBuild] = useState('');

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const local = localStorage.getItem(STORAGE_KEY);
      if (!local) {
        localStorage.setItem(STORAGE_KEY, data.buildId);
        return;
      }
      if (data.buildId && data.buildId !== local) {
        setRemoteBuild(data.buildId);
        setShow(true);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    checkVersion();
    const onUpdate = () => {
      setShow(true);
      checkVersion();
    };
    window.addEventListener(UPDATE_EVENT, onUpdate);
    window.addEventListener('focus', checkVersion);
    const iv = setInterval(checkVersion, 5 * 60 * 1000);
    return () => {
      window.removeEventListener(UPDATE_EVENT, onUpdate);
      window.removeEventListener('focus', checkVersion);
      clearInterval(iv);
    };
  }, [checkVersion]);

  if (!show) return null;

  const handleUpdate = () => {
    if (remoteBuild) localStorage.setItem(STORAGE_KEY, remoteBuild);
    applyServiceWorkerUpdate();
    window.location.reload();
  };

  return (
    <div className="app-update-banner" role="alert">
      <span>New app version available</span>
      <button type="button" className="app-update-btn" onClick={handleUpdate}>
        Update
      </button>
      <button type="button" className="app-update-dismiss" onClick={() => setShow(false)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
};
