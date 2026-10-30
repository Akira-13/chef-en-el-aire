// Reloj y alertas de los temporizadores. Se monta una sola vez sobre todas las pantallas: la
// comida no espera aunque el usuario navegue (RF-16). La alerta es visual, sonora y persistente
// hasta que se confirma por cualquier canal (RF-17, CA-20.1).

import { useEffect, useRef } from 'react';
import { commandBus, useCommands } from '../core/commandBus';
import { updateCommandContext } from '../core/commandContext';
import { metrics } from '../core/metrics';
import { output, useProfile } from '../core/services';
import { Button, cx } from '../ui';
import styles from './cooking.module.css';
import {
  collectExpired,
  describeTimers,
  dismissExpired,
  formatSpokenDuration,
  stopTimerByRequest,
  useTimers,
  type Timer,
} from './timers';

const TICK_MS = 250;
const ALERT_REPEAT_MS = 5000;

function checkExpired(): void {
  const now = Date.now();
  for (const timer of collectExpired(now)) {
    metrics.record('timer.drift', now - timer.endsAt, 'ms', { timer: timer.name });
    output.announce({ text: `¡Temporizador terminado: ${timer.name}!`, kind: 'alert' });
  }
}

interface TimerAlertProps {
  timer: Timer;
  /** Alertas que esperan después de esta. */
  pending: number;
  fullScreen: boolean;
  flash: boolean;
}

function TimerAlert({ timer, pending, fullScreen, flash }: TimerAlertProps) {
  const button = useRef<HTMLButtonElement>(null);

  // El foco vuelve a donde estaba cuando se confirma la alerta (RNF-08).
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    button.current?.focus();
    return () => previous?.focus?.();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal={fullScreen}
      aria-labelledby="timer-alert-title"
      aria-describedby="timer-alert-hint"
      className={cx(
        styles.alert,
        fullScreen ? styles.alertFull : styles.alertBanner,
        flash && styles.alertFlash,
      )}
    >
      <span className={styles.alertIcon} aria-hidden="true">
        ⏰
      </span>
      <h2 id="timer-alert-title" className={styles.alertTitle}>
        ¡Terminó {timer.name}!
      </h2>
      <p>Temporizador de {formatSpokenDuration(timer.durationSeconds)}</p>
      {pending > 0 && (
        <p>{pending === 1 ? 'Hay 1 alerta más' : `Hay ${pending} alertas más`} después de esta.</p>
      )}
      <Button
        ref={button}
        variant="secondary"
        size="lg"
        block
        onClick={() => commandBus.emit({ type: 'dismissAlert' }, 'touch')}
      >
        Listo
      </Button>
      <p id="timer-alert-hint" className={styles.alertHint}>
        Di «chef, listo», muestra el pulgar arriba o toca el botón.
      </p>
    </div>
  );
}

export function TimerHost() {
  const { timerAlert } = useProfile().accessibility;
  const running = useTimers((state) => state.running);
  const expired = useTimers((state) => state.expired);
  const alert = expired[0];

  useEffect(() => {
    checkExpired();
    const interval = window.setInterval(checkExpired, TICK_MS);
    document.addEventListener('visibilitychange', checkExpired);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', checkExpired);
    };
  }, []);

  useEffect(() => {
    updateCommandContext({
      activeTimers: running.map((timer) => timer.name),
      alertActive: alert !== undefined,
    });
  }, [running, alert]);

  useEffect(() => {
    if (!alert || !timerAlert.sound) return;
    output.cue('timer');
    const interval = window.setInterval(() => output.cue('timer'), ALERT_REPEAT_MS);
    return () => window.clearInterval(interval);
  }, [alert, timerAlert.sound]);

  useCommands(({ command }) => {
    switch (command.type) {
      case 'queryTimer':
        output.announce({ text: describeTimers(command.name), kind: 'info' });
        break;
      case 'stopTimer': {
        const { message, stopped } = stopTimerByRequest(command.name);
        output.cue(stopped ? 'success' : 'error');
        output.announce({ text: message, kind: 'info' });
        break;
      }
      case 'dismissAlert':
      case 'confirm':
        if (alert) dismissExpired();
        break;
      default:
        break;
    }
  });

  if (!alert) return null;
  return (
    <TimerAlert
      key={`${alert.name}-${alert.endsAt}`}
      timer={alert}
      pending={expired.length - 1}
      fullScreen={timerAlert.fullScreenVisual}
      flash={timerAlert.flash !== false}
    />
  );
}
