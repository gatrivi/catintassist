import React, { useEffect, useMemo, useState } from "react";
import {
  getRuntimeDeepgramKey,
  setRuntimeDeepgramKey,
  clearRememberedKey,
  getDeepgramKeyInfo,
  hasConflictingDeepgramKeys,
  hasBundledDeepgramKey,
} from "../utils/deepgramRuntimeKey";

// ==========================================
// CRYPTO UTILS (Native Web Crypto API)
// ==========================================

const bufferToBase64 = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

const base64ToBuffer = (base64) =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptToken(token, password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const aesKey = await deriveKey(password, salt);
  const encoder = new TextEncoder();

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(token),
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
  };
}

async function decryptToken(ciphertext64, salt64, iv64, password) {
  const ciphertext = base64ToBuffer(ciphertext64);
  const salt = base64ToBuffer(salt64);
  const iv = base64ToBuffer(iv64);

  const aesKey = await deriveKey(password, salt);
  const decoder = new TextDecoder();

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext,
  );

  return decoder.decode(decryptedBuffer);
}

const LG_KEYS = {
  cipher: "dg_cipher",
  salt: "dg_salt",
  iv: "dg_iv",
};

export default function DeepgramKeyVault({ embedded = false }) {
  const [apiKey, setApiKey] = useState("");
  const [password, setPassword] = useState("");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [keyInfo, setKeyInfo] = useState(getDeepgramKeyInfo);
  const [keyConflict, setKeyConflict] = useState(hasConflictingDeepgramKeys);

  const isKeySaved = useMemo(() => {
    try {
      return !!localStorage.getItem(LG_KEYS.cipher);
    } catch (_) {
      return false;
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      setUnlocked(!!getRuntimeDeepgramKey());
      setKeyInfo(getDeepgramKeyInfo());
      setKeyConflict(hasConflictingDeepgramKeys());
    };
    sync();
    window.addEventListener("cat_deepgram_runtime_key_changed", sync);
    return () =>
      window.removeEventListener("cat_deepgram_runtime_key_changed", sync);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    try {
      window.dispatchEvent(new Event("cat_vault_unlocking"));
      const encryptedData = await encryptToken(apiKey, password);

      localStorage.setItem(LG_KEYS.cipher, encryptedData.ciphertext);
      localStorage.setItem(LG_KEYS.salt, encryptedData.salt);
      localStorage.setItem(LG_KEYS.iv, encryptedData.iv);

      // Put raw key only into volatile runtime memory.
      setRuntimeDeepgramKey(apiKey.trim());
      setApiKey("");
      setPassword("");
      setUnlocked(true);
    } catch (_) {
      setError("Encryption failed.");
    }
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError("");
    try {
      window.dispatchEvent(new Event("cat_vault_unlocking"));
      const cipher = localStorage.getItem(LG_KEYS.cipher) || "";
      const salt = localStorage.getItem(LG_KEYS.salt) || "";
      const iv = localStorage.getItem(LG_KEYS.iv) || "";

      const rawKey = await decryptToken(
        cipher,
        salt,
        iv,
        unlockPassword,
      );

      setRuntimeDeepgramKey(rawKey);
      setUnlockPassword("");
      setUnlocked(true);
    } catch (_) {
      setError("Invalid password. Decryption failed.");
    }
  };

  const handleLock = () => {
    clearRememberedKey();
    setUnlocked(false);
    setUnlockPassword("");
  };

  const inner = (
    <>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: unlocked ? "#22c55e" : "#f59e0b",
              boxShadow: unlocked ? "0 0 10px rgba(34,197,94,0.6)" : "0 0 10px rgba(245,158,11,0.6)",
            }}
          />
          <h3 style={{ margin: 0, fontSize: 14 }}>
            Deepgram Key Vault
          </h3>
        </div>

        <p style={{ marginTop: 10, color: "rgba(255,255,255,0.75)", fontSize: 12 }}>
          Paste your Deepgram API key. Unlock remembered for 30 days on this device.
        </p>

        <p style={{ marginTop: 6, fontSize: 10, color: hasBundledDeepgramKey() ? '#86efac' : '#fbbf24' }}>
          {hasBundledDeepgramKey()
            ? 'Build key: configured via REACT_APP_DEEPGRAM_API_KEY (this deploy).'
            : 'Build key: not in this bundle — set REACT_APP_DEEPGRAM_API_KEY on Vercel (Production) and redeploy, or paste your own key below.'}
        </p>

        {keyInfo.key && (
          <p style={{ marginTop: 8, fontSize: 11, color: '#93c5fd' }}>
            Active key: from{' '}
            {keyInfo.source === 'runtime'
              ? 'Settings'
              : keyInfo.source === 'env'
                ? '.env file'
                : 'saved storage'}{' '}
            ({keyInfo.masked})
          </p>
        )}
        {keyConflict && (
          <p style={{ marginTop: 6, fontSize: 11, color: '#fbbf24' }}>
            Settings key and .env key differ — Settings wins. Remove or fix .env if confused.
          </p>
        )}
        <p style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
          Restart the app after changing .env (npm start again).
        </p>

        {error && (
          <p style={{ color: "#ff6b6b", fontSize: 12, marginTop: 8 }}>
            ⚠️ {error}
          </p>
        )}

        {!isKeySaved && !unlocked && (
          <form
            onSubmit={handleSave}
            style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}
          >
            <h4 style={{ margin: 0, fontSize: 13, color: "#93c5fd" }}>
              Initial Setup
            </h4>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
              Deepgram API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="dg_..."
              style={{ padding: 10, background: "#111827", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
              required
            />

            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
              Master Password (encrypt/decrypt)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="remember this"
              style={{ padding: 10, background: "#111827", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
              required
            />

            <button
              type="submit"
              style={{ padding: 10, background: "#16a34a", color: "#fff", border: "none", cursor: "pointer", borderRadius: 8, fontWeight: 800 }}
            >
              Encrypt & Unlock
            </button>
          </form>
        )}

        {isKeySaved && !unlocked && (
          <form
            onSubmit={handleUnlock}
            style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}
          >
            <h4 style={{ margin: 0, fontSize: 13, color: "#93c5fd" }}>
              Vault Locked
            </h4>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
              Encrypted token is stored locally. Enter the master password to unlock.
            </p>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
              Master Password
            </label>
            <input
              type="password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              placeholder="••••••••"
              style={{ padding: 10, background: "#111827", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
              required
            />
            <button
              type="submit"
              style={{ padding: 10, background: "#0284c7", color: "#fff", border: "none", cursor: "pointer", borderRadius: 8, fontWeight: 800 }}
            >
              Unlock
            </button>
          </form>
        )}

        {unlocked && (
          <div
            style={{
              marginTop: 12,
              border: "1px solid rgba(34,197,94,0.35)",
              padding: 12,
              background: "rgba(34,197,94,0.08)",
              borderRadius: 10,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 13, color: "#22c55e" }}>✓ Unlocked</h4>
            <p style={{ marginTop: 8, color: "rgba(255,255,255,0.72)", fontSize: 12 }}>
              Key unlocked for 30 days on this device. Press Lock to clear.
            </p>
            <button
              onClick={handleLock}
              style={{ marginTop: 10, padding: "8px 12px", background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", borderRadius: 8, fontWeight: 800 }}
            >
              Lock (Clear Session)
            </button>
          </div>
        )}
    </>
  );

  if (embedded) return inner;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(520px, 96vw)",
          background: "#0b1220",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 16,
          color: "#fff",
          fontFamily: "monospace",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {inner}
      </div>
    </div>
  );
}

