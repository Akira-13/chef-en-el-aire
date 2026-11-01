// Aviso discreto de "sin conexión" (CA-34.2). Reserva su propia franja arriba, para no tapar los
// controles del modo cocina.

import { useEffect } from 'react';
import { useOnlineStatus } from '../core/useOnlineStatus';
import styles from './ui.module.css';

export function OfflineBanner() {
  const online = useOnlineStatus();

  useEffect(() => {
    document.documentElement.dataset.offline = String(!online);
  }, [online]);

  if (online) return null;
  return (
    <p role="status" className={styles.offlineBanner}>
      Sin conexión · la receta sigue funcionando
    </p>
  );
}
