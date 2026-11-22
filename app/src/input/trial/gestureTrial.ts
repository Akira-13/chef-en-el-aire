// Modo prueba de gestos (RNF-05, CA-15.3, CU-06): lógica pura para medir los aciertos de los 4
// gestos básicos y los falsos positivos en 5 minutos de cocina. No guarda video ni imágenes,
// solo el comando reconocido y el resultado (RNF-11).

import type { Command, CommandEvent } from '@chef/shared';
import { seededRandom, shuffle } from './seeded';

/** Tiempo que se espera el gesto antes de darlo por no reconocido. */
export const GESTURE_TIMEOUT_MS = 6000;
export const REPETITIONS_PER_GESTURE = 10;
export const ACCURACY_THRESHOLD = 0.9;
/** Un gesto reconocido sin toque de "gesto intencional" en este margen es un falso positivo. */
export const INTENTIONAL_WINDOW_MS = 2000;
export const COOKING_SESSION_MS = 5 * 60 * 1000;
/** Umbral de RNF-05: falsos positivos cada 5 minutos. */
export const FALSE_POSITIVE_LIMIT = 1;

export type BasicGestureId = 'swipeLeft' | 'swipeRight' | 'palm' | 'thumbUp';

export interface BasicGesture {
  id: BasicGestureId;
  label: string;
  icon: string;
  /** Cómo se hace, tal como se le dice a la persona. */
  how: string;
  matches(command: Command): boolean;
}

// Los 4 gestos básicos de CA-15.3 y el comando que dispara cada uno (help.ts, interpretGestures.ts).
export const BASIC_GESTURES: readonly BasicGesture[] = [
  {
    id: 'swipeLeft',
    label: 'Deslizar a la izquierda',
    icon: '👈',
    how: 'Desliza la mano hacia tu izquierda',
    matches: (c) => c.type === 'next',
  },
  {
    id: 'swipeRight',
    label: 'Deslizar a la derecha',
    icon: '👉',
    how: 'Desliza la mano hacia tu derecha',
    matches: (c) => c.type === 'previous',
  },
  {
    id: 'palm',
    label: 'Palma abierta',
    icon: '✋',
    how: 'Muestra la palma abierta y sostenla',
    matches: (c) => c.type === 'pause',
  },
  {
    id: 'thumbUp',
    label: 'Pulgar arriba',
    icon: '👍',
    how: 'Levanta el pulgar y sostenlo',
    matches: (c) =>
      c.type === 'confirm' || c.type === 'dismissAlert' || (c.type === 'rate' && c.value === 'up'),
  },
];

/** 10 repeticiones de cada gesto en orden aleatorio con semilla. */
export function generateGestureRequests(
  seed: number,
  repetitions = REPETITIONS_PER_GESTURE,
): BasicGesture[] {
  const all = Array.from({ length: repetitions }, () => BASIC_GESTURES).flat();
  return shuffle(all, seededRandom(seed));
}

export interface GestureAttempt {
  /** Posición en la lista, desde 1. */
  number: number;
  expected: BasicGestureId;
  /** Tipo de comando que reconoció el canal de gestos, o null si no hubo nada a tiempo. */
  recognized: string | null;
  hit: boolean;
  skipped: boolean;
  latencyMs: number | null;
  repeats: number;
}

export interface GestureTally {
  total: number;
  hits: number;
  /** Entre 0 y 1; 0 si no hubo intentos. */
  rate: number;
  meets: boolean;
}

export interface RepetitionsSummary {
  overall: GestureTally;
  byGesture: Record<BasicGestureId, GestureTally>;
  skipped: number;
}

function tally(attempts: readonly GestureAttempt[]): GestureTally {
  const hits = attempts.filter((a) => a.hit).length;
  const rate = attempts.length === 0 ? 0 : hits / attempts.length;
  return {
    total: attempts.length,
    hits,
    rate,
    meets: attempts.length > 0 && rate >= ACCURACY_THRESHOLD,
  };
}

/** Los intentos saltados no cuentan ni a favor ni en contra. */
export function summarizeRepetitions(attempts: readonly GestureAttempt[]): RepetitionsSummary {
  const answered = attempts.filter((a) => !a.skipped);
  const byGesture = Object.fromEntries(
    BASIC_GESTURES.map((g) => [g.id, tally(answered.filter((a) => a.expected === g.id))]),
  ) as Record<BasicGestureId, GestureTally>;
  return { overall: tally(answered), byGesture, skipped: attempts.length - answered.length };
}

function percent(rate: number): number {
  return Math.round(rate * 100);
}

/** «Aciertos: 36/40 (90 %) · cumple ≥ 90 %». */
export function formatRepetitions(summary: RepetitionsSummary): string {
  const { overall } = summary;
  if (overall.total === 0) return 'Aún no hay intentos contestados.';
  const verdict = `${overall.meets ? 'cumple' : 'no cumple'} ≥ ${percent(ACCURACY_THRESHOLD)} %`;
  return `Aciertos: ${overall.hits}/${overall.total} (${percent(overall.rate)} %) · ${verdict}`;
}

export function formatByGesture(summary: RepetitionsSummary): string[] {
  return BASIC_GESTURES.flatMap((g) => {
    const t = summary.byGesture[g.id];
    return t.total === 0 ? [] : `${g.label}: ${t.hits}/${t.total} (${percent(t.rate)} %)`;
  });
}

interface Pending {
  expected: BasicGesture;
  askedAt: number;
  repeats: number;
}

export interface GestureRepetitions {
  readonly seed: number;
  readonly total: number;
  current(): BasicGesture | null;
  /** Número del intento en curso (desde 1). */
  position(): number;
  finished(): boolean;
  attempts(): readonly GestureAttempt[];
  begin(now: number): void;
  /** Un comando llegó por el bus; solo cuentan los de gestos. */
  receive(event: Pick<CommandEvent, 'command' | 'channel'>, now: number): GestureAttempt | null;
  tick(now: number): GestureAttempt | null;
  repeatRequest(now: number): void;
  skip(): GestureAttempt | null;
  summary(): RepetitionsSummary;
}

export function createGestureRepetitions(
  seed: number,
  repetitions = REPETITIONS_PER_GESTURE,
): GestureRepetitions {
  const requests = generateGestureRequests(seed, repetitions);
  const attempts: GestureAttempt[] = [];
  let pending: Pending | null = null;
  let begun = false;

  const currentRequest = (): BasicGesture | null => requests[attempts.length] ?? null;

  function close(
    recognized: string | null,
    hit: boolean,
    skipped: boolean,
    latencyMs: number | null,
  ): GestureAttempt | null {
    const expected = currentRequest();
    if (!expected) return null;
    const attempt: GestureAttempt = {
      number: attempts.length + 1,
      expected: expected.id,
      recognized,
      hit,
      skipped,
      latencyMs,
      repeats: pending?.repeats ?? 0,
    };
    attempts.push(attempt);
    pending = null;
    begun = false;
    return attempt;
  }

  return {
    seed,
    total: requests.length,
    current: currentRequest,
    position: () => attempts.length + 1,
    finished: () => attempts.length >= requests.length,
    attempts: () => attempts,

    begin(now) {
      const expected = currentRequest();
      if (!expected || begun) return;
      begun = true;
      pending = { expected, askedAt: now, repeats: 0 };
    },

    receive(event, now) {
      if (event.channel !== 'gesture' || !pending) return null;
      const hit = pending.expected.matches(event.command);
      return close(event.command.type, hit, false, Math.max(0, Math.round(now - pending.askedAt)));
    },

    tick(now) {
      if (!pending || now - pending.askedAt < GESTURE_TIMEOUT_MS) return null;
      return close(null, false, false, null);
    },

    repeatRequest(now) {
      if (!pending) return;
      pending = { ...pending, askedAt: now, repeats: pending.repeats + 1 };
    },

    skip() {
      if (!currentRequest()) return null;
      return close(null, false, true, null);
    },

    summary: () => summarizeRepetitions(attempts),
  };
}

// ---------- 5 minutos de cocina: falsos positivos ----------

export type CookingVerdict = 'cumple' | 'no cumple' | 'incompleta';

export interface CookingSummary {
  elapsedMs: number;
  /** Gestos reconocidos en total. */
  recognized: number;
  falsePositives: number;
  /** Gestos de los últimos 2 s, que aún pueden recibir su toque de "intencional". */
  pending: number;
  /** Toques de "intencional" sin gesto reconocido: el gesto no se detectó. */
  missedIntentional: number;
  intentionalMarks: number;
  /** Falsos positivos llevados a 5 minutos. */
  per5Min: number;
  /** Cumple o no solo con la sesión completa, salvo que ya haya pasado el límite. */
  verdict: CookingVerdict;
}

export interface CookingEventExport {
  atMs: number;
  command: string;
  falsePositive: boolean;
}

export interface CookingExport extends CookingSummary {
  events: CookingEventExport[];
}

export interface CookingSession {
  start(now: number): void;
  stop(now: number): void;
  /** Detiene la sesión sola al cumplirse los 5 minutos. */
  tick(now: number): void;
  running(): boolean;
  started(): boolean;
  /** El facilitador toca "gesto intencional". */
  mark(now: number): void;
  /** Un comando llegó por el bus; solo cuentan los de gestos mientras corre la sesión. */
  receive(event: Pick<CommandEvent, 'command' | 'channel'>, now: number): void;
  summary(now: number): CookingSummary;
  export(now: number): CookingExport;
}

export function createCookingSession(): CookingSession {
  let startedAt: number | null = null;
  let stoppedAt: number | null = null;
  const gestures: { at: number; command: string }[] = [];
  const marks: number[] = [];

  const running = (): boolean => startedAt !== null && stoppedAt === null;
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= INTENTIONAL_WINDOW_MS;

  function summary(now: number): CookingSummary {
    const start = startedAt ?? now;
    const end = stoppedAt ?? now;
    const elapsedMs = Math.min(Math.max(0, end - start), COOKING_SESSION_MS);
    // Con la sesión corriendo, lo ocurrido en los últimos 2 s puede recibir aún su toque.
    const settled = (at: number): boolean => !running() || now - at > INTENTIONAL_WINDOW_MS;
    const unmatched = gestures.filter((g) => !marks.some((m) => near(m, g.at)));
    const falsePositives = unmatched.filter((g) => settled(g.at)).length;
    const missedIntentional = marks.filter(
      (m) => settled(m) && !gestures.some((g) => near(m, g.at)),
    ).length;
    const per5Min = elapsedMs === 0 ? 0 : (falsePositives * COOKING_SESSION_MS) / elapsedMs;
    const complete = elapsedMs >= COOKING_SESSION_MS && !running();
    const verdict: CookingVerdict = complete
      ? falsePositives <= FALSE_POSITIVE_LIMIT
        ? 'cumple'
        : 'no cumple'
      : falsePositives > FALSE_POSITIVE_LIMIT
        ? 'no cumple'
        : 'incompleta';
    return {
      elapsedMs,
      recognized: gestures.length,
      falsePositives,
      pending: unmatched.length - falsePositives,
      missedIntentional,
      intentionalMarks: marks.length,
      per5Min: Math.round(per5Min * 100) / 100,
      verdict,
    };
  }

  return {
    start(now) {
      if (startedAt !== null) return;
      startedAt = now;
    },
    stop(now) {
      if (!running() || startedAt === null) return;
      stoppedAt = Math.min(now, startedAt + COOKING_SESSION_MS);
    },
    tick(now) {
      if (running() && startedAt !== null && now - startedAt >= COOKING_SESSION_MS) {
        stoppedAt = startedAt + COOKING_SESSION_MS;
      }
    },
    running,
    started: () => startedAt !== null,
    mark(now) {
      if (running()) marks.push(now);
    },
    receive(event, now) {
      if (event.channel !== 'gesture' || !running()) return;
      gestures.push({ at: now, command: event.command.type });
    },
    summary,
    export(now) {
      const start = startedAt ?? now;
      return {
        ...summary(now),
        events: gestures.map((g) => ({
          atMs: Math.round(g.at - start),
          command: g.command,
          falsePositive: !marks.some((m) => near(m, g.at)),
        })),
      };
    },
  };
}

export function formatCooking(summary: CookingSummary): string {
  const minutes = Math.floor(summary.elapsedMs / 60000);
  const seconds = Math.floor((summary.elapsedMs % 60000) / 1000);
  const time = `${minutes}:${String(seconds).padStart(2, '0')}`;
  const label = summary.verdict === 'incompleta' ? 'sesión incompleta' : summary.verdict;
  return `Falsos positivos: ${summary.falsePositives} en ${time} · ${label} (≤ ${FALSE_POSITIVE_LIMIT} cada 5 min)`;
}

export interface GestureTrialExport {
  kind: 'gesture-trial';
  version: 1;
  /** P01 a P08, sin datos personales. */
  participant?: string;
  seed: number;
  date: string;
  repetitions: { attempts: GestureAttempt[]; summary: RepetitionsSummary } | null;
  cooking: CookingExport | null;
}

export function exportGestureTrial(
  repetitions: GestureRepetitions,
  cooking: CookingSession,
  participant: string | undefined,
  date: Date,
  now: number,
): GestureTrialExport {
  const hasAttempts = repetitions.attempts().length > 0;
  return {
    kind: 'gesture-trial',
    version: 1,
    ...(participant ? { participant } : {}),
    seed: repetitions.seed,
    date: date.toISOString(),
    repetitions: hasAttempts
      ? { attempts: [...repetitions.attempts()], summary: repetitions.summary() }
      : null,
    cooking: cooking.started() ? cooking.export(now) : null,
  };
}
