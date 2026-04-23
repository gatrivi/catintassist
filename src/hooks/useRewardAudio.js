import { useRef, useCallback } from 'react';

export const useRewardAudio = () => {
  const audioCtxRef = useRef(null);

  // Must be called on the INITIAL "Connect" button click
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    // Resumes context if the browser suspended it
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  /**
   * playChaChing
   * Synthesizes a reward sound. 
   * @param {number} level - Progressively richer harmonics (1-10+)
   */
  const playChaChing = useCallback((level = 1) => {
    if (!audioCtxRef.current) return;
    
    const ctx = audioCtxRef.current;
    
    // SOUNDSCAPE INTERPRETER: 
    // Higher levels add more oscillators for a "richer" sound as minutes pass.
    const harmonicCount = Math.min(5, Math.floor((level - 1) / 5) + 1);
    
    for (let i = 0; i < harmonicCount; i++) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // Stagger frequencies for a richer chime effect
        const baseFreq = 1200 + (i * 440);
        const timeOffset = i * 0.02;

        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime + timeOffset);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, ctx.currentTime + 0.1 + timeOffset);

        gainNode.gain.setValueAtTime(0, ctx.currentTime + timeOffset);
        gainNode.gain.linearRampToValueAtTime(0.5 / harmonicCount, ctx.currentTime + 0.05 + timeOffset);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5 + timeOffset);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(ctx.currentTime + timeOffset);
        osc.stop(ctx.currentTime + 0.5 + timeOffset);
    }
  }, []);

  /**
   * playPurseOpen
   * Synthesizes a "purse opening" sound (zip + metallic click).
   */
  const playPurseOpen = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const time = ctx.currentTime;
    
    // Zip sound
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(200, time);
    osc1.frequency.exponentialRampToValueAtTime(1200, time + 0.15);
    gain1.gain.setValueAtTime(0, time);
    gain1.gain.linearRampToValueAtTime(0.1, time + 0.05);
    gain1.gain.linearRampToValueAtTime(0, time + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(time);
    osc1.stop(time + 0.15);

    // Satisfying "clink"
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(4500, time + 0.14);
    gain2.gain.setValueAtTime(0, time + 0.14);
    gain2.gain.linearRampToValueAtTime(0.3, time + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, time + 0.25);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(time + 0.14);
    osc2.stop(time + 0.25);
  }, []);

  /**
   * playCoinStack
   * Synthesizes a rapid sequence of coin sounds for a 'crash' effect.
   * @param {number} mins - Determines the length and richness of the 'crash'.
   */
  const playCoinStack = useCallback((mins = 1) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    // PRO LADDER: Proportional crash based on minutes banked
    const count = Math.min(30, Math.ceil(mins * 0.8)); 
    for (let i = 0; i < count; i++) {
        const delay = i * 0.04;
        const time = ctx.currentTime + delay;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        const freq = 1800 + (Math.random() * 2200);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.4, time + 0.15);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.15);
    }
  }, []);

  return { initAudio, playChaChing, playCoinStack, playPurseOpen };
};
