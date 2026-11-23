// Resumen de las métricas contra el umbral de cada RNF (CA-37.1, CA-37.2). Es puro: recibe las
// muestras de `metrics.samples()` y devuelve una fila por métrica con n, p50, p90, p95 y si cumple.

import type { MetricName, MetricSample } from '@chef/shared';

export type MetricStatus = 'Cumple' | 'No cumple' | 'Sin datos';

/** Qué valor de la métrica se compara con el umbral. */
type Statistic = { kind: 'percentile'; p: number } | { kind: 'maxAbs' };

interface MetricRule {
  name: MetricName;
  rnf: string;
  statistic: Statistic;
  /** `max`: el valor debe ser ≤ umbral; `min`: debe ser ≥ umbral. */
  direction: 'max' | 'min';
  threshold: number;
}

// Umbrales de `temp/jarem.md` T3, tomados de docs/05-requerimientos.md.
export const METRIC_RULES: readonly MetricRule[] = [
  {
    name: 'voice.commandToRender',
    rnf: 'RNF-01',
    statistic: { kind: 'percentile', p: 95 },
    direction: 'max',
    threshold: 1500,
  },
  {
    name: 'gesture.toAction',
    rnf: 'RNF-02',
    statistic: { kind: 'percentile', p: 95 },
    direction: 'max',
    threshold: 300,
  },
  {
    name: 'gesture.fps',
    rnf: 'RNF-02',
    statistic: { kind: 'percentile', p: 5 },
    direction: 'min',
    threshold: 15,
  },
  {
    name: 'llm.thinking',
    rnf: 'RNF-03',
    statistic: { kind: 'percentile', p: 95 },
    direction: 'max',
    threshold: 1000,
  },
  {
    name: 'llm.response',
    rnf: 'RNF-03',
    statistic: { kind: 'percentile', p: 90 },
    direction: 'max',
    threshold: 8000,
  },
  {
    name: 'timer.drift',
    rnf: 'RNF-18',
    statistic: { kind: 'maxAbs' },
    direction: 'max',
    threshold: 1000,
  },
  {
    name: 'profile.save',
    rnf: 'RNF-17',
    statistic: { kind: 'percentile', p: 95 },
    direction: 'max',
    threshold: 1000,
  },
  {
    name: 'channel.fallback',
    rnf: 'RNF-15',
    statistic: { kind: 'percentile', p: 95 },
    direction: 'max',
    threshold: 3000,
  },
  {
    name: 'community.visible',
    rnf: 'RNF-09',
    statistic: { kind: 'percentile', p: 95 },
    direction: 'max',
    threshold: 5000,
  },
  {
    name: 'community.queueFlush',
    rnf: 'RNF-09',
    statistic: { kind: 'percentile', p: 95 },
    direction: 'max',
    threshold: 10000,
  },
];

/** Umbral de `llm.response` con un modelo local (Ollama), que es más lento que uno remoto. */
export const LLM_RESPONSE_LOCAL_THRESHOLD = 15000;

export interface MetricSummary {
  /** Nombre de la métrica; con `· ollama` cuando son las respuestas del modelo local. */
  name: string;
  rnf: string;
  n: number;
  p50: number | null;
  p90: number | null;
  p95: number | null;
  /** Estadístico que se compara con el umbral: «p95», «p5», «p90» o «máx. |x|». */
  compared: string;
  /** Valor del estadístico comparado; null sin datos. */
  value: number | null;
  threshold: number;
  direction: 'max' | 'min';
  unit: 'ms' | 'fps';
  status: MetricStatus;
}

/** Percentil por rango más cercano; null si no hay valores. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p * sorted.length) / 100 - 1e-9));
  return sorted[Math.min(rank, sorted.length) - 1] ?? null;
}

function statisticLabel(statistic: Statistic): string {
  return statistic.kind === 'maxAbs' ? 'máx. |x|' : `p${statistic.p}`;
}

function summarizeGroup(
  rule: MetricRule,
  name: string,
  threshold: number,
  samples: readonly MetricSample[],
): MetricSummary {
  // El desfase del temporizador puede ser negativo (suena antes): importa su tamaño.
  const values = samples.map((s) =>
    rule.statistic.kind === 'maxAbs' ? Math.abs(s.value) : s.value,
  );
  const value =
    rule.statistic.kind === 'maxAbs'
      ? values.length === 0
        ? null
        : Math.max(...values)
      : percentile(values, rule.statistic.p);
  const meets =
    value !== null && (rule.direction === 'max' ? value <= threshold : value >= threshold);
  return {
    name,
    rnf: rule.rnf,
    n: values.length,
    p50: percentile(values, 50),
    p90: percentile(values, 90),
    p95: percentile(values, 95),
    compared: statisticLabel(rule.statistic),
    value,
    threshold,
    direction: rule.direction,
    unit: samples[0]?.unit ?? (rule.name === 'gesture.fps' ? 'fps' : 'ms'),
    status: value === null ? 'Sin datos' : meets ? 'Cumple' : 'No cumple',
  };
}

const isLocalModel = (sample: MetricSample): boolean => sample.meta?.provider === 'ollama';

/**
 * Una fila por métrica. `llm.response` se separa en dos si hay respuestas de un modelo local:
 * las remotas (o sin `provider`) se comparan con 8 s y las de Ollama con 15 s.
 */
export function summarizeMetrics(samples: readonly MetricSample[]): MetricSummary[] {
  return METRIC_RULES.flatMap((rule) => {
    const own = samples.filter((s) => s.name === rule.name);
    if (rule.name !== 'llm.response') return [summarizeGroup(rule, rule.name, rule.threshold, own)];
    const local = own.filter(isLocalModel);
    const rows = [
      summarizeGroup(
        rule,
        rule.name,
        rule.threshold,
        own.filter((s) => !isLocalModel(s)),
      ),
    ];
    if (local.length > 0) {
      rows.push(summarizeGroup(rule, `${rule.name} · ollama`, LLM_RESPONSE_LOCAL_THRESHOLD, local));
    }
    // Sin respuestas remotas pero con locales, la fila vacía solo estorba.
    return rows[0]?.n === 0 && rows.length > 1 ? rows.slice(1) : rows;
  });
}

export function formatMetricValue(value: number | null): string {
  if (value === null) return '—';
  return String(Math.round(value * 10) / 10);
}

export function thresholdLabel(row: MetricSummary): string {
  return `${row.direction === 'max' ? '≤' : '≥'} ${row.threshold} ${row.unit}`;
}

/** Tabla de Markdown lista para pegar en el informe de usabilidad. */
export function formatSummaryMarkdown(rows: readonly MetricSummary[]): string {
  const header = [
    '| Métrica | RNF | n | p50 | p90 | p95 | Se compara | Umbral | Resultado |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  const body = rows.map(
    (r) =>
      `| \`${r.name}\` | ${r.rnf} | ${r.n} | ${formatMetricValue(r.p50)} | ${formatMetricValue(r.p90)} | ${formatMetricValue(r.p95)} | ${r.compared} = ${formatMetricValue(r.value)} | ${thresholdLabel(r)} | ${r.status} |`,
  );
  return [...header, ...body].join('\n');
}

export function exportSummaryJson(rows: readonly MetricSummary[], date: Date): string {
  return JSON.stringify({ generatedAt: date.toISOString(), metrics: rows }, null, 2);
}
