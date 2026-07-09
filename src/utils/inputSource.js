/**
 * Audio / transcript InputSource kinds.
 * Live tab/mic/virtualCable behavior unchanged; mockStream/audioFile/fixture for harness.
 */
import {
  canUseTabCapture,
  readSelectedVirtualCableInputDeviceId,
  buildVirtualCableGetUserMediaConstraints,
} from "./audioSourceManager";

export const INPUT_SOURCE_KINDS = Object.freeze([
  "tab",
  "mic",
  "virtualCable",
  "mockStream",
  "audioFile",
  "fixture",
]);

const MIC_DEVICE_KEY = "CATINTASSIST_MIC_ID";

/** @typedef {'tab'|'mic'|'virtualCable'|'mockStream'|'audioFile'|'fixture'} InputSourceKind */

/**
 * Acquire a MediaStream (or null for fixture mode).
 * @param {InputSourceKind} kind
 * @param {{ fileUrl?: string, loop?: boolean }} [opts]
 * @returns {Promise<{ stream: MediaStream|null, kind: string, mode?: string }>}
 */
export async function acquireInputSource(kind, opts = {}) {
  const source = INPUT_SOURCE_KINDS.includes(kind) ? kind : "tab";

  if (source === "fixture") {
    return { stream: null, kind: "fixture", mode: "fixture" };
  }

  if (source === "mockStream") {
    return { stream: createSilentMockStream(), kind: "mockStream", mode: "mockStream" };
  }

  if (source === "audioFile") {
    const stream = await createAudioFileStream(opts.fileUrl, { loop: opts.loop !== false });
    return { stream, kind: "audioFile", mode: "audioFile" };
  }

  if (source === "mic") {
    let micId = null;
    try {
      micId = localStorage.getItem(MIC_DEVICE_KEY);
    } catch (_) {}
    const audio = micId
      ? {
          deviceId: { exact: micId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio });
    return { stream, kind: "mic" };
  }

  if (source === "virtualCable") {
    const deviceId = readSelectedVirtualCableInputDeviceId();
    const constraints = buildVirtualCableGetUserMediaConstraints(deviceId);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { stream, kind: "virtualCable" };
  }

  // Default: tab share
  if (!canUseTabCapture()) {
    const ex =
      typeof DOMException !== "undefined"
        ? new DOMException("Tab capture not supported in this browser", "NotSupportedError")
        : Object.assign(new Error("Tab capture not supported in this browser"), {
            name: "NotSupportedError",
          });
    throw ex;
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  return { stream, kind: "tab" };
}

/** Silent MediaStream — no getUserMedia / getDisplayMedia permission prompt. */
export function createSilentMockStream() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    throw new Error("AudioContext unavailable for mockStream");
  }
  const ctx = new AC();
  const dest = ctx.createMediaStreamDestination();
  // Keep context alive with a near-silent oscillator (muted gain).
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(dest);
  osc.start();
  const stream = dest.stream;
  stream.__catintMockCleanup = () => {
    try {
      osc.stop();
    } catch (_) {}
    try {
      ctx.close();
    } catch (_) {}
  };
  return stream;
}

/**
 * Loop an audio file into a MediaStream (optional live STT attach).
 * @param {string} fileUrl
 */
export async function createAudioFileStream(fileUrl, { loop = true } = {}) {
  if (!fileUrl) throw new Error("audioFile requires fileUrl");
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error("AudioContext unavailable for audioFile");

  const audio = new Audio(fileUrl);
  audio.crossOrigin = "anonymous";
  audio.loop = loop;
  await audio.play().catch(() => {});
  const ctx = new AC();
  const src = ctx.createMediaElementSource(audio);
  const dest = ctx.createMediaStreamDestination();
  src.connect(dest);
  // Also connect to destination so element can play if needed (gain 0 to avoid local echo).
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(gain);
  gain.connect(ctx.destination);

  const stream = dest.stream;
  stream.__catintMockCleanup = () => {
    try {
      audio.pause();
    } catch (_) {}
    try {
      ctx.close();
    } catch (_) {}
  };
  return stream;
}

/** Map legacy useDeepgram source strings → InputSourceKind. */
export function mapLegacySourceToKind(source) {
  if (source === "mic") return "mic";
  if (source === "virtualCable") return "virtualCable";
  return "tab";
}
