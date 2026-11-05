// Sonidos cortos con Web Audio, sin archivos (RF-39). Su equivalente visual está en OutputLayer.

import type { CueKind } from '../core/contracts';

interface Note {
  /** Frecuencia en Hz. */
  freq: number;
  /** Inicio respecto al comienzo del sonido, en segundos. */
  at: number;
  /** Duración en segundos. */
  dur: number;
  wave?: OscillatorType;
  /** Frecuencia final, para un barrido. */
  to?: number;
}

const CUES: Record<CueKind, Note[]> = {
  success: [
    { freq: 660, at: 0, dur: 0.12 },
    { freq: 990, at: 0.12, dur: 0.18 },
  ],
  error: [{ freq: 330, to: 180, at: 0, dur: 0.35, wave: 'sawtooth' }],
  gesture: [{ freq: 1400, at: 0, dur: 0.05, wave: 'square' }],
  navigate: [{ freq: 520, to: 700, at: 0, dur: 0.1 }],
  timer: [
    { freq: 880, at: 0, dur: 0.15, wave: 'square' },
    { freq: 880, at: 0.25, dur: 0.15, wave: 'square' },
    { freq: 880, at: 0.5, dur: 0.15, wave: 'square' },
  ],
  celebration: [
    { freq: 523, at: 0, dur: 0.15 },
    { freq: 659, at: 0.12, dur: 0.15 },
    { freq: 784, at: 0.24, dur: 0.15 },
    { freq: 1047, at: 0.36, dur: 0.4 },
  ],
};

let context: AudioContext | undefined;

function audioContext(): AudioContext | undefined {
  if (typeof AudioContext === 'undefined') return undefined;
  context ??= new AudioContext();
  // El navegador lo crea suspendido hasta que el usuario interactúa.
  if (context.state === 'suspended') void context.resume();
  return context;
}

export function playCue(kind: CueKind, volume: number): void {
  const ctx = audioContext();
  if (!ctx || volume <= 0) return;
  const start = ctx.currentTime;
  const peak = 0.25 * Math.min(1, volume);
  for (const note of CUES[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = start + note.at;
    const t1 = t0 + note.dur;
    osc.type = note.wave ?? 'sine';
    osc.frequency.setValueAtTime(note.freq, t0);
    if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, t1);
    // Envolvente corta para evitar chasquidos.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}
