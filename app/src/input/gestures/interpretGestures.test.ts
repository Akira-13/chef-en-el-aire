import { describe, expect, it } from 'vitest';
import type { AccessibilityPrefs, Command, CommandContext } from '@chef/shared';
import {
  createGestureInterpreter,
  USER_LEFT_IS_POSITIVE_X,
  type GestureFrame,
} from './interpretGestures';

type Prefs = Pick<AccessibilityPrefs, 'enabledGestures' | 'gestureHoldMs'>;

const ALL: Prefs = {
  enabledGestures: [
    'palma_abierta_pausar',
    'deslizar_siguiente',
    'deslizar_anterior',
    'pulgar_arriba_confirmar',
  ],
  gestureHoldMs: 300,
};

const COOKING: CommandContext = { screen: 'cooking', activeTimers: [], alertActive: false };

/** Pasa cuadros a 50 ms de distancia y devuelve los comandos emitidos. */
function run(
  frames: GestureFrame[],
  {
    ctx = COOKING,
    prefs = ALL,
    start = 0,
  }: { ctx?: CommandContext; prefs?: Prefs; start?: number } = {},
  interpreter = createGestureInterpreter(),
): Command[] {
  const out: Command[] = [];
  frames.forEach((frame, i) => {
    const command = interpreter.update(frame, start + i * 50, ctx, prefs);
    if (command) out.push(command);
  });
  return out;
}

function hold(category: string, count: number, x = 0.5): GestureFrame[] {
  return Array.from({ length: count }, () => ({ category, wristX: x }));
}

/** Mueve la muñeca de `from` a `to` en `count` cuadros. */
function move(from: number, to: number, count: number, category = 'None'): GestureFrame[] {
  return Array.from({ length: count }, (_, i) => ({
    category,
    wristX: from + ((to - from) * i) / (count - 1),
  }));
}

const userLeft = USER_LEFT_IS_POSITIVE_X ? [0.3, 0.7] : [0.7, 0.3];

describe('interpretación de gestos (CA-15.1, CA-15.2)', () => {
  it('deslizar hacia la izquierda del usuario avanza y hacia la derecha retrocede', () => {
    expect(run(move(userLeft[0]!, userLeft[1]!, 6))).toEqual([{ type: 'next' }]);
    expect(run(move(userLeft[1]!, userLeft[0]!, 6))).toEqual([{ type: 'previous' }]);
  });

  it('un movimiento lento o corto no es deslizamiento', () => {
    expect(run(move(0.45, 0.55, 6))).toEqual([]);
    expect(run(move(0.2, 0.6, 30))).toEqual([]);
  });

  it('la palma sostenida pausa; sin sostenerla no', () => {
    expect(run(hold('Open_Palm', 8))).toEqual([{ type: 'pause' }]);
    expect(run(hold('Open_Palm', 3))).toEqual([]);
  });

  it('deslizar con la palma abierta no pausa', () => {
    expect(run(move(userLeft[0]!, userLeft[1]!, 6, 'Open_Palm'))).toEqual([{ type: 'next' }]);
  });

  it('un gesto sostenido se dispara una sola vez hasta soltarlo', () => {
    expect(run(hold('Open_Palm', 60))).toEqual([{ type: 'pause' }]);
  });

  it('el pulgar arriba confirma, cierra alertas y valora en la celebración', () => {
    expect(run(hold('Thumb_Up', 8))).toEqual([{ type: 'confirm' }]);
    expect(run(hold('Thumb_Up', 8), { ctx: { ...COOKING, alertActive: true } })).toEqual([
      { type: 'dismissAlert' },
    ]);
    const celebration: CommandContext = { ...COOKING, screen: 'celebration' };
    expect(run(hold('Thumb_Up', 8), { ctx: celebration })).toEqual([{ type: 'rate', value: 'up' }]);
    expect(run(hold('Thumb_Down', 8), { ctx: celebration })).toEqual([
      { type: 'rate', value: 'down' },
    ]);
    expect(run(hold('Thumb_Down', 8))).toEqual([]);
  });

  it('ignora los gestos que el perfil no tiene habilitados', () => {
    const prefs: Prefs = { enabledGestures: ['deslizar_siguiente'], gestureHoldMs: 300 };
    expect(run(hold('Open_Palm', 8), { prefs })).toEqual([]);
    expect(run(move(userLeft[1]!, userLeft[0]!, 6), { prefs })).toEqual([]);
  });

  it('espera unos 800 ms entre dos comandos', () => {
    const interpreter = createGestureInterpreter();
    const swipe = move(userLeft[0]!, userLeft[1]!, 6);
    expect(run(swipe, {}, interpreter)).toHaveLength(1);
    expect(run(swipe, { start: 300 }, interpreter)).toHaveLength(0);
    expect(run(swipe, { start: 2000 }, interpreter)).toHaveLength(1);
  });

  it('sin mano visible no hace nada', () => {
    expect(run([{ category: null, wristX: null }])).toEqual([]);
  });
});
