import { describe, expect, it } from 'vitest';
import { CUE_ICONS } from './cueIcons';

describe('emojis de los avisos visuales', () => {
  it('avanzar apunta a la derecha y retroceder a la izquierda', () => {
    expect(CUE_ICONS.next).toBe('➡️');
    expect(CUE_ICONS.previous).toBe('⬅️');
  });

  it('pausar y continuar usan los símbolos de un reproductor', () => {
    expect(CUE_ICONS.pause).toBe('⏸️');
    expect(CUE_ICONS.resume).toBe('▶️');
  });

  it('repetir y escuchar tienen el suyo', () => {
    expect(CUE_ICONS.repeat).toBe('🔁');
    expect(CUE_ICONS.listening).toBe('🎙️');
  });

  it('cada aviso se distingue de los demás', () => {
    const icons = Object.values(CUE_ICONS);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
