// Intérprete de voz (RF-18, CA-13.1). Lo que no es un comando se trata como una pregunta.

import type { Command, Feeling } from '@chef/shared';
import { normalizeSpeech } from './normalize';

/** `original` es la frase tal como se dijo, con tildes y mayúsculas. */
type Rule = [RegExp, (match: RegExpMatchArray, original: string) => Command];

// Nombre opcional de un temporizador: "de X", "del X" o "de la X".
const TIMER_NAME = '(?: (?:del|de la|de los|de las|de)? ?(.+))?';

function timerName(match: RegExpMatchArray): { name?: string } {
  const name = match[1]?.trim();
  return name ? { name } : {};
}

// Verbos con que se pide iniciar o detener un temporizador ("desactiva temporizador cebolla").
const START_TIMER = 'inicia|iniciar|empieza|empezar|comienza|arranca|activa|activar|prende|pon';
const STOP_TIMER =
  'deten|detener|para|parar|desactiva|desactivar|apaga|apagar|quita|quitar|cancela|cancelar|elimina|eliminar|borra|borrar';

const FEELINGS: Record<string, Feeling> = {
  nervios: 'nervous',
  cansad: 'tired',
  confundid: 'confused',
  feliz: 'happy',
  content: 'happy',
};

// Porciones que se pueden pedir por voz, en cifra o en palabra (CA-04.2).
const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};
const SERVINGS = `(1[0-2]|[1-9]|${Object.keys(NUMBER_WORDS).join('|')})`;

/** Texto de "comenta que me salió rica" sin "comenta" ni el "que" inicial, con sus tildes. */
function commentText(original: string): string {
  const text = original
    .trim()
    .replace(/^comenta(?:r|rio)?\b[\s:,]*/i, '')
    .replace(/^que\s+/i, '')
    .trim();
  return text || original.trim();
}

/** Separa "arroz, huevos y cebolla" en ["arroz", "huevos", "cebolla"]. */
function splitList(text: string): string[] {
  return text
    .replace(/ (?:y|e)$/, '')
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
    new RegExp(`^(?:${START_TIMER}) (?:el )?temporizador${TIMER_NAME}$`),
    (m) => ({ type: 'startTimer', ...timerName(m) }),
  ],
  [
    new RegExp(`^(?:${STOP_TIMER}) (?:el )?temporizador${TIMER_NAME}$`),
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
  [/^(?:apaga|deten|para|silencia|quita) (?:la )?alarma$/, () => ({ type: 'dismissAlert' })],
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
  // Porciones y Comunidad (CA-04.2, RF-33 a RF-37). Van antes de tomar la frase como pregunta.
  [
    new RegExp(`^para ${SERVINGS} porcion(?:es)?$`),
    (m) => ({ type: 'setServings', servings: NUMBER_WORDS[m[1]!] ?? Number(m[1]) }),
  ],
  [/^(?:abre|abrir|ir a|ve a|vamos a) la comunidad$/, () => ({ type: 'openCommunity' })],
  [/^(?:publica|publicar|comparte|compartir) mi (?:receta|logro)$/, () => ({ type: 'share' })],
  [/^(?:publicalo|compartelo)$/, () => ({ type: 'share' })],
  [/^(?:aplaude|aplaudir|aplauso)$/, () => ({ type: 'applaud' })],
  [/^comenta(?:r|rio)? .+$/, (_m, original) => ({ type: 'comment', text: commentText(original) })],
];

/** Convierte una frase en un comando; `null` si está vacía. */
export function parseCommand(text: string): Command | null {
  // Las comas se cambian por " y " para no perder las listas.
  const normalized = normalizeSpeech(text.replace(/,/g, ' y '));
  if (!normalized) return null;
  for (const [pattern, build] of RULES) {
    const match = normalized.match(pattern);
    if (match) return build(match, text);
  }
  return { type: 'ask', question: text.trim() };
}
