import { beforeEach, describe, expect, it } from 'vitest';
import type { Recipe, Step } from '@chef/shared';
import {
  clearTimers,
  collectExpired,
  describeTimers,
  dismissExpired,
  findStepTimer,
  findTimer,
  formatSpokenDuration,
  remainingSeconds,
  startTimer,
  stopTimer,
  stopTimerByRequest,
  useTimers,
} from './timers';

const MINUTE = 60 * 1000;
const T0 = 1_000_000;

describe('temporizadores', () => {
  beforeEach(clearTimers);

  it('mantiene varios temporizadores a la vez, cada uno con su nombre (CA-11.2)', () => {
    startTimer('pollo', 1500, T0);
    startTimer('aderezo', 480, T0);
    expect(useTimers.getState().running.map((t) => t.name)).toEqual(['pollo', 'aderezo']);
    expect(describeTimers('pollo', T0 + 10 * MINUTE)).toBe('Pollo: faltan 15 minutos.');
    expect(describeTimers('aderezo', T0 + MINUTE)).toBe('Aderezo: faltan 7 minutos.');
  });

  it('responde por todos si no se dice cuál', () => {
    startTimer('pollo', 1500, T0);
    startTimer('aderezo', 480, T0);
    expect(describeTimers(undefined, T0)).toBe(
      'Pollo: faltan 25 minutos. Aderezo: faltan 8 minutos.',
    );
  });

  it('reconoce el nombre sin tildes ni mayúsculas', () => {
    startTimer('ají', 60, T0);
    expect(findTimer('AJI')?.name).toBe('ají');
    expect(findTimer('el ají')?.name).toBe('ají');
    expect(findTimer('pollo')).toBeUndefined();
  });

  it('no reinicia un temporizador que ya corre', () => {
    const first = startTimer('pollo', 1500, T0);
    const second = startTimer('pollo', 1500, T0 + MINUTE);
    expect(first.alreadyRunning).toBe(false);
    expect(second.alreadyRunning).toBe(true);
    expect(second.timer.endsAt).toBe(first.timer.endsAt);
  });

  it('calcula lo que falta contra el reloj, sin acumular desfase (RNF-18)', () => {
    const { timer } = startTimer('largo', 30 * 60, T0);
    expect(remainingSeconds(timer, T0 + 30 * MINUTE - 1000)).toBe(1);
    expect(remainingSeconds(timer, T0 + 30 * MINUTE)).toBe(0);
    expect(remainingSeconds(timer, T0 + 40 * MINUTE)).toBe(0);
  });

  it('pasa a la cola de alertas solo lo vencido, el más antiguo primero (RF-17)', () => {
    startTimer('b', 120, T0);
    startTimer('a', 60, T0);
    startTimer('c', 600, T0);
    const fresh = collectExpired(T0 + 3 * MINUTE);
    expect(fresh.map((t) => t.name)).toEqual(['a', 'b']);
    expect(useTimers.getState().running.map((t) => t.name)).toEqual(['c']);
    expect(collectExpired(T0 + 3 * MINUTE)).toEqual([]);
  });

  it('mantiene la alerta hasta confirmarla, una por una (CA-20.1)', () => {
    startTimer('a', 60, T0);
    startTimer('b', 60, T0);
    collectExpired(T0 + 2 * MINUTE);
    dismissExpired();
    expect(useTimers.getState().expired.map((t) => t.name)).toEqual(['b']);
    dismissExpired();
    expect(useTimers.getState().expired).toEqual([]);
  });

  it('descarta en silencio lo que venció hace mucho con la app cerrada', () => {
    startTimer('olvidado', 60, T0);
    expect(collectExpired(T0 + 24 * 60 * MINUTE)).toEqual([]);
    expect(useTimers.getState().running).toEqual([]);
    expect(useTimers.getState().expired).toEqual([]);
  });

  it('detiene por nombre', () => {
    startTimer('pollo', 60, T0);
    expect(stopTimer('pollo')?.name).toBe('pollo');
    expect(stopTimer('pollo')).toBeUndefined();
    expect(describeTimers(undefined, T0)).toBe('No hay temporizadores activos.');
  });

  it('detiene el único temporizador activo aunque no se diga cuál', () => {
    startTimer('pollo', 60, T0);
    expect(stopTimerByRequest()).toEqual({
      message: 'Temporizador pollo detenido.',
      stopped: true,
    });
  });

  it('pregunta cuál si hay varios y no se dice nombre', () => {
    startTimer('pollo', 60, T0);
    startTimer('aderezo', 60, T0);
    const result = stopTimerByRequest();
    expect(result.stopped).toBe(false);
    expect(result.message).toContain('pollo, aderezo');
    expect(useTimers.getState().running).toHaveLength(2);
  });

  it('informa si se pide un temporizador que no existe', () => {
    startTimer('pollo', 60, T0);
    expect(describeTimers('arroz', T0)).toBe('No hay un temporizador de arroz.');
  });

  it('se guarda en el dispositivo para sobrevivir a una recarga (RF-44)', () => {
    startTimer('pollo', 60, T0);
    expect(localStorage.getItem('chef.timers')).toContain('pollo');
  });
});

describe('formatSpokenDuration', () => {
  it.each([
    [1, '1 segundo'],
    [45, '45 segundos'],
    [60, '1 minuto'],
    [65, '1 minuto y 5 segundos'],
    [120, '2 minutos'],
    [299, '4 minutos y 59 segundos'],
    [300, '5 minutos'],
    [301, '6 minutos'],
    [1500, '25 minutos'],
  ])('%i s se dice "%s"', (seconds, spoken) => {
    expect(formatSpokenDuration(seconds)).toBe(spoken);
  });
});

describe('findStepTimer', () => {
  const pollo: Step = {
    number: 1,
    text: 'Sancocha',
    shortText: 'Sancochar',
    timerSeconds: 1500,
    timerName: 'pollo',
  };
  const sinTimer: Step = { number: 2, text: 'Licúa', shortText: 'Licuar', timerSeconds: null };
  const recipe = { steps: [pollo, sinTimer] } as Recipe;

  it('usa el temporizador del paso actual si no se dice nombre (CA-11.1)', () => {
    expect(findStepTimer(recipe, pollo)).toEqual({ name: 'pollo', seconds: 1500 });
  });

  it('busca por nombre en toda la receta', () => {
    expect(findStepTimer(recipe, sinTimer, 'pollo')).toEqual({ name: 'pollo', seconds: 1500 });
  });

  it('no devuelve nada si el paso no tiene temporizador', () => {
    expect(findStepTimer(recipe, sinTimer)).toBeUndefined();
    expect(findStepTimer(recipe, pollo, 'arroz')).toBeUndefined();
  });
});
