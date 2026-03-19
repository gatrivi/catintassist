import { useState, useRef, useCallback, useEffect } from 'react';

export const useDeepgram = () => {
  const [captions, setCaptions] = useState([]);
  const [sttLanguage, setSttLanguage] = useState('en'); // 'en' or 'es'
  const [connectionState, setConnectionState] = useState('disconnected');
  const [connectionMessage, setConnectionMessage] = useState('Disconnected');
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isActiveRef = useRef(false);
  const lastTranscriptTimeRef = useRef(Date.now());

  // We need a helper to safely close the existing socket if we are changing languages mid-stream
  const closeConnections = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnectionState('disconnected');
    setConnectionMessage('Disconnected');
  };

  const startDeepgram = (stream, lang) => {
    const defaultKey = process.env.REACT_APP_DEEPGRAM_API_KEY;
    const API_KEY = localStorage.getItem('DEEPGRAM_API_KEY') || defaultKey;
    if (!API_KEY || API_KEY.trim() === '' || API_KEY === 'your_deepgram_api_key_here') {
      alert("Deepgram API Key is missing! Please set it by clicking the Key icon in the header.");
      setConnectionState('error');
      setConnectionMessage('Missing API Key');
      return false;
    }

    const translateTarget = lang === 'en' ? 'es' : 'en';
    setConnectionState('connecting');
    setConnectionMessage('Opening WebSocket...');
    socketRef.current = new WebSocket(`wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=${lang}&interim_results=true&endpointing=300`, [
      'token',
      API_KEY,
    ]);

    socketRef.current.onopen = () => {
      setConnectionState('connected');
      setConnectionMessage('Connected & Ready');
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

      if (received.type === 'Error' || received.error) {
         console.error("Deepgram Error message received: ", received);
         setConnectionState('error');
         setConnectionMessage(`Deepgram Error: ${received.message || received.error || 'Unknown'}`);
         return;
      }

      const transcript = received.channel?.alternatives?.[0]?.transcript;
      const isFinal = received.is_final;

      if (transcript) {
        const now = Date.now();
        const timeSinceLast = now - lastTranscriptTimeRef.current;
        lastTranscriptTimeRef.current = now;

        // If there is more than 3 seconds of silence, it indicates the other speaker's turn.
        const isNewTurn = timeSinceLast > 3000;

        setCaptions(prev => {
          const last = prev[prev.length - 1];
          if (!last || last.lang !== lang || isNewTurn) {
            return [...prev, { text: transcript, finalizedText: isFinal ? transcript : '', interimText: isFinal ? '' : transcript, lang }];
          }

          const newArr = [...prev];
          let current = { ...last };
          
          if (isFinal) {
             current.finalizedText = (current.finalizedText + ' ' + transcript).trim();
             current.interimText = '';
          } else {
             current.interimText = transcript;
          }
          current.text = (current.finalizedText + ' ' + current.interimText).trim();
          
          newArr[newArr.length - 1] = current;
          return newArr;
        });
      }
    };

    socketRef.current.onerror = (error) => {
      console.error("Deepgram WebSocket Error: ", error);
      setConnectionState('error');
      setConnectionMessage('WebSocket Error');
    };

    socketRef.current.onclose = (event) => {
      // Don't overwrite an existing error state if we caught it in onmessage
      setConnectionState(prev => prev === 'error' ? 'error' : 'disconnected');
      
      let msg = 'WebSocket Connection Closed';
      if (event.reason) {
        msg = `Closed: ${event.reason}`;
      } else if (event.code === 1006) {
        msg = 'Connection Rejected (Check API Key or Funds)';
      } else if (event.code) {
        msg = `Closed: Code ${event.code}`;
      }
      
      setConnectionMessage(prev => {
        // preserve the Deepgram JSON error if it fired just before close
        if (prev.startsWith('Deepgram Error:')) return prev;
        return msg;
      });
    };
  };

  const startRecording = async () => {
    try {
      let stream = streamRef.current;
      
      // Check if existing stream is still active
      if (stream && stream.getTracks().some(track => track.readyState === 'ended')) {
        stream = null;
      }

      if (!stream) {
        setConnectionState('connecting');
        setConnectionMessage('Requesting Tab Audio...');
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        if (stream.getAudioTracks().length === 0) {
          alert("No audio track detected! You must check the 'Share tab audio' toggle when selecting the Chrome tab.");
          setConnectionState('error');
          setConnectionMessage('No audio track selected');
          stream.getTracks().forEach(track => track.stop());
          return false;
        }

        streamRef.current = stream;
        
        // Only attach onended when creating new stream
        stream.getVideoTracks()[0].onended = () => {
          stopRecording();
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        };
      }

      isActiveRef.current = true;
      startDeepgram(stream, sttLanguage);
      return true;
    } catch (err) {
      console.error("Error capturing audio: ", err);
      return false;
    }
  };

  const stopRecording = useCallback(() => {
    isActiveRef.current = false;
    closeConnections();
    // Intentionally NOT stopping tracks here so stream can be reused 
    // when clicking Connect again. Browser "Stop Sharing" handles actual track stop.
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

  return { startRecording, stopRecording, captions, sttLanguage, toggleLanguage, connectionState, connectionMessage };
};
