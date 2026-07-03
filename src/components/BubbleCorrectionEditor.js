import React, { useEffect, useRef } from 'react';

/** Floating editor — does not change bubble row height (handoff rule). */
export const BubbleCorrectionEditor = ({
  open,
  field = 'source',
  draft = '',
  sourceLang = 'en',
  targetLang,
  onDraftChange,
  onSave,
  onCancel,
}) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 30);
    return () => clearTimeout(t);
  }, [open, field]);

  if (!open) return null;

  const isSource = field === 'source';
  const title = isSource ? 'Fix transcription' : 'Fix translation';
  const hint = isSource
    ? 'Saves what STT misheard → your fix. Future similar phrases auto-correct.'
    : 'Teaches preferred translation for this source text.';

  return (
    <div className="bubble-correction-backdrop" onClick={onCancel} role="presentation">
      <div
        className="bubble-correction-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="bubble-correction-head">
          <span className="bubble-correction-title">{title}</span>
          <span className="bubble-correction-lang">
            {isSource ? sourceLang.toUpperCase() : `${sourceLang}→${targetLang || '?'}`}
          </span>
        </div>
        <p className="bubble-correction-hint">{hint}</p>
        <textarea
          ref={textareaRef}
          className="bubble-correction-input"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={4}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSave();
          }}
        />
        <div className="bubble-correction-actions">
          <button type="button" className="bubble-correction-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="bubble-correction-btn bubble-correction-btn--save" onClick={onSave}>
            Save & teach
          </button>
        </div>
        <span className="bubble-correction-kbd">Ctrl+Enter to save · Esc to cancel</span>
      </div>
    </div>
  );
};
