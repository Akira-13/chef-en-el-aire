// Panel del modo prueba de gestos (CU-06): repeticiones, 5 minutos de cocina y exportación.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command } from '@chef/shared';
import { commandBus } from '../../core/commandBus';
import { setChannels } from '../channelStore';
import { generateGestureRequests } from './gestureTrial';
import { GestureTrialPanel } from './GestureTrialPanel';

const download = vi.hoisted(() => vi.fn());
vi.mock('./download', () => ({ downloadFile: download }));

const profile = vi.hoisted(() => ({
  accessibility: {
    enabledGestures: [
      'deslizar_siguiente',
      'deslizar_anterior',
      'palma_abierta_pausar',
      'pulgar_arriba_confirmar',
    ],
    requiresActivationGesture: false,
  },
}));
vi.mock('../../core/services', () => ({ useProfile: () => profile }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SEED = 4;
const requests = generateGestureRequests(SEED);
const COMMAND_OF = {
  swipeLeft: { type: 'next' },
  swipeRight: { type: 'previous' },
  palm: { type: 'pause' },
  thumbUp: { type: 'confirm' },
} as const;

let container: HTMLElement;
let root: Root;

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) => b.textContent === name);
  if (!found) throw new Error(`No hay botón «${name}»`);
  return found;
}

const click = (name: string) => act(() => button(name).click());
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const gesture = (command: Command) =>
  act(() => {
    commandBus.emit(command, 'gesture');
  });

beforeEach(() => {
  vi.useFakeTimers();
  download.mockClear();
  setChannels({ camera: 'on' });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<GestureTrialPanel seed={SEED} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setChannels({ camera: 'off' });
  vi.useRealTimers();
});

describe('repeticiones (CA-15.3)', () => {
  it('pide el primer gesto con su ícono y cómo hacerlo', () => {
    click('Empezar');
    const first = requests[0];
    expect(container.querySelector('p[aria-live]')?.textContent).toBe(
      `${first?.icon} ${first?.how}`,
    );
    expect(container.textContent).toContain('Intento 1 de 40');
  });

  it('un gesto correcto acierta y pasa al intento siguiente', () => {
    click('Empezar');
    gesture(COMMAND_OF[requests[0]!.id]);
    expect(container.textContent).toContain('✔ Acertó');
    advance(1500);
    expect(container.textContent).toContain('Intento 2 de 40');
  });

  it('un gesto equivocado o ninguno se anota como no acertado', () => {
    click('Empezar');
    gesture({ type: 'cancel' });
    expect(container.textContent).toContain('✘ No acertó: se reconoció otro gesto');
    advance(1500);
    advance(6000);
    expect(container.textContent).toContain('no se reconoció ningún gesto');
  });

  it('con los 40 intentos acertados muestra "Aciertos: 40/40 (100 %) · cumple ≥ 90 %"', () => {
    click('Empezar');
    for (const request of requests) {
      gesture(COMMAND_OF[request.id]);
      advance(1500);
    }
    expect(container.textContent).toContain('Prueba terminada');
    expect(container.textContent).toContain('Aciertos: 40/40 (100 %) · cumple ≥ 90 %');
  });

  it('avisa si el perfil no tiene activo algún gesto', () => {
    act(() => root.unmount());
    profile.accessibility.enabledGestures = ['deslizar_siguiente'];
    root = createRoot(container);
    act(() => root.render(<GestureTrialPanel seed={SEED} />));
    expect(container.textContent).toContain('En este perfil no están activos');
    expect(container.textContent).toContain('palma abierta');
    profile.accessibility.enabledGestures = [
      'deslizar_siguiente',
      'deslizar_anterior',
      'palma_abierta_pausar',
      'pulgar_arriba_confirmar',
    ];
  });

  it('avisa si la cámara no está lista', () => {
    act(() => setChannels({ camera: 'starting' }));
    expect(container.textContent).toContain('La cámara aún no está lista');
  });
});

describe('5 minutos de cocina (RNF-05)', () => {
  it('un gesto sin toque de intencional es falso positivo y con toque no lo es', () => {
    click('5 minutos de cocina');
    click('Iniciar');
    gesture({ type: 'next' });
    advance(3000);
    expect(container.textContent).toContain('Falsos positivos: 1');

    gesture({ type: 'pause' });
    click('Gesto intencional');
    advance(3000);
    expect(container.textContent).toContain('Gestos reconocidos: 2');
    expect(container.textContent).toContain('Falsos positivos: 1');
  });

  it('el botón de intencional solo sirve con la sesión en marcha', () => {
    click('5 minutos de cocina');
    expect(button('Gesto intencional').disabled).toBe(true);
    click('Iniciar');
    expect(button('Gesto intencional').disabled).toBe(false);
  });

  it('se detiene a los 5 minutos y da el veredicto', () => {
    click('5 minutos de cocina');
    click('Iniciar');
    advance(5 * 60 * 1000 + 500);
    expect(container.textContent).toContain('Sesión terminada');
    expect(container.textContent).toContain('Falsos positivos: 0 en 5:00 · cumple');
  });
});

describe('exportación (RNF-11)', () => {
  it('descarga P0n-prueba-gestos.json con las repeticiones y la cocina', () => {
    click('Empezar');
    gesture(COMMAND_OF[requests[0]!.id]);
    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, 'p05');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    click('Exportar');
    const [fileName, json] = download.mock.calls[0] as [string, string];
    expect(fileName).toBe('P05-prueba-gestos.json');
    const data = JSON.parse(json);
    expect(data).toMatchObject({ kind: 'gesture-trial', participant: 'P05' });
    expect(data.repetitions.attempts[0]).toMatchObject({ hit: true });
    expect(data.cooking).toBeNull();
  });
});
