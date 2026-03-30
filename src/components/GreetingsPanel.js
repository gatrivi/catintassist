import React, { useState, useEffect, useRef } from 'react';
import { saveFile, loadFile, deleteFile, generateObjectUrl } from '../utils/storage';
import { useAudioSettings } from '../contexts/AudioSettingsContext';

const TIME_SLOTS = ['morning', 'afternoon', 'evening'];

export const ACTIONS = [
  { id: 'greeting_en', label: 'Greeting (EN)', dynamic: true },
  { id: 'greeting_es', label: 'Greeting (ES)', dynamic: true },
  { id: 'intake', label: 'Intake Qs', dynamic: false },
  { id: 'hold_policy', label: 'Hold Policy', dynamic: false },
  { id: 'hold_exc_en', label: 'Hold Exc (EN)', dynamic: false },
  { id: 'hold_exc_es', label: 'Hold Exc (ES)', dynamic: false },
  { id: 'sign_off', label: 'Sign Off', dynamic: false },
  { id: 'anyone', label: 'Anyone There?', dynamic: false },
  { id: 'callout', label: 'Callout', dynamic: false },
  { id: 'closer_louder', label: 'Closer/Louder', dynamic: false },
  { id: 'limit_40_en', label: '40 Word Limit (EN)', dynamic: false },
  { id: 'limit_40_es', label: '40 Word Limit (ES)', dynamic: false },
];

export const GreetingsPanel = ({ onEditModeChange }) => {
  const { selectedSinkId, localVolume, sinkVolume, changeLocalVolume, changeSinkVolume, monitorMic, setMonitorMic, monitorVolume, setMonitorVolume } = useAudioSettings();
  const [mode, setMode] = useState('play'); // 'play' | 'settings'
  const [timeOfDay, setTimeOfDay] = useState('morning');
  const [blobs, setBlobs] = useState({});
  const [playingKey, setPlayingKey] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [recordingKey, setRecordingKey] = useState(null);
  const [testMode, setTestMode] = useState(false);

  const audioRefSink = useRef(new Audio());
  const audioRefLocal = useRef(new Audio());
  const mediaRecorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioChunksRef = useRef([]);
  const animationRef = useRef(null);

  useEffect(() => {
    const updateTime = () => {
      const h = new Date().getHours();
      if (h < 12) setTimeOfDay('morning');
      else if (h < 17) setTimeOfDay('afternoon');
      else setTimeOfDay('evening');
    };
    updateTime();
    const intv = setInterval(updateTime, 60000);
    return () => clearInterval(intv);
  }, []);

  useEffect(() => {
    if (onEditModeChange) {
      onEditModeChange(mode === 'settings');
    }
  }, [mode, onEditModeChange]);

  const reloadData = async () => {
    const state = {};
    for (const action of ACTIONS) {
       const thumb = await loadFile(`thumb_${action.id}`);
       if (thumb) {
           state[`thumb_${action.id}`] = thumb;
           state[`url_thumb_${action.id}`] = generateObjectUrl(thumb);
       }
       if (action.dynamic) {
          for (const t of TIME_SLOTS) {
            const b = await loadFile(`${action.id}_${t}`);
            if (b) {
               state[`${action.id}_${t}`] = b;
               state[`url_${action.id}_${t}`] = generateObjectUrl(b);
            }
          }
       } else {
          const b = await loadFile(action.id);
          if (b) {
             state[action.id] = b;
             state[`url_${action.id}`] = generateObjectUrl(b);
          }
       }
    }
    const bgApp = await loadFile('bg_app');
    if (bgApp) {
        state.bg_app = bgApp;
        document.body.style.backgroundImage = `url(${generateObjectUrl(bgApp)})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    } else {
        document.body.style.backgroundImage = '';
    }
    setBlobs(state);
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Sync volumes when sliders change
  useEffect(() => {
    audioRefLocal.current.volume = localVolume;
    audioRefSink.current.volume = sinkVolume;
  }, [localVolume, sinkVolume]);

  const handleFileUpload = async (key, file) => {
    if (!file) return;
    await saveFile(key, file);
    reloadData();
  };

  const handleClear = async (key) => {
    await deleteFile(key);
    reloadData();
  };

  const startRecording = async (key) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Use higher bitrate and webm/opus for better reliability
      const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
      const mediaRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        let avg = sum / dataArray.length;
        
        let width = Math.min(100, Math.max(0, (avg / 100) * 100));
        if (width < 2 && avg > 0) width = 2; // small indicator it's alive
        
        const bar = document.getElementById('record-vol-bar');
        if (bar) bar.style.width = width + '%';
        requestAnimationFrame(updateLevel);
      };

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType || 'audio/webm' });
        handleFileUpload(key, audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setRecordingKey(key);
      updateLevel();
    } catch (e) {
      alert("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingKey(null);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(()=>{});
        audioCtxRef.current = null;
      }
    }
  };

  const trackProgress = () => {
    if (audioRefLocal.current && audioRefLocal.current.duration) {
      setPlaybackProgress(audioRefLocal.current.currentTime / audioRefLocal.current.duration);
      if (!testMode && playingKey) {
        window.__CAT_AUDIO_VOL = (40 + Math.random() * 60) * sinkVolume;
      } else {
        window.__CAT_AUDIO_VOL = 0;
      }
    } else {
      window.__CAT_AUDIO_VOL = 0;
    }
    animationRef.current = requestAnimationFrame(trackProgress);
  };

  const clearPlaybackState = () => {
    setPlayingKey(null);
    setPlaybackProgress(0);
    window.__CAT_AUDIO_VOL = 0;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const playAudioBlock = async (key, routeToVirtualMic) => {
    // If clicking the same button twice, it stops.
    if (playingKey === key) {
      audioRefSink.current.pause();
      audioRefLocal.current.pause();
      clearPlaybackState();
      return; 
    }
    
    // Stop any current audio
    if (playingKey) {
      audioRefSink.current.pause();
      audioRefLocal.current.pause();
      clearPlaybackState();
    }
    
    const blob = blobs[key];
    if (!blob) {
      // Empty button shortcut
      setMode('settings');
      setTimeout(() => {
        const el = document.getElementById(`settings-row-${key}`);
        if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }
    
    const url = blobs[`url_${key}`] || generateObjectUrl(blob);
    audioRefSink.current.src = url;
    audioRefLocal.current.src = url;
    
    // Sync the visual 'stop' state to the local audio element finishing
    audioRefLocal.current.onended = clearPlaybackState;
    audioRefLocal.current.onpause = clearPlaybackState;

    // Start progress loop
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(trackProgress);

    if (routeToVirtualMic && selectedSinkId && audioRefSink.current.setSinkId) {
      let routed = false;
      try { 
        await audioRefSink.current.setSinkId(selectedSinkId); 
        routed = true;
      } catch (e) { 
        console.error("setSinkId failed", e); 
      }
      
      if (routed) {
         try {
           setPlayingKey(key);
           await Promise.all([audioRefSink.current.play(), audioRefLocal.current.play()]);
         } catch(e) {
           console.error("Playback error: ", e);
           clearPlaybackState();
         }
         return;
      }
    }
    
    // Fallback: Just play local
    try {
      setPlayingKey(key);
      await audioRefLocal.current.play();
    } catch (err) {
      console.error("Playback error:", err);
      clearPlaybackState();
    }
  };

  const renderRecordingRow = (key, label) => (
    <div key={key} id={`settings-row-${key}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.85rem' }}>🔈 {label}</span>
        <span style={{ color: blobs[key] ? '#10b981' : '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>{blobs[key] ? '✅ SAVED' : '❌ MISSING'}</span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {recordingKey === key ? (
            <button onClick={stopRecording} style={{ flex: 1, padding: '0.4rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, animation: 'pulseGlow 2s infinite' }}>⏹ Stop</button>
          ) : (
            <button onClick={() => startRecording(key)} disabled={recordingKey !== null} style={{ flex: 1, padding: '0.4rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '4px', cursor: recordingKey ? 'not-allowed' : 'pointer' }}>🎙️ Record</button>
          )}
          
          {blobs[key] && (
            <button onClick={() => playAudioBlock(key, false)} style={{ flex: 1, padding: '0.4rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '4px', cursor: 'pointer' }}>{playingKey === key ? '⏹ Stop' : '▶ Preview'}</button>
          )}
        </div>
        {recordingKey === key && (
          <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.5)', borderRadius: '2px', overflow: 'hidden' }}>
             <div id="record-vol-bar" style={{ height: '100%', width: '0%', backgroundColor: '#6ee7b7', transition: 'width 0.05s ease' }} />
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', alignItems: 'center' }}>
        <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(key, e.target.files[0])} style={{ maxWidth: '160px', fontSize: '0.7rem' }} />
        {blobs[key] && <button onClick={() => handleClear(key)} style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '0.1rem 0.5rem', cursor: 'pointer', marginLeft: 'auto' }}>Delete</button>}
      </div>
    </div>
  );

  if (mode === 'settings') {
    return (
      <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1, border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', position: 'sticky', top: 0, zIndex: 10, background: 'var(--panel-bg)'}}>
          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>⚙️ Setup Soundboard</span>
          <button className="btn" onClick={() => setMode('play')} style={{ padding: '0.3rem 0.8rem', background: '#3b82f6', borderRadius: '20px', fontSize: '0.8rem' }}>Save & Back</button>
        </div>
        
        <div style={{ fontSize: '0.85rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '0.5rem' }}>🖼️ Global App Background Image</strong>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="file" accept="image/*" onChange={(e) => handleFileUpload('bg_app', e.target.files[0])} style={{ fontSize: '0.75rem', flex: 1 }} />
            {blobs['bg_app'] && <button onClick={() => handleClear('bg_app')} className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Clear Image</button>}
          </div>
        </div>

        {ACTIONS.map(action => (
          <div key={action.id} style={{ padding: '0.75rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontWeight: 700, color: '#6ee7b7', marginBottom: '0.75rem', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>{action.label}</div>
            
            <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ color: 'var(--text-main)', opacity: 0.9 }}>🖼️ Button Thumbnail Cover</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(`thumb_${action.id}`, e.target.files[0])} style={{ fontSize: '0.75rem' }} />
                {blobs[`thumb_${action.id}`] && <button onClick={() => handleClear(`thumb_${action.id}`)} style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', padding: '0.1rem 0.5rem', cursor: 'pointer' }}>Clear</button>}
              </div>
            </div>

            <div style={{ marginTop: '0.5rem' }}>
              {action.dynamic ? TIME_SLOTS.map(t => renderRecordingRow(`${action.id}_${t}`, `${t} Audio`)) : renderRecordingRow(action.id, 'Audio Clip')}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Play Mode
  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '1rem', color: testMode ? '#f59e0b' : 'inherit' }}>
            Soundboard ({timeOfDay})
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: testMode ? '#f59e0b' : 'var(--text-muted)', cursor: 'pointer', background: testMode ? 'rgba(245, 158, 11, 0.1)' : 'transparent', padding: '0.2rem 0.4rem', borderRadius: '4px', border: testMode ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent', transition: 'all 0.2s' }} title="When Test Mode is ON, audio plays ONLY to your local speakers and is NOT sent to the Virtual Mic / Caller.">
            <input type="checkbox" checked={testMode} onChange={e => setTestMode(e.target.checked)} style={{ cursor: 'pointer' }} />
            🧪 Test Mode
          </label>
        
          <button 
            className="btn" 
            onClick={() => setMode('settings')} 
            style={{ padding: '0.2rem', background: 'transparent', color: 'var(--text-muted)', fontSize: '1rem', border: 'none' }}
            title="Soundboard Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
          <span style={{ color: testMode ? '#f59e0b' : 'var(--text-muted)' }}>🔊 You (Local)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="range" min="0" max="1" step="0.05" value={localVolume} onChange={(e) => changeLocalVolume(parseFloat(e.target.value))} style={{ width: '60px', accentColor: '#3b82f6' }} title="Your Speakers Volume" />
            <div style={{ width: '30px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
               <div style={{ width: playingKey ? `${localVolume * (40 + Math.random() * 60)}%` : '0%', height: '100%', background: testMode ? '#f59e0b' : '#3b82f6', transition: 'width 0.1s' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
          <span style={{ color: testMode ? 'rgba(255,255,255,0.2)' : 'var(--text-muted)' }}>🎤 Call (Virtual Mic)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: testMode ? 0.3 : 1 }}>
            <input type="range" disabled={testMode} min="0" max="1" step="0.05" value={sinkVolume} onChange={(e) => changeSinkVolume(parseFloat(e.target.value))} style={{ width: '60px', accentColor: '#10b981' }} title="Interpreter Call Volume" />
            <div style={{ width: '30px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
               <div style={{ width: (playingKey && blobs[playingKey] && !testMode) ? `${sinkVolume * (40 + Math.random() * 60)}%` : '0%', height: '100%', background: '#10b981', transition: 'width 0.1s' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
          <button
            onClick={() => setMonitorMic(m => !m)}
            style={{
              background: monitorMic ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              color: monitorMic ? '#fbbf24' : 'var(--text-muted)',
              border: monitorMic ? '1px solid rgba(245,158,11,0.4)' : '1px solid transparent',
              borderRadius: '4px', padding: '0.1rem 0.4rem', cursor: 'pointer', fontSize: '0.7rem',
              fontWeight: monitorMic ? 700 : 400,
              animation: monitorMic ? 'pulseGlow 2s infinite' : 'none'
            }}
            title="Hear your own mic through your local speakers"
          >
            {monitorMic ? '🔴 Mic Monitor ON' : '👂 Mic Monitor'}
          </button>
          {monitorMic && (
            <input type="range" min="0" max="1" step="0.05" value={monitorVolume}
              onChange={e => setMonitorVolume(parseFloat(e.target.value))}
              style={{ width: '60px', accentColor: '#f59e0b' }} title="Monitor Volume" />
          )}
        </div>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '0.5rem',
        paddingTop: '0.25rem'
      }}>
        {ACTIONS.map(action => {
           const activeKey = action.dynamic ? `${action.id}_${timeOfDay}` : action.id;
           const hasAudio = !!blobs[activeKey];
           const bgImage = blobs[`url_thumb_${action.id}`] ? `url(${blobs[`url_thumb_${action.id}`]})` : 'none';
           const isItPlaying = playingKey === activeKey;
           
           return (
             <button
               key={action.id}
               onClick={() => playAudioBlock(activeKey, !testMode)}
               style={{
                 height: '55px',
                 borderRadius: '6px',
                 border: isItPlaying ? '2px solid #10b981' : '1px solid var(--panel-border)',
                 boxShadow: isItPlaying ? '0 0 15px rgba(16, 185, 129, 0.8)' : 'none',
                 animation: isItPlaying ? 'pulseGlow 1.5s infinite' : 'none',
                 background: bgImage !== 'none' ? bgImage : 'rgba(255,255,255,0.05)',
                 backgroundSize: 'cover',
                 backgroundPosition: 'center',
                 color: 'white',
                 fontWeight: 600,
                 textShadow: '0 2px 4px rgba(0,0,0,1)',
                 cursor: 'pointer',
                 opacity: hasAudio ? 1 : 0.4,
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 position: 'relative',
                 overflow: 'hidden',
                 fontSize: '0.8rem',
                 lineHeight: 1.2
               }}
               title={hasAudio ? "Play Audio" : "Empty Audio - Click to add"}
             >
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', transition: 'background 0.2s' }} />
                {isItPlaying && (
                  <div style={{ 
                    position: 'absolute', 
                    top: 0, left: 0, bottom: 0, 
                    width: `${playbackProgress * 100}%`,
                    background: 'rgba(16, 185, 129, 0.4)',
                    transition: 'width 0.1s linear',
                    zIndex: 0
                  }} />
                )}
                
                <span style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0.2rem' }}>
                  {!hasAudio ? `➕ Add ${action.label}` : (isItPlaying ? '⏹ STOP' : action.label)}
                </span>
             </button>
           )
        })}
      </div>
    </div>
  );
};
