// Panel ?prueba=metricas: tabla contra los umbrales y exportación (CA-37.1, CA-37.2).

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { metrics } from '../../core/metrics';
import { MetricsPanel } from './MetricsPanel';

const download = vi.hoisted(() => vi.fn());
vi.mock('./download', () => ({ downloadFile: download }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) => b.textContent === name);
  if (!found) throw new Error(`No hay botón «${name}»`);
  return found;
}

const click = (name: string) => act(() => button(name).click());

function render(): void {
  act(() => root.render(<MetricsPanel />));
}

beforeEach(() => {
  metrics.clear();
  download.mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  metrics.clear();
});

describe('panel de métricas (CA-37.1)', () => {
  it('sin muestras muestra todas las métricas como «Sin datos»', () => {
    render();
    expect(container.textContent).toContain('0 muestras');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(container.textContent).toContain('— Sin datos');
  });

  it('muestra si cumple o no con texto, no solo con color', () => {
    for (let i = 0; i < 20; i++) metrics.record('voice.commandToRender', 900);
    for (let i = 0; i < 20; i++) metrics.record('gesture.toAction', 450);
    render();
    const text = container.textContent ?? '';
    expect(text).toContain('✔ Cumple');
    expect(text).toContain('✘ No cumple');
    expect(text).toContain('p95 = 900');
    expect(text).toContain('≤ 1500 ms');
  });

  it('exporta el resumen en JSON y en Markdown con el código del participante', () => {
    metrics.record('profile.save', 120);
    render();
    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, 'p06');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    click('Exportar resumen (JSON)');
    click('Exportar resumen (Markdown)');
    const [jsonName, json] = download.mock.calls[0] as [string, string];
    const [mdName, md, type] = download.mock.calls[1] as [string, string, string];
    expect(jsonName).toBe('P06-resumen-metricas.json');
    expect(JSON.parse(json).metrics).toHaveLength(10);
    expect(mdName).toBe('P06-resumen-metricas.md');
    expect(md).toContain('| `profile.save` | RNF-17 | 1 | 120 |');
    expect(type).toBe('text/markdown');
  });

  it('«Actualizar» incorpora las muestras nuevas', () => {
    render();
    expect(container.textContent).toContain('0 muestras');
    metrics.record('timer.drift', 40);
    click('Actualizar');
    expect(container.textContent).toContain('1 muestras');
  });

  it('borrar pide confirmar y vacía las muestras', () => {
    metrics.record('timer.drift', 40);
    render();
    click('Borrar muestras');
    expect(container.textContent).toContain('¿Borrar todas las muestras');
    click('Cancelar');
    expect(metrics.samples()).toHaveLength(1);
    click('Borrar muestras');
    click('Sí, borrar');
    expect(metrics.samples()).toHaveLength(0);
    expect(container.textContent).toContain('0 muestras');
  });
});
