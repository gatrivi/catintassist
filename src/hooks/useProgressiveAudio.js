import { useCallback, useRef, useMemo } from 'react';

export const useProgressiveAudio = () => {
  const audioCtxRef = useRef(null);

  const initAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  const createGain = (ctx, startVol, duration, t) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(startVol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    return g;
  };

  const playBagOpen = useCallback(() => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    
    // Leather rustle (Brown noise)
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 400;
    
    const gain = createGain(ctx, 0.4, 0.5, t);
    noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    noise.start(t); noise.stop(t + 0.5);

    // Initial Jangle
    for(let i=0; i<5; i++) {
      const osc = ctx.createOscillator();
      const g = createGain(ctx, 0.1, 0.2, t + (i * 0.05));
      osc.frequency.setValueAtTime(2000 + (i * 500), t);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t + (i * 0.05)); osc.stop(t + 0.3);
    }
  }, [initAudio]);

  const playCoin = useCallback((minuteCount = 1) => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;

    // Metallic Inharmonicity (Coins ring at multiple peaks)
    const frequencies = [2400, 3100, 3900];
    const fullness = Math.min(1, minuteCount / 60);

    // Filter shifts from low-muffled (cloth) to high-ringing (metal-on-metal)
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600 + (fullness * 2000), t);
    filter.Q.setValueAtTime(0.5 + (fullness * 6), t);

    frequencies.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      const decay = (minuteCount === 1 ? 0.08 : 0.2 + (fullness * 0.4)) / (idx + 1);
      const gain = createGain(ctx, 0.1, decay, t);
      osc.connect(filter);
      osc.start(t); osc.stop(t + decay + 0.1);
    });

    filter.connect(ctx.destination);
  }, [initAudio]);

  const playTick = useCallback((minuteCount = 1) => {
    playCoin(minuteCount);
  }, [playCoin]);

  const playBill = useCallback(() => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 2000;
    const gain = createGain(ctx, 0.4, 0.15, t);
    noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    noise.start(t); noise.stop(t + 0.15);
  }, [initAudio]);

  const playDiamond = useCallback(() => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    const oscClick = ctx.createOscillator();
    oscClick.type = 'square'; oscClick.frequency.setValueAtTime(6000, t);
    const gainClick = createGain(ctx, 0.1, 0.02, t);
    oscClick.connect(gainClick); gainClick.connect(ctx.destination);
    oscClick.start(t); oscClick.stop(t + 0.02);
    [3200, 3800].forEach(f => {
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.setValueAtTime(f, t);
      const gain = createGain(ctx, 0.05, 1.2, t);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 1.2);
    });
  }, [initAudio]);

  const playMetalChest = useCallback(() => { /* Solid resonance */ }, [initAudio]);
  const playCarriageVault = useCallback(() => { /* Massive resonance */ }, [initAudio]);

  const stopAll = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.suspend().catch(() => {});
    }
  }, []);

  return useMemo(() => ({ 
    initAudio, playBagOpen, playTick, playBill, playDiamond, playCoin, playMetalChest, playCarriageVault, stopAll 
  }), [initAudio, playBagOpen, playTick, playBill, playDiamond, playCoin, playMetalChest, playCarriageVault, stopAll]);
};
