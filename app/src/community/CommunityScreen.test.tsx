// La pantalla de la Comunidad publica su contexto para que la ayuda ofrezca sus comandos.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enterScreen, getCommandContext } from '../core/commandContext';
import { CommunityScreen } from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  enterScreen('home');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('CommunityScreen', () => {
  it('al abrirse publica la pantalla community (RF-33)', async () => {
    await act(async () => root.render(<CommunityScreen />));
    expect(getCommandContext().screen).toBe('community');
    expect(container.querySelector('h1')?.textContent).toBe('Comunidad');
  });
});
