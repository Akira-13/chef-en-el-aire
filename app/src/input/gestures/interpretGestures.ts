// Traduce los cuadros de MediaPipe a comandos (RF-20, RF-22, CA-15.1, CA-15.2).

import type { AccessibilityPrefs, Command, CommandContext, GestureSensitivity } from '@chef/shared';

export interface GestureFrame {
  /** Gesto de MediaPipe o null si no hay mano o no se ve bien. */
  category: string | null;
  /** Posición horizontal de la muñeca, de 0 a 1; null si no hay mano. */
  wristX: number | null;
  /** Posición vertical de la muñeca, de 0 (arriba) a 1; null si no hay mano. */
  wristY: number | null;
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
  /** Cuadros dudosos que se toleran sin cortar un gesto sostenido, en ms. */
  graceMs?: number;
  /** Tiempo después de entrar la mano en que no se cuentan deslizamientos. */
  settleMs?: number;
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

// Con el pulgar o el índice levantado, mover la mano es acomodarla, no deslizar.
const POSE_GESTURES = new Set(['Thumb_Up', 'Thumb_Down', 'Pointing_Up']);

// Un deslizamiento es horizontal: bajar la mano en diagonal no cuenta.
const MAX_SWIPE_SLOPE = 0.8;

/** MediaPipe devuelve "None" cuando ve la mano pero no distingue un gesto. */
function gestureOf(category: string | null): string | null {
  return category === 'None' ? null : category;
}

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
  graceMs = 250,
  settleMs = 250,
  onActivate,
}: InterpreterOptions = {}): GestureInterpreter {
  let samples: { x: number; y: number; t: number; pose: boolean }[] = [];
  // La posición se compara con el promedio, no con el primer cuadro: así el temblor no la corta.
  let hold: { category: string; since: number; lastSeen: number; sumX: number; n: number } | null =
    null;
  // Un gesto sostenido se dispara una sola vez, hasta que se suelta.
  let fired: { category: string; lastSeen: number } | null = null;
  let enteredAt: number | null = null;
  let lastEmit = -Infinity;
  let activeUntil = -Infinity;

  function reset(): void {
    samples = [];
    hold = null;
    fired = null;
    enteredAt = null;
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
    if (category === fired?.category) {
      hold = null;
      return false;
    }
    const steady =
      hold?.category === category &&
      Math.abs(wristX - (hold.sumX + wristX) / (hold.n + 1)) <= holdTolerance;
    if (!hold || !steady) {
      hold = { category, since: t, lastSeen: t, sumX: wristX, n: 1 };
      return false;
    }
    hold.lastSeen = t;
    hold.sumX += wristX;
    hold.n++;
    if (t - hold.since < prefs.gestureHoldMs) return false;
    fired = { category, lastSeen: t };
    hold = null;
    return true;
  }

  /** Un cuadro dudoso no corta el gesto sostenido ni deja repetir el que ya se disparó. */
  function forgetReleased(gesture: string | null, t: number): void {
    if (fired) {
      if (gesture === fired.category) fired.lastSeen = t;
      else if (gesture !== null || t - fired.lastSeen > graceMs) fired = null;
    }
    if (hold) {
      const changed = gesture !== null && gesture !== hold.category;
      if (changed || (gesture === null && t - hold.lastSeen > graceMs)) hold = null;
    }
  }

  return {
    reset,

    update({ category, wristX, wristY }, t, ctx, prefs) {
      if (wristX === null || wristY === null) {
        reset();
        return null;
      }
      const gesture = gestureOf(category);
      enteredAt ??= t;
      forgetReleased(gesture, t);
      if (t - lastEmit < cooldownMs) {
        samples = [];
        hold = null;
        return null;
      }

      // Sin activar, solo cuenta el gesto de activación (CA-17.1).
      if (prefs.requiresActivationGesture && t > activeUntil) {
        samples = [];
        if (gesture === ACTIVATION_GESTURE && held(gesture, wristX, t, prefs)) {
          activeUntil = t + activationMs;
          lastEmit = t;
          onActivate?.();
        }
        return null;
      }

      // Deslizamiento de la muñeca. Al entrar al cuadro la mano se acomoda: eso no cuenta.
      if (t - enteredAt >= settleMs) {
        const pose = gesture !== null && POSE_GESTURES.has(gesture);
        samples.push({ x: wristX, y: wristY, t, pose });
      }
      samples = samples.filter((s) => t - s.t <= swipeWindowMs);
      const first = samples[0];
      const dx = first ? wristX - first.x : 0;
      const dy = first ? wristY - first.y : 0;
      const isSwipe =
        Math.abs(dx) >= swipeThreshold &&
        Math.abs(dy) <= Math.abs(dx) * MAX_SWIPE_SLOPE &&
        !samples.some((s) => s.pose);
      if (isSwipe) {
        const towardPositiveX = dx > 0;
        const userLeft = towardPositiveX === USER_LEFT_IS_POSITIVE_X;
        const command = swipeCommand(userLeft ? 'userLeft' : 'userRight', prefs);
        samples = [];
        hold = null;
        return emit(command, t);
      }

      // Gesto sostenido.
      if (!gesture || !HOLD_GESTURES.has(gesture)) return null;
      if (!held(gesture, wristX, t, prefs)) return null;
      return emit(holdCommand(gesture, ctx, prefs), t);
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
      if (wristX === null || gestureOf(category) !== null) {
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
