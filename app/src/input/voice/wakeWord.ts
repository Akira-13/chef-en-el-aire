// Palabra de activación (RF-18, CA-13.2): sin "chef" no se ejecuta nada.

import { normalizeSpeech } from './normalize';

export const WAKE_WORD = 'chef';
export const WAKE_WINDOW_MS = 5000;

// Variantes que el reconocimiento en español suele devolver para "chef".
const WAKE_VARIANTS = new Set([WAKE_WORD, 'chefs', 'shef', 'sheff', 'chet', 'jef']);

export interface WakeGate {
  /** Devuelve el comando sin la palabra de activación, o null si se ignora. */
  feed(transcript: string): string | null;
  /** True mientras se espera el comando después de un "chef" solo. */
  isArmed(): boolean;
}

export function createWakeGate(now: () => number = () => Date.now()): WakeGate {
  let armedUntil = 0;

  return {
    feed(transcript) {
      // Se usan las palabras originales para conservar las tildes.
      const words = transcript.trim().split(/\s+/).filter(Boolean);
      const first = normalizeSpeech(words[0] ?? '');
      if (WAKE_VARIANTS.has(first)) {
        const rest = words
          .slice(1)
          .join(' ')
          .replace(/^[,.;:]\s*/, '')
          .trim();
        if (normalizeSpeech(rest)) {
          armedUntil = 0;
          return rest;
        }
        armedUntil = now() + WAKE_WINDOW_MS;
        return null;
      }
      if (armedUntil && now() <= armedUntil && normalizeSpeech(transcript)) {
        armedUntil = 0;
        return transcript.trim();
      }
      armedUntil = 0;
      return null;
    },

    isArmed() {
      return armedUntil > 0 && now() <= armedUntil;
    },
  };
}
