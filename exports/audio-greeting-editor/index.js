export { default as AudioEditorPanel } from './src/AudioEditorPanel.jsx';
export { WaveformCanvas } from './src/WaveformCanvas.jsx';
export { ClipWaveform } from './src/ClipWaveform.jsx';
export { buildWaveformPeaks, buildEditorPeaksFromBlob, buildEditorPeaks } from './src/waveformPeaks.js';
export { createSpeechProcessingGraph, createNoiseGate } from './src/audioProcessing.js';
export {
  formatTime,
  buildEditorPeaks as buildPeaksFromChannel,
  detectSilences,
  spliceAudioBuffer,
  pcmToWavBlob,
  audioBufferToBlob,
  decodeBlobToAudioBuffer,
  cropAudioBuffer,
  removeSilenceRegions,
} from './src/audioEditorCore.js';
