import { afterEach, describe, expect, it } from 'vitest';
import { createOutputService } from './index';

const liveRegions = () => [...document.body.querySelectorAll('[aria-live]')];

afterEach(() => {
  for (const region of liveRegions()) region.remove();
});

describe('regiones ARIA de la salida (RF-27)', () => {
  it('se crean al iniciar el servicio, antes de la primera notificación', () => {
    createOutputService({
      getProfile: () => {
        throw new Error('no se usa');
      },
    });
    const politeness = liveRegions().map((r) => r.getAttribute('aria-live'));
    expect(politeness.sort()).toEqual(['assertive', 'polite']);
    expect(liveRegions().every((r) => r.textContent === '')).toBe(true);
  });
});
