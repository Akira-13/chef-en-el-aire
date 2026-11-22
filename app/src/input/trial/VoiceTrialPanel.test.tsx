// Panel del modo prueba de voz (CU-05): pedidos, resultado y exportación.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command } from '@chef/shared';
import { commandBus } from '../../core/commandBus';
import { generateRequests } from './voiceTrial';
import { VoiceTrialPanel } from './VoiceTrialPanel';

const download = vi.hoisted(() => vi.fn());
vi.mock('./download', () => ({ downloadFile: download }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SEED = 11;
const requests = generateRequests(SEED);

let container: HTMLElement;
let root: Root;

function commandFor(index: number): Command {
  const id = requests[index]?.id;
  return id === 'substitute'
    ? { type: 'substitute', ingredient: 'leche' }
    : ({ type: id } as Command);
}

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) => b.textContent === name);
  if (!found) throw new Error(`No hay botón «${name}»`);
  return found;
}

function click(name: string): void {
  act(() => button(name).click());
}

function say(command: Command, channel: 'voice' | 'touch' = 'voice'): void {
  act(() => {
    commandBus.emit(command, channel);
  });
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  download.mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<VoiceTrialPanel seed={SEED} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('panel de la prueba de voz (CU-05)', () => {
  it('muestra el pedido en grande con el progreso', () => {
    expect(container.textContent).toContain('pedido 1 de 20');
    click('Empezar');
    expect(container.querySelector('p[aria-live]')?.textContent).toBe(
      `Di: chef, ${requests[0]?.phrase}`,
    );
  });

  it('un comando de voz cierra el pedido y se pasa al siguiente', () => {
    click('Empezar');
    say(commandFor(0));
    expect(container.textContent).toContain('✔ Acertó');
    advance(1500);
    expect(container.textContent).toContain('pedido 2 de 20');
    expect(container.querySelector('p[aria-live]')?.textContent).toContain(
      requests[1]?.phrase ?? '',
    );
  });

  it('un comando equivocado se anota como no acertado', () => {
    click('Empezar');
    say({ type: 'cancel' });
    expect(container.textContent).toContain('✘ No acertó');
  });

  it('un toque no cuenta como respuesta de voz', () => {
    click('Empezar');
    say(commandFor(0), 'touch');
    expect(container.textContent).not.toContain('Acertó');
  });

  it('sin respuesta en 5 s el pedido cuenta como no reconocido', () => {
    click('Empezar');
    advance(5000);
    expect(container.textContent).toContain('se reconoció «nada»');
  });

  it('terminados los 20 pedidos muestra "Aciertos: 20/20 (100 %) · cumple ≥ 90 %"', () => {
    click('Empezar');
    for (let i = 0; i < 20; i++) {
      say(commandFor(i));
      advance(1500);
    }
    expect(container.textContent).toContain('Prueba terminada');
    expect(container.textContent).toContain('Aciertos: 20/20 (100 %) · cumple ≥ 90 %');
  });

  it('exporta el JSON con el código anónimo y el nivel de ruido elegido', () => {
    click('Ruido 70 a 80 dB');
    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, 'p02');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    click('Empezar');
    say(commandFor(0));
    click('Exportar');
    expect(download).toHaveBeenCalledOnce();
    const [fileName, json] = download.mock.calls[0] as [string, string];
    expect(fileName).toBe('P02-prueba-voz.json');
    const data = JSON.parse(json);
    expect(data.participant).toBe('P02');
    expect(data.requests[0]).toMatchObject({ hit: true, noise: 'loud' });
  });

  it('saltar un pedido lo marca y no lo cuenta', () => {
    click('Empezar');
    click('Saltar');
    expect(container.textContent).toContain('Pedido saltado');
    expect(container.textContent).toContain('Saltados: 1');
  });
});
