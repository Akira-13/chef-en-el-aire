// Eco del altavoz: el micrófono también oye lo que lee la app. Si casi todas las palabras de una
// frase acaban de salir por el altavoz, no la dijo el usuario.

import { normalizeSpeech } from './normalize';

const MIN_WORDS = 2;
const ECHO_SHARE = 0.75;

/** Palabras sin signos: el texto leído trae comillas « » y otros que la transcripción no tiene. */
function wordsOf(text: string): string[] {
  return normalizeSpeech(text)
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(' ')
    .filter(Boolean);
}

export function isEcho(transcript: string, recentlySpoken: readonly string[]): boolean {
  const words = wordsOf(transcript);
  // "sí", "listo" o "siguiente" sueltos son respuestas del usuario, aunque la app los nombre.
  if (words.length < MIN_WORDS) return false;
  return recentlySpoken.some((text) => {
    const said = new Set(wordsOf(text));
    const shared = words.filter((word) => said.has(word)).length;
    return shared / words.length >= ECHO_SHARE;
  });
}
