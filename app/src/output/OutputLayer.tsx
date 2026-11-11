// Capa visual de la salida (subtítulos, destellos, avisos de gesto reconocido). Se monta una
// sola vez sobre todas las pantallas. Es aria-hidden: el servicio ya anuncia por ARIA.

import { CUE_ICONS } from './cueIcons';
import styles from './output.module.css';
import { useOutputStore } from './store';

export function OutputLayer() {
  const caption = useOutputStore((s) => s.caption);
  const flash = useOutputStore((s) => s.flash);
  const gestureNotice = useOutputStore((s) => s.gestureNotice);
  const hint = useOutputStore((s) => s.hint);

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
      {hint && (
        <div key={hint.id} className={styles.hint}>
          <span className={styles.hintIcon}>{hint.icon}</span>
          <span>{hint.text}</span>
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
