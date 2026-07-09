import React, { useState, useCallback } from 'react';
import { APP_VERSION_LABEL } from '../constants/version';
import { getCopyForLang, DEFAULT_RELEASE_NOTES_LANG } from '../content/releaseNotes';
import { readReleaseNotesLangPref, writeReleaseNotesLangPref } from '../utils/releaseNotesStorage';

const UI = {
  es: {
    langToggle: 'Idioma',
    gotIt: 'Entendido',
    later: 'Ver después',
    never: 'No mostrar de nuevo',
    version: 'Versión',
  },
  en: {
    langToggle: 'Language',
    gotIt: 'Got it',
    later: 'Show later',
    never: "Don't show again",
    version: 'Version',
  },
};

export const ReleaseNotesModal = ({
  open = false,
  note,
  onGotIt,
  onLater,
  onNever,
}) => {
  const [lang, setLang] = useState(() => readReleaseNotesLangPref());

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'es' ? 'en' : 'es';
      writeReleaseNotesLangPref(next);
      return next;
    });
  }, []);

  if (!open || !note) return null;

  const copy = getCopyForLang(note, lang) || getCopyForLang(note, DEFAULT_RELEASE_NOTES_LANG);
  const labels = UI[lang] || UI.es;

  if (!copy) return null;

  return (
    <div
      className="release-notes-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-notes-title"
    >
      <div className="release-notes-panel">
        <header className="release-notes-header">
          <div className="release-notes-header-top">
            <span className="release-notes-version-pill">{APP_VERSION_LABEL}</span>
            <div className="release-notes-lang-toggle" role="group" aria-label={labels.langToggle}>
              <button
                type="button"
                className={`release-notes-lang-btn${lang === 'es' ? ' is-active' : ''}`}
                onClick={() => lang !== 'es' && toggleLang()}
                aria-pressed={lang === 'es'}
              >
                ES
              </button>
              <button
                type="button"
                className={`release-notes-lang-btn${lang === 'en' ? ' is-active' : ''}`}
                onClick={() => lang !== 'en' && toggleLang()}
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
            </div>
          </div>
          <h2 id="release-notes-title" className="release-notes-title">
            {copy.title}
          </h2>
          <p className="release-notes-intro">{copy.intro}</p>
        </header>

        <div className="release-notes-body">
          {copy.sections.map((section) => (
            <section key={section.heading} className="release-notes-section">
              <h3 className="release-notes-section-heading">{section.heading}</h3>
              <ul className="release-notes-list">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="release-notes-footer">
          <button type="button" className="release-notes-btn release-notes-btn--primary" onClick={onGotIt}>
            {labels.gotIt}
          </button>
          <button type="button" className="release-notes-btn" onClick={onLater}>
            {labels.later}
          </button>
          <button type="button" className="release-notes-btn release-notes-btn--ghost" onClick={onNever}>
            {labels.never}
          </button>
        </footer>
      </div>
    </div>
  );
};
