import { useCallback, useEffect, useMemo, useState } from "react";
import { useAudioSettings } from "../contexts/AudioSettingsContext";
import {
  AUDIO_SOURCE_MODE_TAB,
  AUDIO_SOURCE_MODE_VIRTUAL_CABLE,
  readAudioSourceMode,
  persistAudioSourceMode,
  readSelectedVirtualCableInputDeviceId,
  persistSelectedVirtualCableInputDeviceId,
  buildVirtualCableGetUserMediaConstraints,
  refreshInputDevices as refreshInputDevicesUtil,
} from "../utils/audioSourceManager";

export const useAudioSource = () => {
  const { inputDevices, fetchDevices } = useAudioSettings();

  const [currentSourceMode, setCurrentSourceMode] = useState(() =>
    readAudioSourceMode(),
  );
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState(() =>
    readSelectedVirtualCableInputDeviceId(),
  );

  // Keep it snappy: if device labels were hidden and we need them, refresh.
  const refreshInputDevices = useCallback(async () => {
    // AudioSettingsContext has its own “request permission if labels blank” logic.
    try {
      await fetchDevices({ requestMicPermissionForLabels: true });
      return;
    } catch (_) {
      // Fallback for edge cases: call util refresh directly.
    }
    try {
      await refreshInputDevicesUtil({});
    } catch (_) {}
  }, [fetchDevices]);

  useEffect(() => {
    if (currentSourceMode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE) {
      // Labels are often blank until first permission prompt.
      refreshInputDevices();
    }
  }, [currentSourceMode, refreshInputDevices]);

  // Cross-component sync (SettingsPanel ↔ App/headers) without relying on storage events.
  useEffect(() => {
    const onMode = (e) => {
      const next = e?.detail?.mode;
      if (next !== AUDIO_SOURCE_MODE_TAB && next !== AUDIO_SOURCE_MODE_VIRTUAL_CABLE) return;
      setCurrentSourceMode(next);
    };
    window.addEventListener("catint_audio_source_mode_changed", onMode);
    return () => window.removeEventListener("catint_audio_source_mode_changed", onMode);
  }, []);

  const switchAudioSourceMode = useCallback(
    (mode) => {
      const next =
        mode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE
          ? AUDIO_SOURCE_MODE_VIRTUAL_CABLE
          : AUDIO_SOURCE_MODE_TAB;
      setCurrentSourceMode(next);
      persistAudioSourceMode(next);
      try {
        window.dispatchEvent(
          new CustomEvent("catint_audio_source_mode_changed", { detail: { mode: next } }),
        );
      } catch (_) {}
    },
    [setCurrentSourceMode],
  );

  const refreshSelectedDeviceId = useCallback((deviceId) => {
    setSelectedInputDeviceId(deviceId || "");
    persistSelectedVirtualCableInputDeviceId(deviceId || "");
  }, []);

  const startAudioSource = useCallback(async () => {
    if (currentSourceMode === AUDIO_SOURCE_MODE_VIRTUAL_CABLE) {
      const constraints = buildVirtualCableGetUserMediaConstraints(selectedInputDeviceId || "");
      return navigator.mediaDevices.getUserMedia(constraints);
    }
    // Tab-share requires a user gesture and comes from getDisplayMedia,
    // so this is intentionally not auto-called from the settings panel.
    throw new Error("Tab share capture must be initiated from the Connect button.");
  }, [currentSourceMode, selectedInputDeviceId]);

  const stopAudioSource = useCallback((stream) => {
    try {
      stream?.getTracks?.().forEach((t) => t.stop());
    } catch (_) {}
  }, []);

  const availableInputDevices = useMemo(() => inputDevices || [], [inputDevices]);

  return {
    currentSourceMode,
    availableInputDevices,
    selectedInputDeviceId,
    refreshInputDevices,
    startAudioSource,
    stopAudioSource,
    switchAudioSourceMode,
    refreshSelectedDeviceId,
  };
};

