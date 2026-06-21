import { useEffect, useCallback } from 'react';
import { useSession } from '../contexts/SessionContext';
import {
  attachDevSimConsole,
  isDevSimEnabled,
  runDevSimAction,
} from '../utils/devSimulateCaptions';

/** Listens for cat_dev_simulate events (Settings dev panel + console). Dev only. */
export function useDevSimulate() {
  const { updateCaptions, clearCaptions } = useSession();

  const dispatch = useCallback(
    (detail) => runDevSimAction(detail, { updateCaptions, clearCaptions }),
    [updateCaptions, clearCaptions],
  );

  useEffect(() => {
    if (!isDevSimEnabled()) return;

    const handler = (e) => {
      dispatch(e.detail || {});
    };
    window.addEventListener('cat_dev_simulate', handler);

    attachDevSimConsole({
      inject: (opts) => dispatch({ action: 'inject', ...opts }),
      preset: (name) => dispatch({ action: 'preset', name }),
      clear: () => dispatch({ action: 'clear' }),
      interim: (opts) => dispatch({ action: 'interim_finalize', ...opts }),
    });

    return () => {
      window.removeEventListener('cat_dev_simulate', handler);
      try {
        delete window.__catDevSim;
      } catch (_) {}
    };
  }, [dispatch]);
}
