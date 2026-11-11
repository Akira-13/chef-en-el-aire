import { describe, expect, it } from 'vitest';
import type { AccessibilityPrefs, Command, CommandContext } from '@chef/shared';
import {
  createGestureInterpreter,
  createHandWatcher,
  SENSITIVITY,
  USER_LEFT_IS_POSITIVE_X,
  type GestureFrame,
} from './interpretGestures';

type Prefs = Pick<
  AccessibilityPrefs,
  'enabledGestures' | 'gestureHoldMs' | 'requiresActivationGesture'
>;

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

function hold(category: string | null, count: number, x = 0.5): GestureFrame[] {
  return Array.from({ length: count }, () => ({ category, wristX: x, wristY: 0.5 }));
}

/** Con la mano ya quieta en `from`, mueve la muñeca hasta `to` en `count` cuadros. */
function move(
  from: number,
  to: number,
  count: number,
  category = 'None',
  { fromY = 0.5, toY = 0.5 } = {},
): GestureFrame[] {
  const still = hold('None', 5, from);
  return still.concat(
    Array.from({ length: count }, (_, i) => ({
      category,
      wristX: from + ((to - from) * i) / (count - 1),
      wristY: fromY + ((toY - fromY) * i) / (count - 1),
    })),
  );
}

/** Mueve la muñeca sin dejar que la mano se asiente antes. */
function enterMoving(from: number, to: number, count: number): GestureFrame[] {
  return move(from, to, count).slice(5);
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
    expect(run([{ category: null, wristX: null, wristY: null }])).toEqual([]);
  });
});

describe('robustez ante cuadros dudosos y movimientos que no son gestos', () => {
  const [from, to] = userLeft as [number, number];

  it('sostener tolera cuadros sueltos sin gesto', () => {
    const flicker = hold('Thumb_Up', 30).map((frame, i) =>
      i % 3 === 2 ? { ...frame, category: 'None' } : frame,
    );
    expect(run(flicker)).toEqual([{ type: 'confirm' }]);
    expect(run(flicker.map((frame, i) => (i % 3 === 2 ? { ...frame, category: null } : frame))))
      .toEqual([{ type: 'confirm' }]);
  });

  it('un cuadro dudoso no repite un gesto que sigue sostenido', () => {
    const frames = hold('Thumb_Up', 40);
    frames[12] = { ...frames[12]!, category: 'None' };
    expect(run(frames)).toEqual([{ type: 'confirm' }]);
  });

  it('soltar el gesto y repetirlo sí vuelve a dispararlo', () => {
    const frames = [...hold('Thumb_Up', 8), ...hold('None', 20), ...hold('Thumb_Up', 8)];
    expect(run(frames)).toEqual([{ type: 'confirm' }, { type: 'confirm' }]);
  });

  it('el temblor alrededor del mismo punto no impide sostener', () => {
    const tremor = hold('Thumb_Up', 20).map((frame, i) => ({
      ...frame,
      wristX: 0.5 + (i % 2 ? 0.035 : -0.035),
    }));
    expect(run(tremor)).toEqual([{ type: 'confirm' }]);
  });

  it('la mano que entra moviéndose no desliza', () => {
    expect(run(enterMoving(from, to, 6))).toEqual([]);
  });

  it('bajar la mano en diagonal no desliza', () => {
    expect(run(move(from, to, 6, 'None', { fromY: 0.4, toY: 0.9 }))).toEqual([]);
  });

  it('mover la mano con el pulgar levantado no desliza', () => {
    expect(run(move(from, to, 6, 'Thumb_Up'))).toEqual([]);
  });
});

describe('gesto de activación y movilidad (CA-17.1, CA-18.1, CA-18.2)', () => {
  const ACTIVATION: Prefs = { ...ALL, requiresActivationGesture: true };
  const swipe = move(userLeft[0]!, userLeft[1]!, 6);

  it('sin el índice levantado no acepta gestos', () => {
    expect(run(swipe, { prefs: ACTIVATION })).toEqual([]);
    expect(run(hold('Open_Palm', 8), { prefs: ACTIVATION })).toEqual([]);
  });

  it('tras el índice levantado acepta gestos durante 5 s', () => {
    let activations = 0;
    const interpreter = createGestureInterpreter({ onActivate: () => activations++ });
    expect(run(hold('Pointing_Up', 8), { prefs: ACTIVATION }, interpreter)).toEqual([]);
    expect(activations).toBe(1);
    expect(run(swipe, { prefs: ACTIVATION, start: 1500 }, interpreter)).toEqual([{ type: 'next' }]);
    expect(run(swipe, { prefs: ACTIVATION, start: 7000 }, interpreter)).toEqual([]);
  });

  it('con alta tolerancia basta un movimiento corto y lento', () => {
    const [from, to] = userLeft as [number, number];
    const short = move(from, from + (to - from) * 0.3, 10);
    expect(run(short)).toEqual([]);
    expect(run(short, {}, createGestureInterpreter(SENSITIVITY.alta_tolerancia))).toEqual([
      { type: 'next' },
    ]);
  });

  it('avisa si la mano no se ve bien por 3 s, como máximo cada 30 s', () => {
    const watcher = createHandWatcher();
    const unclear: GestureFrame = { category: null, wristX: 0.5, wristY: 0.5 };
    const warnings = (from: number, to: number) => {
      let count = 0;
      for (let t = from; t <= to; t += 100) if (watcher.update(unclear, t)) count++;
      return count;
    };
    expect(warnings(0, 2900)).toBe(0);
    expect(warnings(3000, 20000)).toBe(1);
    expect(warnings(20100, 40000)).toBe(1);
    expect(watcher.update({ category: null, wristX: null, wristY: null }, 40100)).toBe(false);
    expect(watcher.update({ category: 'Open_Palm', wristX: 0.5, wristY: 0.5 }, 40200)).toBe(false);
  });

  it('la mano sin gesto reconocible ("None") también cuenta como que no se ve bien', () => {
    const watcher = createHandWatcher();
    let warned = false;
    for (let t = 0; t <= 3000; t += 100) {
      warned ||= watcher.update({ category: 'None', wristX: 0.5, wristY: 0.5 }, t);
    }
    expect(warned).toBe(true);
  });
});
