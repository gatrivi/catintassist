import { useState, useRef } from 'react';
import { useAudioSettings } from '../contexts/AudioSettingsContext';

export const useTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const activeAudioRef = useRef(null);
  const { selectedSinkId } = useAudioSettings();

  const stopTTS = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setIsPlaying(false);
  };

  const playTTS = async (text, lang) => {
    if (!text) return;
    
    // Stop any currently playing audio before starting a new one
    stopTTS();
    
    setIsPlaying(true);
    try {
      // Use the newly cloned custom voices. Fallback to default if they fail.
      const voiceId = lang === 'es' ? 'default-p8cwhu21piysovy7xa6dwg__catspa0' : 'default-p8cwhu21piysovy7xa6dwg__cateng0';
      const url = 'https://api.inworld.ai/tts/v1/voice';
      const options = {
        method: 'POST',
        headers: {
          'Authorization': 'Basic a3M3bXFtUWlxakcwbmF1cTRYR0Z5emRFcGNJbGRzMVU6TmdiZkVFU2ZsQll1b0t6aFM5S2Vhb1BJMGxLbTNTNWwyNGJXYUY1Q3RCaVFKM2hSSlp0RDEwdXpkVTVkVWY0eQ==',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voiceId,
          modelId: "inworld-tts-1.5-max",
          timestampType: "WORD",
          speakingRate: 1,
          temperature: 1
        }),
      };
      
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const result = await res.json();
      
      const byteCharacters = atob(result.audioContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      activeAudioRef.current = audio;
      
      // Auto-route it directly into the Virtual Cable!
      if (audio.setSinkId && selectedSinkId) {
        try {
          await audio.setSinkId(selectedSinkId);
        } catch (e) {
          console.error("setSinkId failed, falling back to default:", e);
        }
      }
      
      audio.onended = () => {
        setIsPlaying(false);
        activeAudioRef.current = null;
      };
      
      audio.play();
    } catch (err) {
      console.error("TTS Error:", err);
      setIsPlaying(false);
    }
  };

  return { playTTS, stopTTS, isPlaying };
};
