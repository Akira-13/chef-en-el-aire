import { describe, expect, it } from 'vitest';
import { createWakeGate, WAKE_WINDOW_MS } from './wakeWord';

function gateWithClock() {
  let now = 0;
  const gate = createWakeGate(() => now);
  return { gate, advance: (ms: number) => (now += ms) };
}

describe('palabra de activación (CA-13.2)', () => {
  it('acepta "chef siguiente" en una sola frase', () => {
    const { gate } = gateWithClock();
    expect(gate.feed('chef siguiente')).toBe('siguiente');
    expect(gate.feed('Chef, ¿puedo usar mantequilla?')).toBe('¿puedo usar mantequilla?');
  });

  it('sin palabra de activación no se ejecuta nada', () => {
    const { gate } = gateWithClock();
    expect(gate.feed('siguiente')).toBeNull();
    expect(gate.feed('el chef dijo siguiente')).toBeNull();
  });

  it('acepta "chef" seguido del comando dentro de 5 s', () => {
    const { gate, advance } = gateWithClock();
    expect(gate.feed('chef')).toBeNull();
    expect(gate.isArmed()).toBe(true);
    advance(3000);
    expect(gate.feed('siguiente')).toBe('siguiente');
    expect(gate.isArmed()).toBe(false);
  });

  it('ignora el comando si llega después de 5 s', () => {
    const { gate, advance } = gateWithClock();
    gate.feed('Chef');
    advance(WAKE_WINDOW_MS + 1000);
    expect(gate.feed('siguiente')).toBeNull();
  });

  it('cada "chef" vale para un solo comando', () => {
    const { gate } = gateWithClock();
    gate.feed('chef');
    expect(gate.feed('siguiente')).toBe('siguiente');
    expect(gate.feed('anterior')).toBeNull();
  });
});
