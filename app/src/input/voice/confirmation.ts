// Confirmación de comandos de voz con baja confianza y sugerencia del canal alterno tras
// varios fallos seguidos (RF-19, CA-14.1, CA-14.2).

import { COMMAND_LABELS, type Command } from '@chef/shared';
import { commandBus } from '../../core/commandBus';
import { getCommandContext } from '../../core/commandContext';
import { metrics } from '../../core/metrics';
import { output, profileService } from '../../core/services';
import { clearHint, showHint } from '../../output';
import { gestureFor } from '../help';
import { isNo, isYes, needsConfirmation } from './answers';
import type { VoiceExtra } from './recognizer';

export const CONFIRM_TIMEOUT_MS = 6000;
export const FAILURES_BEFORE_HINT = 2;

/** Publica un comando de voz y mide hasta el siguiente cuadro (RNF-01). */
export function emitVoice(command: Command, extra: VoiceExtra): void {
  metrics.start('voice.commandToRender');
  commandBus.emit(command, 'voice', extra);
  requestAnimationFrame(() => metrics.end('voice.commandToRender', '', { command: command.type }));
}

interface Pending {
  command: Command;
  extra: VoiceExtra;
  timer: number;
  /** Aviso en pantalla de qué orden confirma el pulgar arriba. */
  hintId?: number;
}

export function createConfirmation() {
  let pending: Pending | null = null;
  let failures = 0;

  function clearPending(): Pending | null {
    const current = pending;
    if (current) {
      window.clearTimeout(current.timer);
      if (current.hintId !== undefined) clearHint(current.hintId);
    }
    pending = null;
    return current;
  }

  function accept(): void {
    const current = clearPending();
    if (!current) return;
    failures = 0;
    emitVoice(current.command, current.extra);
  }

  function fail(): void {
    const current = clearPending();
    if (!current) return;
    failures++;
    void profileService.recordEvent({ type: 'commandFailed', channel: 'voice' });
    if (failures < FAILURES_BEFORE_HINT) {
      output.announce({ text: 'No hice nada. Repite la orden con «chef».', kind: 'info' });
      return;
    }
    failures = 0;
    suggestOtherChannel(current.command);
  }

  function suggestOtherChannel(command: Command): void {
    const hint = gestureFor(
      command.type,
      getCommandContext(),
      profileService.getProfile().accessibility,
    );
    const base = 'No te entiendo bien. Puedes usar un gesto o tocar la pantalla.';
    if (!hint) {
      output.announce({ text: base, kind: 'info' });
      return;
    }
    showHint(hint.icon, `${hint.how}: ${hint.does}`);
    output.announce({
      text: `${base} Para ${COMMAND_LABELS[command.type]}: ${hint.how}.`,
      short: `Prueba con un gesto: ${hint.how}.`,
      kind: 'info',
    });
  }

  return {
    /** Recibe un comando reconocido por voz y lo publica o pide confirmarlo. */
    command(command: Command, extra: VoiceExtra, text: string): void {
      clearPending();
      if (!needsConfirmation(extra.confidence)) {
        failures = 0;
        emitVoice(command, extra);
        return;
      }
      const gestures = profileService.getProfile().accessibility.activeInputs.includes('gestos');
      pending = { command, extra, timer: window.setTimeout(fail, CONFIRM_TIMEOUT_MS) };
      // Un pulgar arriba confirma esta orden de voz, no la del paso: que se vea cuál es.
      if (gestures) pending.hintId = showHint('👍', `Pulgar arriba: ${COMMAND_LABELS[command.type]}`);
      output.announce({
        text: `¿Dijiste «${text}»? Di «sí»${gestures ? ' o haz pulgar arriba' : ''}.`,
        short: `¿Dijiste «${text}»?`,
        kind: 'info',
      });
    },

    /** Respuesta hablada a la confirmación; true si la consumió. */
    phrase(transcript: string): boolean {
      if (!pending) return false;
      if (isYes(transcript)) accept();
      else if (isNo(transcript)) fail();
      else return false;
      return true;
    },

    /** Pulgar arriba mientras se espera la confirmación; devuelve la orden de voz que confirmó. */
    gesture(command: Command): Command | null {
      if (!pending) return null;
      const thumbUp =
        command.type === 'confirm' ||
        command.type === 'dismissAlert' ||
        (command.type === 'rate' && command.value === 'up');
      if (!thumbUp) return null;
      const confirmed = pending.command;
      accept();
      return confirmed;
    },

    dispose(): void {
      clearPending();
    },
  };
}

export type Confirmation = ReturnType<typeof createConfirmation>;
