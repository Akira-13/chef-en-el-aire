// Temporizadores con nombre (RF-16). Cada uno guarda su hora de fin absoluta y el tiempo
// restante siempre se calcula contra el reloj, así no se atrasan aunque el navegador frene los
// intervalos en segundo plano (RNF-18). Se guardan en el dispositivo para sobrevivir a una
// recarga o a que el sistema cierre la pestaña (RF-44).

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Recipe, Step } from '@chef/shared';
import { normalizeText } from '../personalization';

export interface Timer {
  name: string;
  durationSeconds: number;
  /** Hora de fin, en milisegundos de Date.now(). */
  endsAt: number;
  /** Milisegundos que faltaban al pausar; solo existe mientras está en pausa. */
  pausedRemainingMs?: number;
}

interface TimerState {
  running: Timer[];
  /** Vencidos que esperan confirmación, el más antiguo primero (RF-17). */
  expired: Timer[];
}

// Un temporizador que venció hace más de esto, con la app cerrada, ya no sirve como alerta.
const STALE_AFTER_MS = 60 * 60 * 1000;

export const useTimers = create<TimerState>()(
  persist(() => ({ running: [], expired: [] }) as TimerState, {
    name: 'chef.timers',
    storage: createJSONStorage(() => localStorage),
  }),
);

function matchesName(timerName: string, query: string): boolean {
  const name = normalizeText(timerName);
  const q = normalizeText(query);
  return q.length > 0 && (name.includes(q) || q.includes(name));
}

export function findTimer(name: string): Timer | undefined {
  return useTimers.getState().running.find((timer) => matchesName(timer.name, name));
}

/** Inicia un temporizador; si ya hay uno con ese nombre, lo deja seguir sin reiniciarlo. */
export function startTimer(
  name: string,
  durationSeconds: number,
  now = Date.now(),
): { timer: Timer; alreadyRunning: boolean } {
  const existing = findTimer(name);
  if (existing) return { timer: existing, alreadyRunning: true };
  const timer: Timer = { name, durationSeconds, endsAt: now + durationSeconds * 1000 };
  useTimers.setState((state) => ({ running: [...state.running, timer] }));
  return { timer, alreadyRunning: false };
}

export function stopTimer(name: string): Timer | undefined {
  const timer = findTimer(name);
  if (timer) {
    useTimers.setState((state) => ({ running: state.running.filter((t) => t !== timer) }));
  }
  return timer;
}

/** Pasa a la cola de alertas los temporizadores vencidos y devuelve los nuevos. */
export function collectExpired(now = Date.now()): Timer[] {
  const { running, expired } = useTimers.getState();
  const due = running
    .filter((timer) => timer.pausedRemainingMs === undefined && timer.endsAt <= now)
    .sort((a, b) => a.endsAt - b.endsAt);
  if (due.length === 0) return [];
  const fresh = due.filter((timer) => now - timer.endsAt < STALE_AFTER_MS);
  useTimers.setState({
    running: running.filter((timer) => !due.includes(timer)),
    expired: [...expired, ...fresh],
  });
  return fresh;
}

/** Congela los temporizadores que corren; los que ya estaban en pausa no pierden tiempo. */
export function pauseTimers(now = Date.now()): void {
  useTimers.setState((state) => ({
    running: state.running.map((timer) =>
      timer.pausedRemainingMs === undefined
        ? { ...timer, pausedRemainingMs: Math.max(0, timer.endsAt - now) }
        : timer,
    ),
  }));
}

/** Reanuda los temporizadores en pausa con el tiempo que les quedaba. */
export function resumeTimers(now = Date.now()): void {
  const { running } = useTimers.getState();
  if (running.every((timer) => timer.pausedRemainingMs === undefined)) return;
  useTimers.setState({
    running: running.map(({ pausedRemainingMs, ...timer }) =>
      pausedRemainingMs === undefined ? timer : { ...timer, endsAt: now + pausedRemainingMs },
    ),
  });
}

/** Confirma la alerta más antigua; si hay otra en cola, pasa a mostrarse. */
export function dismissExpired(): void {
  useTimers.setState((state) => ({ expired: state.expired.slice(1) }));
}

export function clearTimers(): void {
  useTimers.setState({ running: [], expired: [] });
}

export function remainingSeconds(timer: Timer, now = Date.now()): number {
  const remainingMs = timer.pausedRemainingMs ?? timer.endsAt - now;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Duración para decir en voz alta. Con 5 minutos o más, los segundos solo estorban. */
export function formatSpokenDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return plural(seconds, 'segundo');
  if (minutes >= 5) return plural(Math.ceil(totalSeconds / 60), 'minuto');
  return seconds === 0
    ? plural(minutes, 'minuto')
    : `${plural(minutes, 'minuto')} y ${plural(seconds, 'segundo')}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function describeTimer(timer: Timer, now: number): string {
  return `${capitalize(timer.name)}: faltan ${formatSpokenDuration(remainingSeconds(timer, now))}.`;
}

/** Respuesta a "¿cuánto falta?": un temporizador por nombre o todos los activos (CA-11.2). */
export function describeTimers(name?: string, now = Date.now()): string {
  const { running } = useTimers.getState();
  if (running.length === 0) return 'No hay temporizadores activos.';
  if (name) {
    const timer = findTimer(name);
    return timer ? describeTimer(timer, now) : `No hay un temporizador de ${name}.`;
  }
  return running.map((timer) => describeTimer(timer, now)).join(' ');
}

/** Atiende "detén el temporizador": sin nombre solo actúa si no hay duda de cuál es. */
export function stopTimerByRequest(name?: string): { message: string; stopped: boolean } {
  const { running } = useTimers.getState();
  if (running.length === 0) return { message: 'No hay temporizadores activos.', stopped: false };
  const only = running.length === 1 ? running[0] : undefined;
  const target = name ?? only?.name;
  if (!target) {
    const names = running.map((timer) => timer.name).join(', ');
    return { message: `¿Cuál temporizador detengo? Hay varios: ${names}.`, stopped: false };
  }
  const timer = stopTimer(target);
  return timer
    ? { message: `Temporizador ${timer.name} detenido.`, stopped: true }
    : { message: `No hay un temporizador de ${target}.`, stopped: false };
}

export interface StepTimer {
  name: string;
  seconds: number;
}

/** Temporizador que corresponde a un pedido: el del paso actual o, por nombre, el de otro paso. */
export function findStepTimer(recipe: Recipe, step: Step, name?: string): StepTimer | undefined {
  const target = name
    ? recipe.steps.find((s) => s.timerName && matchesName(s.timerName, name))
    : step;
  if (!target?.timerName || target.timerSeconds === null) return undefined;
  return { name: target.timerName, seconds: target.timerSeconds };
}
