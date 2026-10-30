// Hora actual que se refresca cada segundo, para mostrar cuentas regresivas. Solo sirve para
// pintar: el tiempo restante de un temporizador sale siempre de su hora de fin.

import { useEffect, useState } from 'react';

export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [active]);
  return now;
}
