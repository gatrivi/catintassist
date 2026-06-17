let runtimeDeepgramKey = null;

export const getRuntimeDeepgramKey = () => runtimeDeepgramKey;

export const setRuntimeDeepgramKey = (key) => {
  runtimeDeepgramKey = key || null;
  // Force React trees to re-render when the vault locks/unlocks.
  try {
    window.dispatchEvent(new Event("cat_deepgram_runtime_key_changed"));
  } catch (_) {}
};

