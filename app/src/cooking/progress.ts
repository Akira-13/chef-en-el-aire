// Cálculos del avance de una receta, separados de la pantalla para poder probarlos.

import type { CelebrationStyle, Recipe } from '@chef/shared';

// Ritmo aproximado de la voz sintetizada en español.
const READING_MS_PER_CHARACTER = 60;

/** Tiempo que tarda en leerse un texto en voz alta. */
export function estimatedReadingMs(text: string): number {
  return text.length * READING_MS_PER_CHARACTER;
}

/** Ids de los ingredientes del recetario que cambiaron o se quitaron en la versión cocinada. */
export function substitutedIngredients(original: Recipe | undefined, cooked: Recipe): string[] {
  if (!original) return [];
  return original.ingredients
    .filter(
      (ingredient) =>
        cooked.ingredients.find((candidate) => candidate.id === ingredient.id)?.name !==
        ingredient.name,
    )
    .map((ingredient) => ingredient.id);
}

/** Frase de ánimo según el avance; al principio no hace falta interrumpir (RF-39). */
export function encouragement(stepIndex: number, totalSteps: number): string | null {
  if (totalSteps > 1 && stepIndex === totalSteps - 1) return '¡Último paso!';
  if (stepIndex >= Math.floor(totalSteps / 2)) return '¡Vas muy bien!';
  return null;
}

export interface CelebrationPlan {
  /** Duración de la animación; nunca pasa de 5 s (RNF-16). */
  durationMs: number;
  /** Cantidad de piezas de confeti. */
  confetti: number;
  sound: boolean;
}

/** Celebración según las preferencias del perfil: sin sonido para quien no lo usa (CA-32.2). */
export function celebrationPlan(style: CelebrationStyle, hasAudioOutput: boolean): CelebrationPlan {
  const sound = hasAudioOutput && style !== 'solo_visual';
  return style === 'breve'
    ? { durationMs: 2000, confetti: 8, sound }
    : { durationMs: 4000, confetti: 16, sound };
}
