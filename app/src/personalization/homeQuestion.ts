// Preguntas por voz en Inicio. El asistente del servidor responde sobre un paso de una receta,
// así que aquí se contesta lo que se puede con el recetario y la despensa (RF-01, RF-03), y lo
// demás recibe una indicación de qué decir en vez de silencio.

import type { Profile, Recipe } from '@chef/shared';
import { pantryMatches } from './pantry';
import { normalizeText } from './text';

export interface HomeAnswer {
  text: string;
  short: string;
}

// Hay muchas formas de pedir una sugerencia ("qué se puede cocinar", "qué receta hago", "dame
// ideas para comer"): basta con que la frase hable de cocinar y pida algo.
const ABOUT_COOKING = /\b(?:cocin\w*|prepar\w*|hago|hacer|comer|comida|recetas?|platos?)\b/;
const ASKING = /\b(?:que|cual|cuales|algo|ideas?)\b/;
// En Inicio, pedir una recomendación ya es pedir una receta: "recomiéndame algo".
const RECOMMEND = /\b(?:recomiend\w*|sugier\w*|sugiere\w*)\b|\bcon lo que tengo\b/;

export function isPantryQuestion(question: string): boolean {
  const text = normalizeText(question).replace(/[^\p{L}\p{N} ]/gu, ' ');
  return RECOMMEND.test(text) || (ABOUT_COOKING.test(text) && ASKING.test(text));
}

/** "a, b y c" */
function listInWords(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : (items[0] ?? '');
}

/**
 * Responde una pregunta hecha en Inicio. `suggested` son las recetas que ya muestra la pantalla:
 * vienen filtradas por alérgenos y dieta y ordenadas por cuánto de la despensa usan.
 */
export function answerHomeQuestion(
  question: string,
  suggested: Recipe[],
  profile: Profile,
): HomeAnswer {
  if (!isPantryQuestion(question)) {
    // Decir qué se escuchó deja ver si falló el reconocimiento o la frase no se entiende aquí.
    return {
      text: `Escuché «${question}». Aquí puedo buscar recetas o decirte qué cocinar con lo que tienes. Pídeme que busque una receta o pregúntame qué cocinar.`,
      short: 'Pídeme buscar una receta.',
    };
  }
  if (profile.pantry.length === 0) {
    return {
      // Sin frases de ejemplo: el micrófono oye al altavoz y las tomaría como órdenes.
      text: 'Tu despensa está vacía. Primero dime qué ingredientes tienes.',
      short: 'Tu despensa está vacía.',
    };
  }
  if (suggested.length === 0) {
    return { text: 'No encontré recetas seguras para tu perfil.', short: 'No encontré recetas.' };
  }

  const names = suggested.map((recipe) => recipe.name);
  const using = suggested.filter((recipe) => pantryMatches(recipe, profile) > 0);
  if (using.length === 0) {
    return {
      text: `Ninguna receta usa lo que tienes. Te sugiero ${listInWords(names)}.`,
      short: `Te sugiero ${listInWords(names)}.`,
    };
  }
  const detail = using.map(
    (recipe) =>
      `${recipe.name}, que usa ${pantryMatches(recipe, profile)} de sus ${recipe.ingredients.length} ingredientes`,
  );
  return {
    text: `Con lo que tienes puedes cocinar ${listInWords(detail)}.`,
    short: `Puedes cocinar ${listInWords(using.map((recipe) => recipe.name))}.`,
  };
}
