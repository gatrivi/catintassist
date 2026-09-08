import React, { useEffect, useMemo, useState } from 'react';
import {
  STUDY_DOMAINS,
  STUDY_DOMAIN_CHANGED_EVENT,
  STUDY_CARDS,
  cardsForDomain,
  readStudyDomain,
  seededShuffle,
  writeStudyDomain,
} from '../utils/studyDecks';
import { APP_VERSION } from '../constants/version';

const ROTATE_MS = 10000; // auto-advance; reset on manual interaction

/** Card front by type (back reveals on click). */
const CardFace = ({ card, revealed }) => {
  if (card.type === 'qa') return <p className="study-card-qa">{card.text}</p>;
  if (card.type === 'nosay') {
    return (
      <div className="study-card-nosay">
        <span className="study-card-wrong">✗ {card.wrong}</span>
        {revealed && (
          <>
            <span className="study-card-right">✓ {card.right}</span>
            {card.note && <small className="study-card-note">{card.note}</small>}
          </>
        )}
      </div>
    );
  }
  if (card.type === 'acronym') {
    return (
      <div className="study-card-glossary">
        <span className="study-card-en">{card.abbr}</span>
        {revealed && (
          <span className="study-card-es">
            {card.expansion}
            <br />— {card.es}
          </span>
        )}
      </div>
    );
  }
  // glossary
  return (
    <div className="study-card-glossary">
      <span className="study-card-en">{card.en}</span>
      {revealed && <span className="study-card-es">{card.es}</span>}
    </div>
  );
};

/**
 * Study cue cards (v4.88.0) — rotating glossary/QA flashcards.
 * variant 'idle': sits in the off-call idle pane.
 * variant 'hold': overlay over the transcript pane during hold.
 */
export const StudyCueCards = ({ variant = 'idle' }) => {
  const [domain, setDomain] = useState(readStudyDomain);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [seed] = useState(() => Math.floor(Math.random() * 1e9) + 1);

  // live domain changes (picker is also usable from other surfaces later)
  useEffect(() => {
    const onChange = (e) => setDomain(e.detail?.domain || readStudyDomain());
    window.addEventListener(STUDY_DOMAIN_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(STUDY_DOMAIN_CHANGED_EVENT, onChange);
  }, []);

  const deck = useMemo(() => seededShuffle(cardsForDomain(STUDY_CARDS, domain), seed), [domain, seed]);
  const card = deck.length ? deck[idx % deck.length] : null;

  // auto-rotate; manual actions reset the timer via state bump
  useEffect(() => {
    setRevealed(false);
  }, [idx]);
  useEffect(() => {
    const iv = setInterval(() => setIdx((n) => n + 1), ROTATE_MS);
    return () => clearInterval(iv);
  }, [deck]);

  if (!card) return null;

  const pickDomain = (d) => {
    setDomain(writeStudyDomain(d));
    setIdx(0);
  };

  return (
    <section
      id="study-cue-cards"
      className={`study-cue-cards study-cue-${variant}`}
      data-guide="study-cue-cards"
      aria-label="Study cue cards"
    >
      <header className="study-cue-header">
        <span className="study-cue-title">📚 Study</span>
        <div className="study-cue-domains" role="tablist" aria-label="Card domain">
          {STUDY_DOMAINS.map((d) => (
            <button
              key={d.id}
              role="tab"
              aria-selected={domain === d.id}
              className={`study-cue-chip${domain === d.id ? ' is-active' : ''}`}
              onClick={() => pickDomain(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </header>
      <button
        type="button"
        className="study-card"
        onClick={() => (revealed ? setIdx((n) => n + 1) : setRevealed(true))}
        title={revealed ? 'Next card' : 'Reveal answer'}
      >
        <CardFace card={card} revealed={revealed} />
        <small className="study-card-hint">{revealed ? '→ next' : 'tap to reveal'}</small>
      </button>
      <footer className="study-cue-meta">
        <span>{(idx % deck.length) + 1}/{deck.length}</span>
        {variant === 'hold' && (
          <span className="study-cue-resume-hint">🔊 speak or click outside to resume</span>
        )}
        <button type="button" className="study-cue-skip" onClick={() => setIdx((n) => n + 1)}>
          skip ▸
        </button>
        <span className="study-cue-version">v{APP_VERSION}</span>
      </footer>
    </section>
  );
};
