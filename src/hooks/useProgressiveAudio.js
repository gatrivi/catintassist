import { useCallback, useRef, useMemo, useState } from 'react';

export const useProgressiveAudio = () => {
  const audioCtxRef = useRef(null);
  const [isMuted, setIsMuted] = useState(localStorage.getItem('AUDIO_MUTED') === 'true');

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('AUDIO_MUTED', next);
      return next;
    });
  }, []);

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
    g.gain.linearRampToValueAtTime(startVol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    return g;
  };

  const playBagOpen = useCallback(() => {
    if (isMuted) return;
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    const gain = createGain(ctx, 0.3, 0.5, t);
    gain.connect(ctx.destination);
    
    // Soft noise rustle
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0; i<d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600;
    noise.connect(filter); filter.connect(gain);
    noise.start(t); noise.stop(t + 0.4);
  }, [initAudio, isMuted]);

  const playCoin = useCallback((minuteCount = 1) => {
    if (isMuted) return;
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;

    // Warm Bronze Synthesis (Lower frequencies, Triangle waves for harmonics)
    // 800Hz - 1100Hz range is "heavy", 2000Hz+ is "beepy"
    const frequencies = [820, 1150, 1420]; 
    const fullness = Math.min(1, minuteCount / 60);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200 + (fullness * 2000), t); // Muffled for Cloth, opens for Pile
    filter.Q.setValueAtTime(0.3, t);

    frequencies.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; // Warm harmonics
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.98, t + 0.1); // Subtle mechanical de-tuning
      
      const decay = (minuteCount === 1 ? 0.08 : 0.12 + (fullness * 0.3));
      const gain = createGain(ctx, 0.08, decay, t);
      osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + decay + 0.05);
    });

    // Soft "thud" attack (Low-passed noise)
    const attackBuf = ctx.createBuffer(1, ctx.sampleRate * 0.015, ctx.sampleRate);
    const attackD = attackBuf.getChannelData(0);
    for(let i=0; i<attackD.length; i++) attackD[i] = Math.random() * 2 - 1;
    const attack = ctx.createBufferSource(); attack.buffer = attackBuf;
    const attackGain = createGain(ctx, 0.1, 0.015, t);
    const attackFilter = ctx.createBiquadFilter(); attackFilter.type = 'lowpass'; attackFilter.frequency.value = 400;
    attack.connect(attackFilter); attackFilter.connect(attackGain); attackGain.connect(ctx.destination);
    attack.start(t);
  }, [initAudio, isMuted]);

  const playTick = useCallback((minuteCount = 1) => { playCoin(minuteCount); }, [playCoin]);

  const playBill = useCallback(() => {
    if (isMuted) return;
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    const gain = createGain(ctx, 0.2, 0.15, t);
    gain.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0; i<d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 3000;
    noise.connect(filter); filter.connect(gain);
    noise.start(t); noise.stop(t + 0.15);
  }, [initAudio, isMuted]);

  const playDiamond = useCallback(() => {
    if (isMuted) return;
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    [2200, 2600].forEach(f => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(f, t);
      const gain = createGain(ctx, 0.04, 0.8, t);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.8);
    });
  }, [initAudio, isMuted]);

  const playMetalChest = useCallback(() => { /* Legacy */ }, []);
  const playCarriageVault = useCallback(() => { /* Legacy */ }, []);

  const stopAll = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.suspend().catch(() => {});
    }
  }, []);

  return useMemo(() => ({ 
    isMuted, toggleMute, initAudio, playBagOpen, playTick, playBill, playDiamond, playCoin, playMetalChest, playCarriageVault, stopAll 
  }), [isMuted, toggleMute, initAudio, playBagOpen, playTick, playBill, playDiamond, playCoin, stopAll]);
};
