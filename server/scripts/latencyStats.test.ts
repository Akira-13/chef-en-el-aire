import { describe, expect, it } from 'vitest';
import { LATENCY_THRESHOLDS_MS, judge, percentile, summarize } from './latencyStats';

describe('percentile', () => {
  it('usa el método del rango más cercano sobre las muestras ordenadas', () => {
    const samples = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
    expect(percentile(samples, 50)).toBe(1000);
    expect(percentile(samples, 90)).toBe(1800);
    expect(percentile(samples, 100)).toBe(2000);
  });

  it('no depende del orden de entrada ni modifica el arreglo', () => {
    const samples = [900, 100, 500];
    expect(percentile(samples, 50)).toBe(500);
    expect(samples).toEqual([900, 100, 500]);
  });

  it('con una sola muestra todos los percentiles la devuelven', () => {
    expect(percentile([1234], 50)).toBe(1234);
    expect(percentile([1234], 90)).toBe(1234);
  });

  it('sin muestras no inventa un valor', () => {
    expect(percentile([], 90)).toBeNull();
  });
});

describe('summarize', () => {
  it('resume cantidad, p50, p90 y máximo', () => {
    const samples = Array.from({ length: 10 }, (_, i) => (i + 1) * 1000);
    expect(summarize(samples)).toEqual({ count: 10, p50: 5000, p90: 9000, max: 10000 });
  });

  it('sin muestras devuelve valores nulos', () => {
    expect(summarize([])).toEqual({ count: 0, p50: null, p90: null, max: null });
  });
});

describe('judge (RNF-03)', () => {
  it('con el proveedor remoto exige p90 ≤ 8 s', () => {
    expect(LATENCY_THRESHOLDS_MS.remoto).toBe(8000);
    expect(judge('remoto', summarize([7000, 8000])).pass).toBe(true);
    expect(judge('remoto', summarize([7000, 8001])).pass).toBe(false);
  });

  it('con Ollama exige p90 ≤ 15 s', () => {
    expect(LATENCY_THRESHOLDS_MS.ollama).toBe(15000);
    expect(judge('ollama', summarize([14000, 15000])).pass).toBe(true);
    expect(judge('ollama', summarize([14000, 15001])).pass).toBe(false);
  });

  it('un tiempo de 12 s cumple en local pero no en remoto', () => {
    const summary = summarize([12000]);
    expect(judge('remoto', summary).pass).toBe(false);
    expect(judge('ollama', summary).pass).toBe(true);
  });

  it('sin muestras no cumple: no hay nada que medir', () => {
    expect(judge('remoto', summarize([])).pass).toBe(false);
  });

  it('informa el umbral aplicado', () => {
    expect(judge('ollama', summarize([1000]))).toMatchObject({ thresholdMs: 15000, pass: true });
  });
});
