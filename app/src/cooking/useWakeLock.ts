// Mantiene la pantalla encendida mientras se cocina: con las manos ocupadas nadie puede tocarla
// para despertarla. El sistema suelta el bloqueo al salir de la app, así que se vuelve a pedir
// al regresar.

import { useEffect } from 'react';

export function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    async function acquire() {
      if (sentinel || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (released) {
          void lock.release();
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          sentinel = null;
        });
      } catch {
        // Puede rechazarse, por ejemplo con batería baja. La app sigue funcionando igual.
      }
    }

    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release();
    };
  }, []);
}
