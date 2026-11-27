// Alergias y dieta que el usuario declara (RF-28). Solo reglas, sin interfaz.

import { ALLERGEN_CATEGORIES, type AllergenCategory } from '@chef/shared';

/**
 * Dietas que existen en los datos de los perfiles (datos/perfiles.json). `explicit.diet` es un
 * texto libre y el motor de sustituciones reconoce «vegetarian»/«vegan» dentro de él, así que
 * no se inventan valores nuevos.
 */
export const DIET_LABELS: Record<string, string> = {
  omnivora: 'Como de todo',
  vegetariana: 'Vegetariana',
};

/** Agrega o quita una alergia sin duplicar y conservando el orden de las categorías. */
export function withAllergy(
  allergies: readonly AllergenCategory[],
  category: AllergenCategory,
  on: boolean,
): AllergenCategory[] {
  const rest = allergies.filter((a) => a !== category);
  const next = on ? [...rest, category] : rest;
  return ALLERGEN_CATEGORIES.filter((c) => next.includes(c));
}
