import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandBus } from '../core/commandBus';
import { OnboardingScreen } from './OnboardingScreen';
import { isOnboarded } from './onboardingState';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const heading = () => container.querySelector('h1')?.textContent;
const button = (name: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent === name);

async function press(name: string) {
  await act(async () => {
    button(name)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('OnboardingScreen (HU-36)', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    container = document.createElement('div');
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/bienvenida']}>
          <Routes>
            <Route path="/bienvenida" element={<OnboardingScreen />} />
            <Route path="/" element={<p>inicio</p>} />
          </Routes>
        </MemoryRouter>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
  });

  it('avanza solo al practicar "siguiente" por el canal de cada paso (CA-36.1)', async () => {
    await press('Continuar');
    expect(heading()).toBe('Prueba con la voz');

    await act(async () => void commandBus.emit({ type: 'next' }, 'gesture'));
    await act(async () => void vi.advanceTimersByTime(2000));
    expect(heading()).toBe('Prueba con la voz');

    await act(async () => void commandBus.emit({ type: 'next' }, 'voice'));
    expect(container.textContent).toContain('¡Muy bien!');
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(heading()).toBe('Prueba con un gesto');

    await act(async () => void commandBus.emit({ type: 'next' }, 'gesture'));
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(heading()).toBe('¡Listo para cocinar!');
  });

  it('se puede completar solo con toques: ningún canal es obligatorio (RF-24)', async () => {
    await press('Continuar');
    await press('Continuar');
    await press('Continuar');
    await press('Empezar');
    expect(isOnboarded()).toBe(true);
    expect(container.textContent).toContain('inicio');
  });

  it('se puede saltar en cualquier paso', async () => {
    await press('Saltar');
    expect(isOnboarded()).toBe(true);
    expect(container.textContent).toContain('inicio');
  });
});
