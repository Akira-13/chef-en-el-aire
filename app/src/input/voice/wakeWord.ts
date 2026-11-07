// Palabra de activación (RF-18, CA-13.2): sin "chef" no se ejecuta nada.

import { normalizeSpeech } from './normalize';

export const WAKE_WORD = 'chef';
/** Tiempo para decir el comando después de un "chef" solo. */
export const WAKE_WINDOW_MS = 5000;
/** Tras un comando, los siguientes valen sin repetir "chef" mientras no haya un silencio así. */
export const FOLLOW_UP_WINDOW_MS = 10000;

// Variantes que el reconocimiento en español suele devolver para "chef".
const WAKE_VARIANTS = new Set([WAKE_WORD, 'chefs', 'shef', 'sheff', 'chet', 'jef']);

export interface WakeGate {
  /** Devuelve el comando sin la palabra de activación, o null si se ignora. */
  feed(transcript: string): string | null;
  /** True mientras se espera el comando después de un "chef" solo. */
  isArmed(): boolean;
  /** True si el último comando devuelto llegó sin "chef", dentro de la ventana de seguimiento. */
  isFollowUp(): boolean;
}

export function createWakeGate(now: () => number = () => Date.now()): WakeGate {
  let armedUntil = 0;
  let followUpUntil = 0;
  let lastWasFollowUp = false;

  function accept(text: string, followUp: boolean): string {
    armedUntil = 0;
    followUpUntil = now() + FOLLOW_UP_WINDOW_MS;
    lastWasFollowUp = followUp;
    return text;
  }

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
        if (normalizeSpeech(rest)) return accept(rest, false);
        armedUntil = now() + WAKE_WINDOW_MS;
        return null;
      }
      if (!normalizeSpeech(transcript)) return null;
      if (armedUntil && now() <= armedUntil) return accept(transcript.trim(), false);
      if (followUpUntil && now() <= followUpUntil) return accept(transcript.trim(), true);
      armedUntil = 0;
      followUpUntil = 0;
      return null;
    },

    isArmed() {
      return armedUntil > 0 && now() <= armedUntil;
    },

    isFollowUp() {
      return lastWasFollowUp;
    },
  };
}
