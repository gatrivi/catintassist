import { useCallback, useRef } from 'react';

export const useProgressiveAudio = () => {
  const audioCtxRef = useRef(null);

  // Initialize context on first user interaction to bypass browser autoplay blocks
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  const playTick = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    
    // Tiny subtle "ching" sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Base frequency is roughly a coin chink. Pitch up slightly to make it pleasant.
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(2000, t + 0.1);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.01); // Very subtle volume
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(t);
    osc.stop(t + 0.2);
  }, []);

  const playLeatherWallet = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    
    // A soft, low thud simulating coins dropping into a leather bag
    const osc = ctx.createOscillator();
    const noiseNode = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    
    // Create random noise texture for leather rustle
    const bufferSize = ctx.sampleRate * 0.3; // 0.3 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    noiseNode.buffer = buffer;
    
    // Low pass filter to muffle it like soft leather
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.6, t + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    
    osc.connect(gainNode);
    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(t);
    noiseNode.start(t);
    osc.stop(t + 0.3);
  }, []);

  const playMetalChest = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    // A solid, resonant metallic clank for the daily vault
    const t = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(300, t);
    osc1.frequency.exponentialRampToValueAtTime(100, t + 0.2);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(500, t);
    osc2.frequency.exponentialRampToValueAtTime(150, t + 0.3);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.6, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.5);
    osc2.stop(t + 0.5);
  }, []);

  const playCarriageVault = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    // A loud, clanking, complex metallic ringing (End of Month Armored Car)
    const t = ctx.currentTime;
    
    const freqs = [350, 480, 520, 800]; // Dissonant metallic triad
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.8);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.8 / freqs.length, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 1.2 + (idx * 0.2));
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.5);
    });
  }, []);

  const stopAll = useCallback(() => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  return { initAudio, playTick, playLeatherWallet, playMetalChest, playCarriageVault, stopAll };
};
