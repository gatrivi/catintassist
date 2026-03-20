import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const AudioSettingsContext = createContext();

export const AudioSettingsProvider = ({ children }) => {
  const [outputDevices, setOutputDevices] = useState([]);
  const [inputDevices, setInputDevices] = useState([]);
  const [selectedSinkId, setSelectedSinkId] = useState(() => localStorage.getItem('CATINTASSIST_SINK_ID') || '');
  const [selectedMicId, setSelectedMicId] = useState(() => localStorage.getItem('CATINTASSIST_MIC_ID') || '');
  
  // We use a hidden audio element as a pipeline to push Mic data into the Sink
  const passthroughAudioRef = useRef(new Audio());

  // Fetch available devices
  const fetchDevices = async () => {
    try {
      // Browsers often require mic permission to access device labels reliably
      let devices = await navigator.mediaDevices.enumerateDevices();
      
      const needsPermission = devices.some(d => d.label === '' || d.label.toLowerCase() === 'speaker' || d.label.toLowerCase() === 'microphone');
      
      if (needsPermission) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          // Re-fetch now that we have permission
          devices = await navigator.mediaDevices.enumerateDevices();
        } catch (e) {
          console.warn('Microphone permission denied. Device labels may be missing.', e);
        }
      }

      const outputs = devices.filter(d => d.kind === 'audiooutput');
      const inputs = devices.filter(d => d.kind === 'audioinput');
      setOutputDevices(outputs);
      setInputDevices(inputs);
      
      // If the selected sink no longer exists (e.g., unplugged), revert to default
      if (selectedSinkId && !outputs.some(d => d.deviceId === selectedSinkId)) {
        setSelectedSinkId('');
      }
    } catch (err) {
      console.error('Failed to enumerate audio devices:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
    navigator.mediaDevices.addEventListener('devicechange', fetchDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', fetchDevices);
  }, []);

  // Core Mixer Logic: If both Mic and Sink are selected, pipe them together.
  useEffect(() => {
    let stream = null;
    let isMounted = true;

    const setupPassthrough = async () => {
      // 1. Point the pipeline's output to the Virtual Microphone
      if (passthroughAudioRef.current.setSinkId) {
        try { await passthroughAudioRef.current.setSinkId(selectedSinkId || ''); } 
        catch (e) { console.error("setSinkId fail on passthrough:", e); }
      }

      // 2. Feed the actual Physical Mic into the pipeline
      if (selectedMicId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
             audio: { deviceId: { exact: selectedMicId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
          });
          if (isMounted) {
            passthroughAudioRef.current.srcObject = stream;
            passthroughAudioRef.current.play().catch(e => console.error(e));
          }
        } catch (e) {
          console.error("Failed to capture physical mic for passthrough", e);
        }
      } else {
        passthroughAudioRef.current.srcObject = null;
      }
    };
    
    setupPassthrough();

    return () => {
      isMounted = false;
      if (stream) stream.getTracks().forEach(t => t.stop());
      passthroughAudioRef.current.srcObject = null;
    };
  }, [selectedMicId, selectedSinkId]);

  const changeSinkId = (deviceId) => {
    setSelectedSinkId(deviceId);
    localStorage.setItem('CATINTASSIST_SINK_ID', deviceId);
  };

  const changeMicId = (deviceId) => {
    setSelectedMicId(deviceId);
    localStorage.setItem('CATINTASSIST_MIC_ID', deviceId);
  };

  return (
    <AudioSettingsContext.Provider value={{ outputDevices, inputDevices, selectedSinkId, selectedMicId, changeSinkId, changeMicId, fetchDevices }}>
      {children}
    </AudioSettingsContext.Provider>
  );
};

export const useAudioSettings = () => useContext(AudioSettingsContext);
