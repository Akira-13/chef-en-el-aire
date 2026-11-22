// Modo prueba de voz (RNF-04, CA-13.5, CU-05): lógica pura para que un facilitador mida la tasa
// de aciertos de los 8 comandos esenciales. No guarda audio ni transcripciones, solo el comando
// reconocido y el resultado (RNF-11).

import type { Command, CommandEvent } from '@chef/shared';
import { normalizeSpeech } from '../voice/normalize';

/** Tiempo que se espera una respuesta antes de darla por no reconocida. */
export const RESPONSE_TIMEOUT_MS = 5000;
export const REQUESTS_PER_PARTICIPANT = 20;

export type NoiseLevel = 'quiet' | 'loud';

export const NOISE_LEVELS: Record<NoiseLevel, { label: string; threshold: number }> = {
  quiet: { label: '≤ 60 dB', threshold: 0.9 },
  loud: { label: '70 a 80 dB', threshold: 0.8 },
};

export interface EssentialCommand {
  id: string;
  /** Lo que el participante debe decir después de «chef». */
  phrase: string;
  matches(command: Command): boolean;
}

/** Los 8 comandos esenciales de CA-13.1. */
export const ESSENTIAL_COMMANDS: readonly EssentialCommand[] = [
  { id: 'next', phrase: 'siguiente', matches: (c) => c.type === 'next' },
  { id: 'previous', phrase: 'anterior', matches: (c) => c.type === 'previous' },
  { id: 'repeat', phrase: 'repetir', matches: (c) => c.type === 'repeat' },
  { id: 'pause', phrase: 'pausar', matches: (c) => c.type === 'pause' },
  { id: 'startTimer', phrase: 'inicia temporizador', matches: (c) => c.type === 'startTimer' },
  { id: 'queryTimer', phrase: '¿cuánto falta?', matches: (c) => c.type === 'queryTimer' },
  { id: 'explain', phrase: 'explícame', matches: (c) => c.type === 'explain' },
  {
    id: 'substitute',
    phrase: 'sustituye leche',
    matches: (c) => c.type === 'substitute' && normalizeSpeech(c.ingredient).includes('leche'),
  },
];

/** Generador pseudoaleatorio con semilla (mulberry32): la misma semilla da el mismo orden. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/**
 * Lista de pedidos de un participante: cada comando esencial las mismas veces y, si sobran
 * lugares, comandos distintos elegidos al azar; todo en orden aleatorio con semilla.
 */
export function generateRequests(
  seed: number,
  count = REQUESTS_PER_PARTICIPANT,
): EssentialCommand[] {
  const random = seededRandom(seed);
  const rounds = Math.floor(count / ESSENTIAL_COMMANDS.length);
  const requests = Array.from({ length: rounds }, () => ESSENTIAL_COMMANDS).flat();
  const extra = count - requests.length;
  requests.push(...shuffle(ESSENTIAL_COMMANDS, random).slice(0, extra));
  return shuffle(requests, random);
}

export interface TrialRequestResult {
  /** Posición en la lista, desde 1. */
  number: number;
  expected: string;
  /** Tipo de comando reconocido por voz, o null si no hubo nada en 5 s. */
  recognized: string | null;
  hit: boolean;
  skipped: boolean;
  noise: NoiseLevel;
  /** Milisegundos desde el pedido hasta lo reconocido; null si no hubo respuesta. */
  latencyMs: number | null;
  /** Veces que el facilitador repitió este pedido. */
  repeats: number;
}

export interface NoiseSummary {
  total: number;
  hits: number;
  /** Entre 0 y 1; 0 si no hubo pedidos. */
  rate: number;
  threshold: number;
  meets: boolean;
}

export interface TrialSummary {
  overall: { total: number; hits: number; rate: number };
  byNoise: Partial<Record<NoiseLevel, NoiseSummary>>;
  skipped: number;
}

/** Los pedidos saltados no cuentan ni a favor ni en contra. */
export function summarizeTrial(results: readonly TrialRequestResult[]): TrialSummary {
  const answered = results.filter((r) => !r.skipped);
  const byNoise: TrialSummary['byNoise'] = {};
  for (const level of Object.keys(NOISE_LEVELS) as NoiseLevel[]) {
    const group = answered.filter((r) => r.noise === level);
    if (group.length === 0) continue;
    const hits = group.filter((r) => r.hit).length;
    const rate = hits / group.length;
    const { threshold } = NOISE_LEVELS[level];
    byNoise[level] = { total: group.length, hits, rate, threshold, meets: rate >= threshold };
  }
  const hits = answered.filter((r) => r.hit).length;
  return {
    overall: {
      total: answered.length,
      hits,
      rate: answered.length === 0 ? 0 : hits / answered.length,
    },
    byNoise,
    skipped: results.length - answered.length,
  };
}

function percent(rate: number): number {
  return Math.round(rate * 100);
}

/** «Aciertos: 18/20 (90 %) · cumple ≥ 90 %», una línea por nivel de ruido usado. */
export function formatSummary(summary: TrialSummary): string[] {
  const used = (Object.keys(NOISE_LEVELS) as NoiseLevel[]).flatMap((level) => {
    const group = summary.byNoise[level];
    return group ? [{ level, group }] : [];
  });
  if (used.length === 0) return ['Aún no hay pedidos contestados.'];
  // Con varios niveles de ruido se antepone cuál es cada uno.
  return used.map(({ level, group }) => {
    const verdict = `${group.meets ? 'cumple' : 'no cumple'} ≥ ${percent(group.threshold)} %`;
    const line = `Aciertos: ${group.hits}/${group.total} (${percent(group.rate)} %) · ${verdict}`;
    return used.length > 1 ? `${NOISE_LEVELS[level].label} · ${line}` : line;
  });
}

export interface VoiceTrialExport {
  kind: 'voice-trial';
  version: 1;
  /** P01 a P08, sin datos personales. */
  participant?: string;
  seed: number;
  date: string;
  requests: TrialRequestResult[];
  summary: TrialSummary;
}

interface Pending {
  expected: EssentialCommand;
  askedAt: number;
  repeats: number;
}

export interface VoiceTrial {
  readonly seed: number;
  readonly total: number;
  /** Pedido en curso, o null al terminar. */
  current(): EssentialCommand | null;
  /** Número del pedido en curso (desde 1); total + 1 al terminar. */
  position(): number;
  finished(): boolean;
  results(): readonly TrialRequestResult[];
  noise(): NoiseLevel;
  setNoise(level: NoiseLevel): void;
  /** Empieza a contar el tiempo del pedido en curso. */
  begin(now: number): void;
  /** Un comando llegó por el bus; solo cuentan los de voz. Devuelve el resultado si cerró el pedido. */
  receive(event: Pick<CommandEvent, 'command' | 'channel'>, now: number): TrialRequestResult | null;
  /** Cierra el pedido como no reconocido si pasaron 5 s. */
  tick(now: number): TrialRequestResult | null;
  /** Vuelve a pedir lo mismo y reinicia el tiempo. */
  repeatRequest(now: number): void;
  skip(): TrialRequestResult | null;
  summary(): TrialSummary;
  export(participant: string | undefined, date: Date): VoiceTrialExport;
}

export function createVoiceTrial(seed: number, count = REQUESTS_PER_PARTICIPANT): VoiceTrial {
  const requests = generateRequests(seed, count);
  const results: TrialRequestResult[] = [];
  let noise: NoiseLevel = 'quiet';
  let pending: Pending | null = null;
  let begun = false;

  function currentRequest(): EssentialCommand | null {
    return requests[results.length] ?? null;
  }

  function close(
    recognized: string | null,
    hit: boolean,
    skipped: boolean,
    latencyMs: number | null,
  ): TrialRequestResult | null {
    const expected = currentRequest();
    if (!expected) return null;
    const result: TrialRequestResult = {
      number: results.length + 1,
      expected: expected.id,
      recognized,
      hit,
      skipped,
      noise,
      latencyMs,
      repeats: pending?.repeats ?? 0,
    };
    results.push(result);
    pending = null;
    begun = false;
    return result;
  }

  return {
    seed,
    total: requests.length,
    current: currentRequest,
    position: () => results.length + 1,
    finished: () => results.length >= requests.length,
    results: () => results,
    noise: () => noise,
    setNoise(level) {
      noise = level;
    },

    begin(now) {
      const expected = currentRequest();
      if (!expected || begun) return;
      begun = true;
      pending = { expected, askedAt: now, repeats: 0 };
    },

    receive(event, now) {
      if (event.channel !== 'voice' || !pending) return null;
      const hit = pending.expected.matches(event.command);
      return close(event.command.type, hit, false, Math.max(0, Math.round(now - pending.askedAt)));
    },

    tick(now) {
      if (!pending || now - pending.askedAt < RESPONSE_TIMEOUT_MS) return null;
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

    summary: () => summarizeTrial(results),

    export(participant, date) {
      return {
        kind: 'voice-trial',
        version: 1,
        ...(participant ? { participant } : {}),
        seed,
        date: date.toISOString(),
        requests: [...results],
        summary: summarizeTrial(results),
      };
    },
  };
}

/** Acepta solo códigos anónimos P01 a P99; cualquier otra cosa (un nombre) se descarta. */
export function sanitizeParticipant(value: string): string | undefined {
  const code = value.trim().toUpperCase();
  return /^P\d{2}$/.test(code) ? code : undefined;
}
