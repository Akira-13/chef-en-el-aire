// Intérprete de voz (RF-18, CA-13.1). Lo que no es un comando se trata como una pregunta.

import type { Command, Feeling } from '@chef/shared';
import { normalizeSpeech } from './normalize';

type Rule = [RegExp, (match: RegExpMatchArray) => Command];

// Nombre opcional de un temporizador: "de X", "del X" o "de la X".
const TIMER_NAME = '(?: (?:del|de la|de los|de las|de)? ?(.+))?';

function timerName(match: RegExpMatchArray): { name?: string } {
  const name = match[1]?.trim();
  return name ? { name } : {};
}

const FEELINGS: Record<string, Feeling> = {
  nervios: 'nervous',
  cansad: 'tired',
  confundid: 'confused',
  feliz: 'happy',
  content: 'happy',
};

/** Separa "arroz, huevos y cebolla" en ["arroz", "huevos", "cebolla"]. */
function splitList(text: string): string[] {
  return text
    .split(/,| y | e /)
    .map((item) => item.trim())
    .filter(Boolean);
}

// Las reglas más específicas van primero.
const RULES: Rule[] = [
  [/^(?:siguiente|adelante)(?: paso)?$/, () => ({ type: 'next' })],
  [/^(?:anterior|atras)(?: paso)?$/, () => ({ type: 'previous' })],
  [/^(?:repite|repetir|repitelo)(?: el paso)?$/, () => ({ type: 'repeat' })],
  [/^(?:pausa|pausar)$/, () => ({ type: 'pause' })],
  [/^(?:continua|continuar|sigue|seguir)$/, () => ({ type: 'resume' })],
  [
    new RegExp(`^(?:inicia|iniciar|empieza|pon) (?:el )?temporizador${TIMER_NAME}$`),
    (m) => ({ type: 'startTimer', ...timerName(m) }),
  ],
  [
    new RegExp(`^(?:deten|detener|para|parar) (?:el )?temporizador${TIMER_NAME}$`),
    (m) => ({ type: 'stopTimer', ...timerName(m) }),
  ],
  [
    new RegExp(`^cuanto (?:falta|le falta|tiempo falta)${TIMER_NAME}$`),
    (m) => ({ type: 'queryTimer', ...timerName(m) }),
  ],
  [/^(?:explicame|explica)(?: el paso)?$/, () => ({ type: 'explain' })],
  [/^ayuda$/, () => ({ type: 'help' })],
  [/^donde estoy$/, () => ({ type: 'whereAmI' })],
  [/^(?:confirmo|confirmar|confirma)$/, () => ({ type: 'confirm' })],
  [/^(?:cancela|cancelar)$/, () => ({ type: 'cancel' })],
  [/^listo$/, () => ({ type: 'dismissAlert' })],
  [/^(?:saltar|salta|saltalo)(?: el paso)?$/, () => ({ type: 'skip' })],
  [
    /^(?:sustituye|sustituir|reemplaza|cambia) (?:el |la |los |las )?(.+)$/,
    (m) => ({
      type: 'substitute',
      ingredient: m[1]!,
    }),
  ],
  [/^(?:apaga|desactiva) (?:la )?camara$/, () => ({ type: 'cameraOff' })],
  [/^(?:enciende|prende|activa) (?:la )?camara$/, () => ({ type: 'cameraOn' })],
  [
    /^bloquea (?:los )?gestos(?: (?:por|durante) (\d+) segundos)?$/,
    (m) => (m[1] ? { type: 'lockGestures', seconds: Number(m[1]) } : { type: 'lockGestures' }),
  ],
  [/^no me (?:gusto|encanto)$/, () => ({ type: 'rate', value: 'down' })],
  [/^me (?:gusto|encanto)$/, () => ({ type: 'rate', value: 'up' })],
  [
    /^(?:estoy|me siento) (?:muy |un poco )?(nervios|cansad|confundid|feliz|content)[oa]?s?$/,
    (m) => ({
      type: 'feeling',
      feeling: FEELINGS[m[1]!]!,
    }),
  ],
  [
    /^(?:busca|buscar|busco) (?:recetas? (?:de|con) )?(.+)$/,
    (m) => ({ type: 'search', query: m[1]! }),
  ],
  [/^tengo (.+)$/, (m) => ({ type: 'addPantry', items: splitList(m[1]!) })],
];

/** Convierte una frase en un comando; `null` si está vacía. */
export function parseCommand(text: string): Command | null {
  // Las comas se cambian por " y " para no perder las listas.
  const normalized = normalizeSpeech(text.replace(/,/g, ' y '));
  if (!normalized) return null;
  for (const [pattern, build] of RULES) {
    const match = normalized.match(pattern);
    if (match) return build(match);
  }
  return { type: 'ask', question: text.trim() };
}
