import { useCallback, useEffect, useMemo, useState } from 'react';
import { APP_VERSION } from '../constants/version';
import { getReleaseNoteForVersion } from '../content/releaseNotes';
import { applyReleaseHighlights } from '../utils/releaseHighlight';
import {
  dismissReleaseNotesForever,
  markReleaseNotesSeen,
  shouldShowReleaseNotes,
  snoozeReleaseNotes,
} from '../utils/releaseNotesStorage';

/**
 * Show bilingual release summary after splash, off-call.
 * @param {{ shellReady: boolean, isActive: boolean, isZombieCall: boolean }} opts
 */
export const useReleaseNotes = ({ shellReady, isActive, isZombieCall }) => {
  const note = useMemo(() => getReleaseNoteForVersion(APP_VERSION), []);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shellReady || isActive || isZombieCall || !note) {
      setOpen(false);
      return;
    }
    setOpen(shouldShowReleaseNotes(note));
  }, [shellReady, isActive, isZombieCall, note]);

  const closeWithHighlights = useCallback(() => {
    if (note?.highlightElementIds?.length) {
      // Delay so header I/O strip is mounted after splash.
      window.setTimeout(() => {
        applyReleaseHighlights(note.highlightElementIds);
      }, 120);
    }
  }, [note]);

  const handleGotIt = useCallback(() => {
    if (note) markReleaseNotesSeen(note.version);
    setOpen(false);
    closeWithHighlights();
  }, [note, closeWithHighlights]);

  const handleLater = useCallback(() => {
    snoozeReleaseNotes();
    setOpen(false);
  }, []);

  const handleNever = useCallback(() => {
    if (note) dismissReleaseNotesForever(note.id);
    setOpen(false);
  }, [note]);

  const forceShow = useCallback(() => {
    if (note) setOpen(true);
  }, [note]);

  useEffect(() => {
    try {
      window.catintShowReleaseNotes = forceShow;
    } catch (_) {}
    return () => {
      try {
        delete window.catintShowReleaseNotes;
      } catch (_) {}
    };
  }, [forceShow]);

  return {
    note,
    open,
    handleGotIt,
    handleLater,
    handleNever,
    forceShow,
  };
};
