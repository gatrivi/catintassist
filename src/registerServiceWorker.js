const UPDATE_EVENT = 'catint_update_available';

export const registerServiceWorker = (onUpdate) => {
  if (!('serviceWorker' in navigator)) return () => {};

  let registration;

  const handleUpdate = () => {
    if (typeof onUpdate === 'function') onUpdate();
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              handleUpdate();
            }
          });
        });
      })
      .catch((err) => console.warn('[SW] register failed', err));
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  return () => {
    if (registration) registration.unregister();
  };
};

export const applyServiceWorkerUpdate = () => {
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.ready.then((reg) => {
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    window.location.reload();
  });
};

export { UPDATE_EVENT };
