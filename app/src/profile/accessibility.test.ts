import { describe, expect, it } from 'vitest';
import { toggleInput } from './accessibility';

describe('canales de entrada', () => {
  it('se puede desactivar el táctil si quedan voz y gestos (CA-18.3)', () => {
    const next = toggleInput(
      { activeInputs: ['voz', 'gestos', 'tactil'], preferredInput: 'tactil' },
      'tactil',
    );
    expect(next.activeInputs).toEqual(['voz', 'gestos']);
    expect(next.preferredInput).toBe('voz');
  });

  it('nunca deja cero canales (RF-24)', () => {
    const prefs = { activeInputs: ['voz' as const], preferredInput: 'voz' as const };
    expect(toggleInput(prefs, 'voz')).toBe(prefs);
  });

  it('activar un canal respeta el orden voz, gestos, táctil', () => {
    const next = toggleInput({ activeInputs: ['tactil'], preferredInput: 'tactil' }, 'voz');
    expect(next).toEqual({ activeInputs: ['voz', 'tactil'], preferredInput: 'tactil' });
  });
});
