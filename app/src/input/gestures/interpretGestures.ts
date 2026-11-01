// Traduce los cuadros de MediaPipe a comandos (RF-20, RF-22, CA-15.1, CA-15.2).

import type { AccessibilityPrefs, Command, CommandContext, GestureSensitivity } from '@chef/shared';

export interface GestureFrame {
  /** Gesto de MediaPipe o null si no hay mano o no se ve bien. */
  category: string | null;
  /** Posición horizontal de la muñeca, de 0 a 1; null si no hay mano. */
  wristX: number | null;
}

type GesturePrefs = Pick<
  AccessibilityPrefs,
  'enabledGestures' | 'gestureHoldMs' | 'requiresActivationGesture'
>;
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
  /** Tiempo en que se aceptan gestos después del gesto de activación (CA-17.1). */
  activationMs?: number;
  /** Se llama al reconocer el gesto de activación. */
  onActivate?: () => void;
}

// Con alta tolerancia bastan movimientos cortos y lentos, y la mano puede temblar (CA-18.1).
export const SENSITIVITY: Record<
  GestureSensitivity,
  Required<Pick<InterpreterOptions, 'swipeThreshold' | 'swipeWindowMs' | 'holdTolerance'>>
> = {
  normal: { swipeThreshold: 0.18, swipeWindowMs: 400, holdTolerance: 0.06 },
  alta_tolerancia: { swipeThreshold: 0.1, swipeWindowMs: 600, holdTolerance: 0.1 },
};

export const ACTIVATION_GESTURE = 'Pointing_Up';

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
  swipeWindowMs = SENSITIVITY.normal.swipeWindowMs,
  swipeThreshold = SENSITIVITY.normal.swipeThreshold,
  cooldownMs = 800,
  holdTolerance = SENSITIVITY.normal.holdTolerance,
  activationMs = 5000,
  onActivate,
}: InterpreterOptions = {}): GestureInterpreter {
  let samples: { x: number; t: number }[] = [];
  let hold: { category: string; since: number; x: number } | null = null;
  // Un gesto sostenido se dispara una sola vez.
  let firedCategory: string | null = null;
  let lastEmit = -Infinity;
  let activeUntil = -Infinity;

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

  /** True cuando `category` lleva sostenida `gestureHoldMs` con la mano quieta. */
  function held(category: string, wristX: number, t: number, prefs: GesturePrefs): boolean {
    if (category === firedCategory) {
      hold = null;
      return false;
    }
    if (!hold || hold.category !== category || Math.abs(wristX - hold.x) > holdTolerance) {
      hold = { category, since: t, x: wristX };
      return false;
    }
    if (t - hold.since < prefs.gestureHoldMs) return false;
    firedCategory = category;
    hold = null;
    return true;
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

      // Sin activar, solo cuenta el gesto de activación (CA-17.1).
      if (prefs.requiresActivationGesture && t > activeUntil) {
        samples = [];
        if (category === ACTIVATION_GESTURE && held(category, wristX, t, prefs)) {
          activeUntil = t + activationMs;
          lastEmit = t;
          onActivate?.();
        }
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
      if (!category || !HOLD_GESTURES.has(category)) {
        hold = null;
        return null;
      }
      if (!held(category, wristX, t, prefs)) return null;
      return emit(holdCommand(category, ctx, prefs), t);
    },
  };
}

export interface HandWatcher {
  /** True cuando toca avisar que la mano no se ve bien. */
  update(frame: GestureFrame, t: number): boolean;
}

// La mano está en cuadro pero el gesto no se distingue (CA-18.2).
export function createHandWatcher({ unclearMs = 3000, repeatMs = 30000 } = {}): HandWatcher {
  let unclearSince: number | null = null;
  let lastWarning = -Infinity;

  return {
    update({ category, wristX }, t) {
      if (wristX === null || category !== null) {
        unclearSince = null;
        return false;
      }
      unclearSince ??= t;
      if (t - unclearSince < unclearMs || t - lastWarning < repeatMs) return false;
      lastWarning = t;
      unclearSince = null;
      return true;
    },
  };
}
