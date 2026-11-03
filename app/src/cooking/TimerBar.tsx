// Barra de temporizadores activos, siempre visible en modo cocina (HU-11).

import { commandBus } from '../core/commandBus';
import { formatDuration } from '../ui/labels';
import styles from './cooking.module.css';
import { remainingSeconds, useTimers } from './timers';
import { useNow } from './useNow';

export function TimerBar() {
  const running = useTimers((state) => state.running);
  const now = useNow(running.length > 0);
  if (running.length === 0) return null;

  return (
    <ul className={styles.bar} aria-label="Temporizadores activos">
      {running.map((timer) => (
        <li key={timer.name} className={styles.barItem}>
          <span className={styles.barText}>
            ⏱ {timer.name} · {formatDuration(remainingSeconds(timer, now))}
          </span>
          <button
            type="button"
            className={styles.barStop}
            aria-label={`Detener temporizador ${timer.name}`}
            onClick={() => commandBus.emit({ type: 'stopTimer', name: timer.name }, 'touch')}
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
