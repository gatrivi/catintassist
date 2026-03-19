import { useState, useRef, useCallback, useEffect } from 'react';

export const useDeepgram = () => {
  const [captions, setCaptions] = useState([]);
  const [sttLanguage, setSttLanguage] = useState('en'); // 'en' or 'es'
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isActiveRef = useRef(false);

  // We need a helper to safely close the existing socket if we are changing languages mid-stream
  const closeConnections = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const startDeepgram = (stream, lang) => {
    const API_KEY = process.env.REACT_APP_DEEPGRAM_API_KEY;
    if (!API_KEY || API_KEY.trim() === '' || API_KEY === 'your_deepgram_api_key_here') {
      alert("Deepgram API Key is missing or invalid in .env!");
      return false;
    }

    socketRef.current = new WebSocket(`wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=${lang}&interim_results=true&endpointing=300`, [
      'token',
      API_KEY,
    ]);

    socketRef.current.onopen = () => {
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0 && socketRef.current?.readyState === 1) {
          socketRef.current.send(event.data);
        }
      });
      mediaRecorderRef.current.start(250);
    };

    socketRef.current.onmessage = (message) => {
      const received = JSON.parse(message.data);
      const transcript = received.channel?.alternatives?.[0]?.transcript;
      const isFinal = received.is_final;

      if (transcript) {
        setCaptions(prev => {
          const last = prev[prev.length - 1];
          if (last && !last.isFinal) {
            const newArr = [...prev];
            newArr[newArr.length - 1] = { text: transcript, isFinal, lang: lang };
            return newArr;
          } else {
            return [...prev, { text: transcript, isFinal, lang: lang }];
          }
        });
      }
    };

    socketRef.current.onerror = (error) => {
      console.error("Deepgram WebSocket Error: ", error);
    };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      if (stream.getAudioTracks().length === 0) {
        alert("No audio track detected! You must check the 'Share tab audio' toggle when selecting the Chrome tab.");
        stream.getTracks().forEach(track => track.stop());
        return false;
      }

      streamRef.current = stream;
      isActiveRef.current = true;
      startDeepgram(stream, sttLanguage);

      stream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };
      return true;
    } catch (err) {
      console.error("Error capturing audio: ", err);
      return false;
    }
  };

  const stopRecording = useCallback(() => {
    isActiveRef.current = false;
    closeConnections();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // When language changes, if we are actively recording, we restart the deepgram socket only
  const toggleLanguage = () => {
    setSttLanguage(prev => {
      const newLang = prev === 'en' ? 'es' : 'en';
      if (isActiveRef.current && streamRef.current) {
        closeConnections();
        startDeepgram(streamRef.current, newLang);
      }
      return newLang;
    });
  };

  return { startRecording, stopRecording, captions, sttLanguage, toggleLanguage };
};
