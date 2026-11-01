// Capa visual de la salida (subtítulos, destellos, avisos de gesto reconocido). Se monta una
// sola vez sobre todas las pantallas. Es aria-hidden: el servicio ya anuncia por ARIA.

import type { CueKind } from '../core/contracts';
import styles from './output.module.css';
import { useOutputStore } from './store';

const CUE_ICONS: Record<CueKind, string> = {
  success: '✅',
  error: '❌',
  gesture: '✋',
  navigate: '➡️',
  timer: '⏱',
  celebration: '🎉',
};

export function OutputLayer() {
  const caption = useOutputStore((s) => s.caption);
  const flash = useOutputStore((s) => s.flash);
  const gestureNotice = useOutputStore((s) => s.gestureNotice);

  return (
    <div className={styles.layer} aria-hidden="true">
      {flash && (
        // La key nueva reinicia la animación aunque el tipo se repita.
        <div key={flash.id} className={styles[flash.kind]}>
          <div className={styles.flash} />
          {flash.kind !== 'gesture' && (
            <div className={styles.flashIcon}>{CUE_ICONS[flash.kind]}</div>
          )}
        </div>
      )}
      {gestureNotice && (
        <div key={gestureNotice.id} className={styles.gestureNotice}>
          {gestureNotice.label}
        </div>
      )}
      {caption && (
        <p key={caption.id} className={styles.caption}>
          {caption.text}
        </p>
      )}
    </div>
  );
}
