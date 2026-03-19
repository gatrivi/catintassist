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

export const GreetingsPanel = () => {
  const { selectedSinkId } = useAudioSettings();
  const [mode, setMode] = useState('play'); // 'play' | 'settings'
  const [timeOfDay, setTimeOfDay] = useState('morning');
  const [blobs, setBlobs] = useState({});
  const [playingKey, setPlayingKey] = useState(null);
  const [recordingKey, setRecordingKey] = useState(null);
  const audioRef = useRef(new Audio());
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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

  const reloadData = async () => {
    const state = {};
    for (const action of ACTIONS) {
       // load thumbnail
       const thumb = await loadFile(`thumb_${action.id}`);
       if (thumb) state[`thumb_${action.id}`] = thumb;
       
       if (action.dynamic) {
          for (const t of TIME_SLOTS) {
            const b = await loadFile(`${action.id}_${t}`);
            if (b) state[`${action.id}_${t}`] = b;
          }
       } else {
          const b = await loadFile(action.id);
          if (b) state[action.id] = b;
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
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        handleFileUpload(key, audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setRecordingKey(key);
    } catch (e) {
      alert("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingKey(null);
    }
  };

  const playAudioBlock = async (key, routeToVirtualMic) => {
    if (playingKey) {
      audioRef.current.pause();
      setPlayingKey(null);
      if (playingKey === key) return; // If clicking the same button twice, it stops.
    }
    
    const blob = blobs[key];
    if (!blob) {
      if (routeToVirtualMic) alert(`No audio recorded for this slot!`);
      return;
    }
    
    const audio = audioRef.current;
    audio.src = generateObjectUrl(blob);
    
    if (audio.setSinkId) {
      try { 
        await audio.setSinkId(routeToVirtualMic && selectedSinkId ? selectedSinkId : ''); 
      } 
      catch (e) { console.error("setSinkId failed", e); }
    }

    audio.onended = () => setPlayingKey(null);
    audio.onpause = () => setPlayingKey(null);
    
    try {
      setPlayingKey(key);
      await audio.play();
    } catch (err) {
      console.error("Playback error:", err);
      setPlayingKey(null);
    }
  };

  const renderRecordingRow = (key, label) => (
    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{label}</span>
        <span style={{ color: blobs[key] ? '#10b981' : '#ef4444' }}>{blobs[key] ? '✅ Saved' : '❌ Missing'}</span>
      </div>
      
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
        {recordingKey === key ? (
          <button onClick={stopRecording} style={{ flex: 1, padding: '0.3rem', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, animation: 'pulseGlow 2s infinite' }}>⏹ Stop Recording</button>
        ) : (
          <button onClick={() => startRecording(key)} disabled={recordingKey !== null} style={{ flex: 1, padding: '0.3rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: recordingKey ? 'not-allowed' : 'pointer' }}>🎙️ Record</button>
        )}
        
        {blobs[key] && (
          <button onClick={() => playAudioBlock(key, false)} style={{ flex: 1, padding: '0.3rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{playingKey === key ? '⏹ Stop' : '▶ Preview'}</button>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)', alignItems: 'center' }}>
        <span>Or upload file:</span>
        <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(key, e.target.files[0])} style={{ maxWidth: '120px' }} />
        {blobs[key] && <button onClick={() => handleClear(key)} style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>Delete</button>}
      </div>
    </div>
  );

  if (mode === 'settings') {
    return (
      <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.5rem', position: 'sticky', top: 0, background: 'var(--panel-bg)', zIndex: 10 }}>
          <span style={{ fontWeight: 600 }}>Soundboard Settings</span>
          <button className="btn" onClick={() => setMode('play')} style={{ padding: '0.2rem 0.5rem', background: '#3b82f6' }}>Save & Go Back</button>
        </div>
        
        <div style={{ fontSize: '0.85rem', marginBottom: '1rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
          <strong style={{ color: 'var(--accent-primary)' }}>App Background Image</strong>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input type="file" accept="image/*" onChange={(e) => handleFileUpload('bg_app', e.target.files[0])} style={{ fontSize: '0.75rem' }} />
            {blobs['bg_app'] && <button onClick={() => handleClear('bg_app')} className="btn btn-danger" style={{ padding: '0.2rem 0.5rem' }}>Clear</button>}
          </div>
        </div>

        {ACTIONS.map(action => (
          <div key={action.id} style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', marginTop: '0.5rem' }}>
            <div style={{ fontWeight: 600, color: '#6ee7b7', marginBottom: '0.5rem' }}>{action.label}</div>
            
            <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              <strong style={{ color: 'var(--text-muted)' }}>Button Thumbnail (Photo of family, etc)</strong>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(`thumb_${action.id}`, e.target.files[0])} style={{ fontSize: '0.7rem' }} />
                {blobs[`thumb_${action.id}`] && <button onClick={() => handleClear(`thumb_${action.id}`)} style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Clear</button>}
              </div>
            </div>

            {action.dynamic ? TIME_SLOTS.map(t => renderRecordingRow(`${action.id}_${t}`, `${t} Audio`)) : renderRecordingRow(action.id, 'Audio Clip')}
          </div>
        ))}
      </div>
    );
  }

  // Play Mode
  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>Soundboard ({timeOfDay})</span>
        </div>
        <button 
          className="btn" 
          onClick={() => setMode('settings')} 
          style={{ padding: '0.2rem', background: 'transparent', color: 'var(--text-muted)', fontSize: '1rem' }}
          title="Soundboard Settings"
        >
          ⚙️
        </button>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '0.5rem',
        paddingTop: '0.25rem'
      }}>
        {ACTIONS.map(action => {
           const bgImage = blobs[`thumb_${action.id}`] ? `url(${generateObjectUrl(blobs[`thumb_${action.id}`])})` : 'none';
           const activeKey = action.dynamic ? `${action.id}_${timeOfDay}` : action.id;
           const isItPlaying = playingKey === activeKey;
           
           return (
             <button
               key={action.id}
               onClick={() => playAudioBlock(activeKey, true)}
               style={{
                 height: '80px',
                 borderRadius: '6px',
                 border: isItPlaying ? '2px solid #10b981' : '1px solid var(--panel-border)',
                 background: bgImage !== 'none' ? bgImage : 'rgba(255,255,255,0.05)',
                 backgroundSize: 'cover',
                 backgroundPosition: 'center',
                 color: 'white',
                 fontWeight: 600,
                 textShadow: '0 2px 4px rgba(0,0,0,1)',
                 cursor: 'pointer',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 position: 'relative',
                 overflow: 'hidden',
                 fontSize: '0.8rem',
                 lineHeight: 1.2
               }}
             >
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', transition: 'background 0.2s' }} />
                <span style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0.2rem' }}>
                  {isItPlaying ? '⏹ STOP' : action.label}
                </span>
             </button>
           )
        })}
      </div>
    </div>
  );
};
