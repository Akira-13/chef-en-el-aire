import { describe, expect, it } from 'vitest';
import { generousDefaults, toggleInput } from './accessibility';

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

describe('primera configuración', () => {
  it('parte de letra grande y volumen alto (CA-22.2)', () => {
    const prefs = { fontSize: 'normal', volume: undefined } as unknown as Parameters<
      typeof generousDefaults
    >[0];
    expect(generousDefaults(prefs)).toEqual({ fontSize: 'grande', volume: 1 });
    expect(generousDefaults({ ...prefs, fontSize: 'extragrande' }).fontSize).toBe('extragrande');
  });
});
