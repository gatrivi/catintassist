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
   * playCoinStack
   * Synthesizes a rapid sequence of coin sounds.
   * @param {number} count - Determines the length and richness of the 'crash'.
   */
  const playCoinStack = useCallback((count = 1) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    // SOUNDSCAPE INTERPRETER: "proportional stack of coins crashing into a purse"
    // We stagger the pings to create a "pour" effect.
    const stackSize = Math.min(15, Math.ceil(count / 2)); 
    for (let i = 0; i < stackSize; i++) {
        const delay = i * 60;
        setTimeout(() => {
            playChaChing(1 + (i / 3));
        }, delay);
    }
  }, [playChaChing]);

  return { initAudio, playChaChing, playCoinStack };
};
