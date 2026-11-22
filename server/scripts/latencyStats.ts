// Estadísticas y umbrales de latencia del asistente (RNF-03, CU-04). Lógica pura, sin red: la
// usa el script `measure-llm.ts` y se prueba aparte.

import type { LLMProviderId } from '@chef/shared';

/** Tiempo máximo aceptado en el percentil 90, por proveedor (ms). */
export const LATENCY_THRESHOLDS_MS: Record<LLMProviderId, number> = {
  remoto: 8000,
  ollama: 15000,
};

export interface LatencySummary {
  count: number;
  p50: number | null;
  p90: number | null;
  max: number | null;
}

export interface Verdict {
  thresholdMs: number;
  pass: boolean;
}

/** Percentil por rango más cercano; no modifica `samples`. Sin muestras devuelve null. */
export function percentile(samples: readonly number[], p: number): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1] ?? null;
}

export function summarize(samples: readonly number[]): LatencySummary {
  return {
    count: samples.length,
    p50: percentile(samples, 50),
    p90: percentile(samples, 90),
    max: percentile(samples, 100),
  };
}

/** Compara el p90 con el umbral del proveedor. Sin muestras no se puede afirmar que cumple. */
export function judge(provider: LLMProviderId, summary: LatencySummary): Verdict {
  const thresholdMs = LATENCY_THRESHOLDS_MS[provider];
  return { thresholdMs, pass: summary.p90 !== null && summary.p90 <= thresholdMs };
}
