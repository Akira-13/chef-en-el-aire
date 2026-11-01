import { describe, expect, it } from 'vitest';
import { isNo, isYes, needsConfirmation } from './answers';

describe('confirmación por baja confianza (CA-14.1)', () => {
  it('pide confirmar solo bajo el umbral y si hay confianza', () => {
    expect(needsConfirmation(0.4)).toBe(true);
    expect(needsConfirmation(0.9)).toBe(false);
    expect(needsConfirmation(undefined)).toBe(false);
  });

  it('reconoce el sí y el no, con o sin la palabra de activación', () => {
    expect(isYes('Sí')).toBe(true);
    expect(isYes('chef sí')).toBe(true);
    expect(isYes('claro')).toBe(true);
    expect(isYes('sí quiero sal')).toBe(false);
    expect(isNo('No.')).toBe(true);
    expect(isNo('chef no')).toBe(true);
    expect(isNo('no me gustó')).toBe(false);
  });
});
