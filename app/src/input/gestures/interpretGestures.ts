// Traduce los cuadros de MediaPipe a comandos (RF-20, CA-15.1, CA-15.2).

import type { AccessibilityPrefs, Command, CommandContext } from '@chef/shared';

export interface GestureFrame {
  /** Gesto de MediaPipe o null si no hay mano. */
  category: string | null;
  /** Posición horizontal de la muñeca, de 0 a 1. */
  wristX: number | null;
}

type GesturePrefs = Pick<AccessibilityPrefs, 'enabledGestures' | 'gestureHoldMs'>;
type GestureContext = Pick<CommandContext, 'screen' | 'alertActive'>;

// La cámara frontal no está espejada. Si en el teléfono sale al revés, cambiar aquí.
export const USER_LEFT_IS_POSITIVE_X = true;

export interface InterpreterOptions {
  /** Ventana del deslizamiento, en ms. */
  swipeWindowMs?: number;
  /** Desplazamiento mínimo, en fracción del ancho. */
  swipeThreshold?: number;
  /** Pausa mínima entre comandos. */
  cooldownMs?: number;
  /** Movimiento permitido al sostener un gesto. */
  holdTolerance?: number;
}

export const SWIPE_THRESHOLD = { normal: 0.18, alta_tolerancia: 0.1 } as const;

const HOLD_GESTURES = new Set(['Open_Palm', 'Thumb_Up', 'Thumb_Down']);

export interface GestureInterpreter {
  update(frame: GestureFrame, t: number, ctx: GestureContext, prefs: GesturePrefs): Command | null;
  reset(): void;
}

function swipeCommand(direction: 'userLeft' | 'userRight', prefs: GesturePrefs): Command | null {
  if (direction === 'userLeft') {
    return prefs.enabledGestures.includes('deslizar_siguiente') ? { type: 'next' } : null;
  }
  return prefs.enabledGestures.includes('deslizar_anterior') ? { type: 'previous' } : null;
}

function holdCommand(category: string, ctx: GestureContext, prefs: GesturePrefs): Command | null {
  const enabled = prefs.enabledGestures;
  switch (category) {
    case 'Open_Palm':
      return enabled.includes('palma_abierta_pausar') ? { type: 'pause' } : null;
    case 'Thumb_Up':
      if (!enabled.includes('pulgar_arriba_confirmar')) return null;
      if (ctx.screen === 'celebration') return { type: 'rate', value: 'up' };
      return ctx.alertActive ? { type: 'dismissAlert' } : { type: 'confirm' };
    case 'Thumb_Down':
      // El pulgar abajo usa el mismo ajuste que el pulgar arriba.
      if (!enabled.includes('pulgar_arriba_confirmar') || ctx.screen !== 'celebration') return null;
      return { type: 'rate', value: 'down' };
    default:
      return null;
  }
}

export function createGestureInterpreter({
  swipeWindowMs = 400,
  swipeThreshold = SWIPE_THRESHOLD.normal,
  cooldownMs = 800,
  holdTolerance = 0.06,
}: InterpreterOptions = {}): GestureInterpreter {
  let samples: { x: number; t: number }[] = [];
  let hold: { category: string; since: number; x: number } | null = null;
  // Un gesto sostenido se dispara una sola vez.
  let firedCategory: string | null = null;
  let lastEmit = -Infinity;

  function reset(): void {
    samples = [];
    hold = null;
    firedCategory = null;
  }

  function emit(command: Command | null, t: number): Command | null {
    if (!command) return null;
    lastEmit = t;
    samples = [];
    hold = null;
    return command;
  }

  return {
    reset,

    update({ category, wristX }, t, ctx, prefs) {
      if (wristX === null) {
        reset();
        return null;
      }
      if (category !== firedCategory) firedCategory = null;
      if (t - lastEmit < cooldownMs) {
        samples = [];
        hold = null;
        return null;
      }

      // Deslizamiento de la muñeca.
      samples.push({ x: wristX, t });
      samples = samples.filter((s) => t - s.t <= swipeWindowMs);
      const dx = wristX - samples[0]!.x;
      if (Math.abs(dx) >= swipeThreshold) {
        const towardPositiveX = dx > 0;
        const userLeft = towardPositiveX === USER_LEFT_IS_POSITIVE_X;
        const command = swipeCommand(userLeft ? 'userLeft' : 'userRight', prefs);
        samples = [];
        hold = null;
        return emit(command, t);
      }

      // Gesto sostenido.
      if (!category || !HOLD_GESTURES.has(category) || category === firedCategory) {
        hold = null;
        return null;
      }
      if (!hold || hold.category !== category || Math.abs(wristX - hold.x) > holdTolerance) {
        hold = { category, since: t, x: wristX };
        return null;
      }
      if (t - hold.since < prefs.gestureHoldMs) return null;
      firedCategory = category;
      return emit(holdCommand(category, ctx, prefs), t);
    },
  };
}
