// Nombre y descripción de una receta adaptada (RNF-06). El validador de alérgenos no los revisa,
// pero el usuario los lee, así que se neutralizan si nombran un alérgeno vigilado.

import type { DietaryConstraints } from '../assistant';
import type { AllergenCategory, Recipe } from '../types/recipe';
import { findAllergensInText } from './index';

/** Alérgenos que vigila el pedido: los del propio perfil y los de sus comensales. */
export function watchedAllergens({
  allergies,
  dinerRestrictions,
}: DietaryConstraints): Set<AllergenCategory> {
  return new Set([...allergies, ...dinerRestrictions.map((r) => r.restriction)]);
}

/**
 * Si el nombre o la descripción de `adapted` nombran un alérgeno vigilado, los reemplaza por un
 * texto neutro, porque la descripción original puede mencionarlo igual. El nombre de reserva sale
 * de `original` (la receta antes de adaptar); sin ella, de la propia `adapted`.
 */
export function neutralizeTitles(
  adapted: Recipe,
  constraints: DietaryConstraints,
  original: Recipe = adapted,
): Recipe {
  const watched = watchedAllergens(constraints);
  const mentionsWatched = (text: string) =>
    findAllergensInText(text).some((m) => watched.has(m.allergen));
  const fallbackName = mentionsWatched(original.name) ? 'Receta adaptada' : original.name;
  return {
    ...adapted,
    name: mentionsWatched(adapted.name) ? fallbackName : adapted.name,
    description: mentionsWatched(adapted.description)
      ? `Versión adaptada de ${fallbackName}.`
      : adapted.description,
  };
}
