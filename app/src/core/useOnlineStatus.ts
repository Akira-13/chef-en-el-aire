// Estado de la conexión. Sin red, la receta en curso sigue funcionando, pero lo que depende del
// servidor debe marcarse como no disponible (CA-34.2, CA-35.2).

import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine);
}
