import { useState, useRef } from 'react';
import { useAudioSettings } from '../contexts/AudioSettingsContext';

export const useTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingUrl, setPlayingUrl] = useState(null);
  const activeAudioLocalRef = useRef(null);
  const activeAudioSinkRef = useRef(null);
  const { selectedSinkId, localVolume, sinkVolume } = useAudioSettings();

  const stopTTS = () => {
    if (activeAudioLocalRef.current) {
      activeAudioLocalRef.current.pause();
      activeAudioLocalRef.current = null;
    }
    if (activeAudioSinkRef.current) {
      activeAudioSinkRef.current.pause();
      activeAudioSinkRef.current = null;
    }
    window.__CAT_AUDIO_VOL = 0;
    setIsPlaying(false);
    setPlayingUrl(null);
  };

  const prefetchTTS = async (text, lang) => {
    if (!text) return null;
    try {
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
      return URL.createObjectURL(blob);
    } catch (err) {
      return null;
    }
  };

  const playTTS = async (text, lang, preloadedAudioUrl = null) => {
    if (!text && !preloadedAudioUrl) return;
    
    // Stop any currently playing audio before starting a new one
    stopTTS();
    
    setIsPlaying(true);
    try {
      let audioUrl = preloadedAudioUrl;
      if (!audioUrl) {
        audioUrl = await prefetchTTS(text, lang);
      }
      if (!audioUrl) {
        setIsPlaying(false);
        setPlayingUrl(null);
        return;
      }
      
      setPlayingUrl(audioUrl);
      
      const audioLocal = new Audio(audioUrl);
      const audioSink = new Audio(audioUrl);
      
      audioLocal.volume = localVolume;
      audioSink.volume = sinkVolume;

      activeAudioLocalRef.current = audioLocal;
      activeAudioSinkRef.current = audioSink;
      
      // Auto-route it directly into the Virtual Cable!
      if (audioSink.setSinkId && selectedSinkId) {
        try {
          await audioSink.setSinkId(selectedSinkId);
        } catch (e) {
          console.error("setSinkId failed, falling back to default:", e);
        }
      }
      
      const ttsTimer = setInterval(() => {
        if (!activeAudioLocalRef.current) {
          window.__CAT_AUDIO_VOL = 0;
          return clearInterval(ttsTimer);
        }
        window.__CAT_AUDIO_VOL = (40 + Math.random() * 60) * sinkVolume;
      }, 50);

      audioLocal.onended = () => {
        clearInterval(ttsTimer);
        window.__CAT_AUDIO_VOL = 0;
        setIsPlaying(false);
        setPlayingUrl(null);
        activeAudioLocalRef.current = null;
        activeAudioSinkRef.current = null;
      };
      audioSink.onended = () => {};
      
      audioLocal.play().catch(e => {
        clearInterval(ttsTimer);
        window.__CAT_AUDIO_VOL = 0;
        console.error("Local play error:", e);
      });
      if (selectedSinkId) {
        audioSink.play().catch(e => console.error("Sink play error:", e));
      }
    } catch (err) {
      window.__CAT_AUDIO_VOL = 0;
      setIsPlaying(false);
      setPlayingUrl(null);
    }
  };

  return { playTTS, prefetchTTS, stopTTS, isPlaying, playingUrl };
};
