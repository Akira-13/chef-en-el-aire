import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { profileService } from '../core/services';
import { ChannelStatus } from './ChannelStatus';
import { setChannels } from './channelStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

beforeEach(async () => {
  localStorage.clear();
  await profileService.ready;
  await profileService.reset();
  await profileService.update((profile) => ({
    ...profile,
    accessibility: { ...profile.accessibility, activeInputs: ['voz', 'gestos', 'tactil'] },
  }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ChannelStatus />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setChannels({ voiceEnabled: false, cameraUserOff: false });
});

describe('ChannelStatus', () => {
  it('los botones de voz y cámara llevan el estado en su etiqueta, sin aria-pressed (WCAG 4.1.2)', async () => {
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons).toHaveLength(2);
    expect(buttons.every((b) => !b.hasAttribute('aria-pressed'))).toBe(true);

    expect(buttons[0]!.getAttribute('aria-label')).toBe('Activar voz');
    await act(async () => setChannels({ voiceEnabled: true }));
    expect(buttons[0]!.getAttribute('aria-label')).toBe('Desactivar voz');

    await act(async () => setChannels({ cameraUserOff: true }));
    expect(buttons[1]!.getAttribute('aria-label')).toBe('Encender cámara');
  });
});
