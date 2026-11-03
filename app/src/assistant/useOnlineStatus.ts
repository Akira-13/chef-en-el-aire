// Estado de la conexión del navegador. Es un respaldo local mientras no exista uno común en
// core/; el asistente lo usa para no llamar al servidor sin red (CA-35.2).

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** `false` cuando el navegador informa que no hay red; se actualiza al perderla o recuperarla. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
