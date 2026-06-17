let runtimeDeepgramKey = null;

export const getRuntimeDeepgramKey = () => runtimeDeepgramKey;

export const isValidDeepgramApiKey = (key) => {
  if (!key || typeof key !== "string") return false;
  const k = key.trim();
  if (!k) return false;
  if (k === "your_deepgram_api_key_here") return false;
  // Deepgram tokens are long; avoid treating random short strings/placeholders as valid.
  if (k.length < 10) return false;
  return true;
};

export const setRuntimeDeepgramKey = (key) => {
  runtimeDeepgramKey = key || null;
  // Force React trees to re-render when the vault locks/unlocks.
  try {
    window.dispatchEvent(new Event("cat_deepgram_runtime_key_changed"));
  } catch (_) {}
};

