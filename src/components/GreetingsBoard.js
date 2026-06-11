import React, { useState, useCallback } from 'react';
import { useGreetingsPanel, ACTIONS, TIME_SLOTS } from '../hooks/useGreetingsPanel';
import AudioEditorPanel from './AudioEditorPanel';

export default function GreetingsBoard({ onEditModeChange }) {
  const {
    mode, setMode,
    blobs,
    healthScores,
    isAnalyzing,
    playingKey,
    recordingKey,
    testMode,
    playbackSpeed, setPlaybackSpeed,
    audioSettings,
    handleFileUpload,
    handleClear,
    startRecording,
    stopRecording,
    playAudioBlock,
    getHealthMeta,
    isRecording,
  } = useGreetingsPanel(onEditModeChange);

  const [editingKey, setEditingKey] = useState(null);

  const openEditor = useCallback((key) => {
    if (blobs[key]) setEditingKey(key);
  }, [blobs]);

  const closeEditor = useCallback(() => setEditingKey(null), []);

  if (editingKey) {
    return (
      <div className="sb-editor-wrap glass-panel" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Editing: {editingKey}</h3>
          <button type="button" className="sb-btn" onClick={closeEditor}>Close Editor</button>
        </div>
        <AudioEditorPanel
          key={editingKey}
          blob={blobs[editingKey]}
          label={editingKey}
          localVolume={audioSettings.localVolume}
          onSave={async (editedBlob) => {
            await handleFileUpload(editingKey, editedBlob);
            closeEditor();
          }}
          onDelete={() => {
            handleClear(editingKey);
            closeEditor();
          }}
          onClose={closeEditor}
        />
      </div>
    );
  }

  return (
    <div className="sb-board" style={{ padding: '1rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="sb-btn" onClick={() => setMode(mode === 'play' ? 'settings' : 'play')}>
          {mode === 'play' ? '⚙️ Settings' : '▶️ Play'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Speed:
          <input
            type="range"
            min="0.75"
            max="1.25"
            step="0.05"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            style={{ width: '80px' }}
          />
          {playbackSpeed}x
        </label>
      </div>

      {ACTIONS.map((action) => {
        const keys = action.dynamic
          ? TIME_SLOTS.map((t) => `${action.id}_${t}`)
          : [action.id];

        return (
          <div key={action.id} style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(148,163,184,0.2)', paddingBottom: '0.5rem' }}>
            <strong style={{ fontSize: '0.85rem' }}>{action.label} ({action.lang || 'generic'})</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {keys.map((k) => {
                const hasRecording = !!blobs[k];
                const isPlayingThis = playingKey === k;
                const isRecordingThis = recordingKey === k;
                const healthMeta = getHealthMeta(healthScores[k]);

                return (
                  <div key={k} className="sb-clip-card" style={{ minWidth: '200px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{k}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}>
                      {hasRecording ? (
                        <>
                          <button
                            type="button"
                            className={`sb-btn sb-btn--preview ${isPlayingThis ? 'is-active' : ''}`}
                            onClick={() => playAudioBlock(k, testMode)}
                            disabled={isRecording}
                          >
                            {isPlayingThis ? '⏹️ Stop' : '▶️ Play'}
                          </button>
                          <button type="button" className="sb-btn" onClick={() => openEditor(k)}>✏️ Edit</button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={`sb-btn sb-btn--record ${isRecordingThis ? 'is-recording' : ''}`}
                          onClick={() => (isRecordingThis ? stopRecording() : startRecording(k))}
                        >
                          {isRecordingThis ? '⏹️ Stop Rec' : '🎤 Record'}
                        </button>
                      )}
                    </div>
                    {healthMeta && (
                      <div style={{ marginTop: '0.3rem', background: 'rgba(255,255,255,0.08)', height: '4px', width: '100%', borderRadius: 2 }}>
                        <div style={{ width: healthMeta.width, height: '100%', background: healthMeta.color, borderRadius: 2 }} />
                      </div>
                    )}
                    {isAnalyzing === k && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}> Analyzing…</span>}
                    {isRecordingThis && (
                      <div className="sb-record-meter" style={{ marginTop: '4px' }}>
                        <div id="record-vol-bar" className="sb-record-meter-fill" style={{ width: '0%' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
