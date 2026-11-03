import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useOnlineStatus } from './useOnlineStatus';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function Probe() {
  return <p>{useOnlineStatus() ? 'en línea' : 'sin conexión'}</p>;
}

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setOnLine(true);
});

describe('useOnlineStatus', () => {
  it('parte del estado actual del navegador (CA-35.2)', async () => {
    setOnLine(false);
    await act(async () => root.render(<Probe />));
    expect(container.textContent).toBe('sin conexión');
  });

  it('reacciona a los eventos offline y online (CA-35.2)', async () => {
    setOnLine(true);
    await act(async () => root.render(<Probe />));
    expect(container.textContent).toBe('en línea');
    await act(async () => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(container.textContent).toBe('sin conexión');
    await act(async () => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(container.textContent).toBe('en línea');
  });
});
