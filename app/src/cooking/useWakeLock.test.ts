// @vitest-environment jsdom
import { act } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './useWakeLock';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Host() {
  useWakeLock();
  return null;
}

function fakeLock() {
  const listeners: (() => void)[] = [];
  return {
    release: vi.fn(async () => listeners.forEach((listener) => listener())),
    addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
    fire: () => listeners.forEach((listener) => listener()),
  };
}

function mockWakeLock(lock: ReturnType<typeof fakeLock>) {
  const request = vi.fn(async () => lock);
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  return request;
}

async function mount() {
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(Host)));
  return root;
}

describe('useWakeLock', () => {
  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
  });

  it('pide el bloqueo al entrar y lo suelta al salir', async () => {
    const lock = fakeLock();
    const request = mockWakeLock(lock);
    const root = await mount();
    expect(request).toHaveBeenCalledWith('screen');
    await act(async () => root.unmount());
    expect(lock.release).toHaveBeenCalled();
  });

  it('lo vuelve a pedir al regresar a la app', async () => {
    const lock = fakeLock();
    const request = mockWakeLock(lock);
    const root = await mount();
    lock.fire();
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount());
  });

  it('no falla si el navegador lo rechaza o no lo soporta', async () => {
    const root = await mount();
    await act(async () => root.unmount());
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: vi.fn(async () => Promise.reject(new Error('batería baja'))) },
    });
    const rejected = await mount();
    await act(async () => rejected.unmount());
  });
});
