import { describe, expect, it } from 'vitest';
import type { Command } from '@chef/shared';
import {
  BASIC_GESTURES,
  COOKING_SESSION_MS,
  createCookingSession,
  createGestureRepetitions,
  exportGestureTrial,
  formatByGesture,
  formatCooking,
  formatRepetitions,
  generateGestureRequests,
  GESTURE_TIMEOUT_MS,
  type BasicGestureId,
} from './gestureTrial';

const gesture = (command: Command) => ({ command, channel: 'gesture' as const });

const COMMAND_OF: Record<BasicGestureId, Command> = {
  swipeLeft: { type: 'next' },
  swipeRight: { type: 'previous' },
  palm: { type: 'pause' },
  thumbUp: { type: 'confirm' },
};

/** Responde a cada intento; los números de `wrongAt` los falla con un gesto que no era. */
function answerAll(trial: ReturnType<typeof createGestureRepetitions>, wrongAt: number[] = []) {
  let now = 0;
  while (!trial.finished()) {
    trial.begin(now);
    const id = trial.current()?.id as BasicGestureId;
    const command = wrongAt.includes(trial.position())
      ? ({ type: 'cancel' } as Command)
      : COMMAND_OF[id];
    trial.receive(gesture(command), now + 700);
    now += 1000;
  }
}

describe('repeticiones de los 4 gestos básicos (CA-15.3, RNF-05)', () => {
  it('pide 10 repeticiones de cada uno de los 4 gestos en orden con semilla', () => {
    const requests = generateGestureRequests(5);
    expect(requests).toHaveLength(40);
    for (const g of BASIC_GESTURES) {
      expect(requests.filter((r) => r.id === g.id)).toHaveLength(10);
    }
    const ids = (seed: number) => generateGestureRequests(seed).map((r) => r.id);
    expect(ids(5)).toEqual(ids(5));
    expect(ids(5)).not.toEqual(ids(6));
  });

  it('cada gesto se reconoce con el comando que dispara', () => {
    const matches = (id: BasicGestureId, command: Command) =>
      BASIC_GESTURES.find((g) => g.id === id)?.matches(command);
    expect(matches('swipeLeft', { type: 'next' })).toBe(true);
    expect(matches('swipeRight', { type: 'previous' })).toBe(true);
    expect(matches('palm', { type: 'pause' })).toBe(true);
    expect(matches('thumbUp', { type: 'confirm' })).toBe(true);
    expect(matches('thumbUp', { type: 'dismissAlert' })).toBe(true);
    expect(matches('thumbUp', { type: 'rate', value: 'up' })).toBe(true);
    expect(matches('thumbUp', { type: 'rate', value: 'down' })).toBe(false);
    expect(matches('palm', { type: 'next' })).toBe(false);
  });

  it('36 de 40 cumple ≥ 90 % y muestra los aciertos por gesto', () => {
    const trial = createGestureRepetitions(3);
    answerAll(trial, [2, 9, 20, 33]);
    const summary = trial.summary();
    expect(summary.overall).toMatchObject({ total: 40, hits: 36, meets: true });
    expect(formatRepetitions(summary)).toBe('Aciertos: 36/40 (90 %) · cumple ≥ 90 %');
    expect(formatByGesture(summary)).toHaveLength(4);
    const perGesture = Object.values(summary.byGesture).reduce((n, t) => n + t.hits, 0);
    expect(perGesture).toBe(36);
  });

  it('35 de 40 no cumple', () => {
    const trial = createGestureRepetitions(3);
    answerAll(trial, [1, 2, 3, 4, 5]);
    expect(formatRepetitions(trial.summary())).toBe('Aciertos: 35/40 (88 %) · no cumple ≥ 90 %');
  });

  it('ignora lo que no llegó por gestos y cierra el intento sin respuesta a los 6 s', () => {
    const trial = createGestureRepetitions(1);
    trial.begin(0);
    expect(trial.receive({ command: { type: 'next' }, channel: 'voice' }, 100)).toBeNull();
    expect(trial.tick(GESTURE_TIMEOUT_MS - 1)).toBeNull();
    expect(trial.tick(GESTURE_TIMEOUT_MS)).toMatchObject({ recognized: null, hit: false });
  });

  it('repetir reinicia el tiempo y saltar no cuenta', () => {
    const trial = createGestureRepetitions(1);
    trial.begin(0);
    trial.repeatRequest(5000);
    expect(trial.tick(GESTURE_TIMEOUT_MS)).toBeNull();
    expect(trial.skip()).toMatchObject({ skipped: true, repeats: 1 });
    expect(trial.summary()).toMatchObject({ overall: { total: 0 }, skipped: 1 });
    expect(formatRepetitions(trial.summary())).toBe('Aún no hay intentos contestados.');
  });
});

describe('5 minutos de cocina: falsos positivos (CA-15.3, RNF-05)', () => {
  it('un gesto sin toque de "intencional" en ±2 s es un falso positivo', () => {
    const session = createCookingSession();
    session.start(0);
    session.receive(gesture({ type: 'next' }), 10_000);
    expect(session.summary(13_000).falsePositives).toBe(1);
  });

  it('un gesto con el toque de intencional antes o después (±2 s) no cuenta', () => {
    const session = createCookingSession();
    session.start(0);
    session.receive(gesture({ type: 'next' }), 10_000);
    session.mark(11_500);
    session.mark(18_000);
    session.receive(gesture({ type: 'pause' }), 19_800);
    expect(session.summary(30_000)).toMatchObject({
      recognized: 2,
      falsePositives: 0,
      missedIntentional: 0,
    });
  });

  it('espera 2 s antes de dar por falso un gesto, por si falta el toque', () => {
    const session = createCookingSession();
    session.start(0);
    session.receive(gesture({ type: 'next' }), 10_000);
    expect(session.summary(11_000)).toMatchObject({ falsePositives: 0, pending: 1 });
    session.mark(11_500);
    expect(session.summary(14_000)).toMatchObject({ falsePositives: 0, pending: 0 });
  });

  it('un toque sin gesto reconocido cuenta como gesto no detectado', () => {
    const session = createCookingSession();
    session.start(0);
    session.mark(40_000);
    expect(session.summary(50_000)).toMatchObject({ missedIntentional: 1, falsePositives: 0 });
  });

  it('con 5 min completos y 1 falso positivo cumple ≤ 1; con 2 no cumple', () => {
    const session = createCookingSession();
    session.start(0);
    session.receive(gesture({ type: 'next' }), 60_000);
    session.tick(COOKING_SESSION_MS);
    expect(session.running()).toBe(false);
    expect(session.summary(COOKING_SESSION_MS + 1000)).toMatchObject({
      falsePositives: 1,
      verdict: 'cumple',
      per5Min: 1,
    });

    const worse = createCookingSession();
    worse.start(0);
    worse.receive(gesture({ type: 'next' }), 60_000);
    worse.receive(gesture({ type: 'previous' }), 120_000);
    worse.tick(COOKING_SESSION_MS);
    expect(worse.summary(COOKING_SESSION_MS).verdict).toBe('no cumple');
  });

  it('una sesión corta se marca incompleta y no inventa un cumple', () => {
    const session = createCookingSession();
    session.start(0);
    session.stop(60_000);
    const summary = session.summary(60_000);
    expect(summary.verdict).toBe('incompleta');
    expect(formatCooking(summary)).toBe(
      'Falsos positivos: 0 en 1:00 · sesión incompleta (≤ 1 cada 5 min)',
    );
  });

  it('no cuenta gestos antes de empezar ni después de terminar, ni comandos de voz', () => {
    const session = createCookingSession();
    session.receive(gesture({ type: 'next' }), 0);
    session.start(1000);
    session.receive({ command: { type: 'next' }, channel: 'voice' }, 2000);
    session.tick(1000 + COOKING_SESSION_MS);
    session.receive(gesture({ type: 'next' }), 2000 + COOKING_SESSION_MS);
    expect(session.summary(1000 + COOKING_SESSION_MS).recognized).toBe(0);
  });
});

describe('exportación (RNF-11)', () => {
  it('exporta solo comandos y resultados, con tiempos relativos al inicio', () => {
    const trial = createGestureRepetitions(2);
    answerAll(trial);
    const session = createCookingSession();
    session.start(50_000);
    session.receive(gesture({ type: 'next' }), 55_000);
    session.stop(110_000);
    const data = exportGestureTrial(
      trial,
      session,
      'P04',
      new Date('2026-11-27T10:00:00Z'),
      120_000,
    );
    expect(data).toMatchObject({ kind: 'gesture-trial', participant: 'P04', seed: 2 });
    expect(data.repetitions?.summary.overall.hits).toBe(40);
    expect(data.cooking?.events).toEqual([{ atMs: 5000, command: 'next', falsePositive: true }]);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it('lo que no se hizo sale como null', () => {
    const data = exportGestureTrial(
      createGestureRepetitions(1),
      createCookingSession(),
      undefined,
      new Date(0),
      0,
    );
    expect(data.repetitions).toBeNull();
    expect(data.cooking).toBeNull();
    expect(data).not.toHaveProperty('participant');
  });
});
