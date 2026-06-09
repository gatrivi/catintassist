import { useCallback, useEffect, useRef, useState } from 'react';

const LAST_SEEN_KEY = 'catintassist_last_asset_manifest_token_v1';
const DISMISSED_KEY = 'catintassist_update_dismissed_token_v1';

const getTokenFromAssetManifest = (manifestJson) => {
  if (!manifestJson) return null;

  // CRA asset-manifest.json typically has { files: { 'main.js': 'static/js/main.<hash>.js', ... }, entrypoints: [...] }
  const files = manifestJson.files || manifestJson;
  if (!files || typeof files !== 'object') return manifestJson.version || null;

  const main = files['main.js'] || files['static/js/main.js'];
  if (typeof main === 'string' && main.trim()) return main;

  // Fallback: return the first hashed JS bundle string we can find.
  const candidates = Object.values(files).filter((v) => typeof v === 'string' && v.includes('.js'));
  if (candidates.length > 0) return candidates[0];

  return manifestJson.version || null;
};

export const useAppUpdateCheck = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersionToken, setLatestVersionToken] = useState(null);
  const intervalRef = useRef(null);
  const inFlightRef = useRef(false);

  const checkNow = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch('/asset-manifest.json', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;

      const manifestJson = await res.json();
      const token = getTokenFromAssetManifest(manifestJson);
      if (!token) return;

      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      const dismissed = localStorage.getItem(DISMISSED_KEY);

      // Token changed → new build detected.
      if (token !== lastSeen) {
        localStorage.setItem(LAST_SEEN_KEY, token);
        setLatestVersionToken(token);
        setUpdateAvailable(token !== dismissed);
      } else {
        // Same token → clear banner (unless user dismissed a newer one, which can't happen with same token).
        setUpdateAvailable(false);
      }
    } catch {
      // Silent: update polling should never block call UX.
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Initial check + periodic polling.
    checkNow();
    intervalRef.current = setInterval(checkNow, 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkNow]);

  const dismissUpdate = useCallback(() => {
    if (!latestVersionToken) {
      setUpdateAvailable(false);
      return;
    }
    try {
      localStorage.setItem(DISMISSED_KEY, latestVersionToken);
    } catch {}
    setUpdateAvailable(false);
  }, [latestVersionToken]);

  const reloadToUpdate = useCallback(() => {
    if (!latestVersionToken) return;
    try {
      // Prevent the banner from re-showing after reload.
      localStorage.setItem(LAST_SEEN_KEY, latestVersionToken);
      localStorage.setItem(DISMISSED_KEY, latestVersionToken);
    } catch {}
    window.location.reload();
  }, [latestVersionToken]);

  return { updateAvailable, latestVersionToken, dismissUpdate, reloadToUpdate };
};

