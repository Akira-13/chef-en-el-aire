// Registro de métricas en el dispositivo. Las muestras sobreviven a recargas (localStorage) y
// se exportan como JSON para el informe de cumplimiento de los RNF (CA-37.1).

import type { MetricName, MetricSample, MetricUnit } from '@chef/shared';

const STORAGE_KEY = 'chef.metrics';
const pending = new Map<string, number>();

function load(): MetricSample[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as MetricSample[]) : [];
  } catch {
    return [];
  }
}

let samples: MetricSample[] = load();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch {
    // Sin almacenamiento disponible las muestras quedan solo en memoria.
  }
}

export const metrics = {
  /** Marca el inicio de una medición; `key` distingue mediciones simultáneas del mismo tipo. */
  start(name: MetricName, key = ''): void {
    pending.set(`${name}:${key}`, performance.now());
  },

  /** Cierra una medición iniciada con `start` y devuelve su duración en ms. */
  end(name: MetricName, key = '', meta?: MetricSample['meta']): number | undefined {
    const id = `${name}:${key}`;
    const startedAt = pending.get(id);
    if (startedAt === undefined) return undefined;
    pending.delete(id);
    const value = performance.now() - startedAt;
    metrics.record(name, value, 'ms', meta);
    return value;
  },

  record(name: MetricName, value: number, unit: MetricUnit = 'ms', meta?: MetricSample['meta']) {
    samples.push({ name, value, unit, at: new Date().toISOString(), meta });
    persist();
  },

  samples(): readonly MetricSample[] {
    return samples;
  },

  exportJson(): string {
    return JSON.stringify(samples, null, 2);
  },

  clear(): void {
    samples = [];
    pending.clear();
    persist();
  },
};
