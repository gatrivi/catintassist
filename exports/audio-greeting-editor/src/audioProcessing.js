/** Shared Web Audio speech chain for greetings record/playback. */

export function createSpeechProcessingGraph(audioCtx, sourceNode) {
  const highPass = audioCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 80;
  highPass.Q.value = 0.7;

  const clarityBoost = audioCtx.createBiquadFilter();
  clarityBoost.type = 'peaking';
  clarityBoost.frequency.value = 2500;
  clarityBoost.gain.value = 4.0;
  clarityBoost.Q.value = 1.2;

  const presenceBoost = audioCtx.createBiquadFilter();
  presenceBoost.type = 'peaking';
  presenceBoost.frequency.value = 4000;
  presenceBoost.gain.value = 2.0;
  presenceBoost.Q.value = 1.5;

  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.100;

  const outputGain = audioCtx.createGain();
  outputGain.gain.value = 1.0;

  sourceNode
    .connect(highPass)
    .connect(clarityBoost)
    .connect(presenceBoost)
    .connect(compressor)
    .connect(outputGain);

  return { highPass, clarityBoost, presenceBoost, compressor, outputGain };
}

export function createNoiseGate(audioCtx, sourceNode) {
  const gate = audioCtx.createDynamicsCompressor();
  gate.threshold.value = -50;
  gate.knee.value = 5;
  gate.ratio.value = 20;
  gate.attack.value = 0.001;
  gate.release.value = 0.150;
  sourceNode.connect(gate);
  return gate;
}
