import { describe, expect, it } from 'vitest';
import type { MetricName, MetricSample } from '@chef/shared';
import {
  exportSummaryJson,
  formatSummaryMarkdown,
  METRIC_RULES,
  percentile,
  summarizeMetrics,
} from './metricsReport';

function sample(
  name: MetricName,
  value: number,
  meta?: MetricSample['meta'],
  unit: MetricSample['unit'] = name === 'gesture.fps' ? 'fps' : 'ms',
): MetricSample {
  return { name, value, unit, at: '2026-11-26T15:00:00.000Z', meta };
}

/** n muestras iguales a `value`, salvo la última, que vale `last`. */
function many(
  name: MetricName,
  n: number,
  value: number,
  last = value,
  meta?: MetricSample['meta'],
) {
  return Array.from({ length: n }, (_, i) => sample(name, i === n - 1 ? last : value, meta));
}

function row(samples: MetricSample[], name: string) {
  const found = summarizeMetrics(samples).find((r) => r.name === name);
  if (!found) throw new Error(`Falta la fila ${name}`);
  return found;
}

describe('percentil por rango más cercano', () => {
  it('p50, p90 y p95 de 1 a 20', () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile(values, 50)).toBe(10);
    expect(percentile(values, 90)).toBe(18);
    expect(percentile(values, 95)).toBe(19);
    expect(percentile(values, 5)).toBe(1);
  });

  it('con una sola muestra todos los percentiles son esa muestra', () => {
    expect(percentile([7], 5)).toBe(7);
    expect(percentile([7], 95)).toBe(7);
  });

  it('no depende del orden y sin valores da null', () => {
    expect(percentile([3, 1, 2], 50)).toBe(2);
    expect(percentile([], 95)).toBeNull();
  });
});

describe('resumen de métricas contra umbrales (CA-37.1)', () => {
  it('devuelve una fila por cada métrica, también sin datos', () => {
    const rows = summarizeMetrics([]);
    expect(rows).toHaveLength(METRIC_RULES.length);
    expect(rows.every((r) => r.status === 'Sin datos' && r.n === 0 && r.value === null)).toBe(true);
  });

  it('voz (RNF-01): p95 ≤ 1500 ms cumple en el límite y no cumple por encima', () => {
    expect(row(many('voice.commandToRender', 20, 1500), 'voice.commandToRender').status).toBe(
      'Cumple',
    );
    // Con 20 muestras el p95 es la 19.ª: dos lentas lo suben.
    const slow = [
      ...many('voice.commandToRender', 18, 800),
      ...many('voice.commandToRender', 2, 1501),
    ];
    expect(row(slow, 'voice.commandToRender')).toMatchObject({ status: 'No cumple', value: 1501 });
  });

  it('un valor atípico entre 20 no rompe el p95 pero sí con dos', () => {
    const one = many('gesture.toAction', 20, 200, 5000);
    expect(row(one, 'gesture.toAction')).toMatchObject({ status: 'Cumple', value: 200 });
  });

  it('gestos (RNF-02): p95 ≤ 300 ms; cuadros por segundo con el p5 ≥ 15', () => {
    expect(row(many('gesture.toAction', 20, 300), 'gesture.toAction').status).toBe('Cumple');
    expect(row(many('gesture.toAction', 20, 301), 'gesture.toAction').status).toBe('No cumple');

    const fps = [...many('gesture.fps', 19, 24), sample('gesture.fps', 14, undefined, 'fps')];
    // Con 20 muestras el p5 es la 1.ª (la más baja): 14 fps no cumple.
    expect(row(fps, 'gesture.fps')).toMatchObject({
      compared: 'p5',
      value: 14,
      status: 'No cumple',
      unit: 'fps',
    });
    expect(row(many('gesture.fps', 20, 15), 'gesture.fps').status).toBe('Cumple');
  });

  it('asistente (RNF-03): "pensando…" p95 ≤ 1 s', () => {
    expect(row(many('llm.thinking', 10, 1000), 'llm.thinking').status).toBe('Cumple');
    expect(row(many('llm.thinking', 10, 1001), 'llm.thinking').status).toBe('No cumple');
  });

  it('respuesta del asistente remoto: p90 ≤ 8000 ms; sin proveedor se toma como remoto', () => {
    expect(row(many('llm.response', 10, 8000), 'llm.response').status).toBe('Cumple');
    expect(row(many('llm.response', 10, 8001, 8001, { status: 'ok' }), 'llm.response').status).toBe(
      'No cumple',
    );
  });

  it('con Ollama el umbral es 15000 ms y va en su propia fila', () => {
    const samples = [
      ...many('llm.response', 10, 6000, 6000, { provider: 'groq' }),
      ...many('llm.response', 10, 12000, 12000, { provider: 'ollama' }),
    ];
    const rows = summarizeMetrics(samples).filter((r) => r.name.startsWith('llm.response'));
    expect(rows.map((r) => r.name)).toEqual(['llm.response', 'llm.response · ollama']);
    expect(rows[0]).toMatchObject({ threshold: 8000, status: 'Cumple', n: 10 });
    expect(rows[1]).toMatchObject({ threshold: 15000, status: 'Cumple', n: 10 });

    const tooSlow = many('llm.response', 10, 15001, 15001, { provider: 'ollama' });
    expect(row(tooSlow, 'llm.response · ollama').status).toBe('No cumple');
  });

  it('solo respuestas de Ollama: no deja una fila remota vacía', () => {
    const rows = summarizeMetrics(many('llm.response', 5, 9000, 9000, { provider: 'ollama' }));
    expect(rows.filter((r) => r.name.startsWith('llm.response'))).toHaveLength(1);
    expect(rows.find((r) => r.name === 'llm.response · ollama')?.status).toBe('Cumple');
  });

  it('temporizador (RNF-18): máximo absoluto ≤ 1000 ms, con desfases negativos', () => {
    const early = [sample('timer.drift', 200), sample('timer.drift', -1200)];
    expect(row(early, 'timer.drift')).toMatchObject({
      compared: 'máx. |x|',
      value: 1200,
      status: 'No cumple',
    });
    expect(row([sample('timer.drift', -1000)], 'timer.drift').status).toBe('Cumple');
  });

  it('perfil, canal alterno y Comunidad (RNF-17, RNF-15, RNF-09)', () => {
    expect(row(many('profile.save', 10, 1000), 'profile.save').status).toBe('Cumple');
    expect(row(many('channel.fallback', 10, 3001), 'channel.fallback').status).toBe('No cumple');
    expect(row(many('community.visible', 10, 5000), 'community.visible').status).toBe('Cumple');
    expect(row(many('community.queueFlush', 10, 10001), 'community.queueFlush').status).toBe(
      'No cumple',
    );
  });

  it('ignora las muestras de otras métricas y calcula n, p50, p90 y p95', () => {
    const rows = summarizeMetrics([
      ...Array.from({ length: 10 }, (_, i) => sample('voice.commandToRender', (i + 1) * 100)),
      sample('profile.save', 99999),
    ]);
    expect(rows.find((r) => r.name === 'voice.commandToRender')).toMatchObject({
      n: 10,
      p50: 500,
      p90: 900,
      p95: 1000,
      rnf: 'RNF-01',
    });
    expect(rows.find((r) => r.name === 'profile.save')?.n).toBe(1);
  });
});

describe('exportación del resumen (CA-37.2)', () => {
  const rows = summarizeMetrics([
    ...many('voice.commandToRender', 4, 900),
    sample('timer.drift', 20),
  ]);

  it('Markdown con una fila por métrica, umbral y resultado', () => {
    const markdown = formatSummaryMarkdown(rows);
    const lines = markdown.split('\n');
    expect(lines[0]).toContain('| Métrica | RNF | n |');
    expect(lines).toHaveLength(2 + METRIC_RULES.length);
    expect(markdown).toContain(
      '| `voice.commandToRender` | RNF-01 | 4 | 900 | 900 | 900 | p95 = 900 | ≤ 1500 ms | Cumple |',
    );
    expect(markdown).toContain(
      '| `gesture.fps` | RNF-02 | 0 | — | — | — | p5 = — | ≥ 15 fps | Sin datos |',
    );
  });

  it('JSON con la fecha y las filas', () => {
    const data = JSON.parse(exportSummaryJson(rows, new Date('2026-12-01T10:00:00Z')));
    expect(data.generatedAt).toBe('2026-12-01T10:00:00.000Z');
    expect(data.metrics).toHaveLength(METRIC_RULES.length);
  });
});
