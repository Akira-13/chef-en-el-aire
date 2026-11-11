// Despensa del perfil frente a los ingredientes de una receta (RF-03, CA-03.2).

import type { Profile, Recipe } from '@chef/shared';
import { phrasesMatch, tokens } from './text';

export type IngredientStatus = 'have' | 'missing' | 'substitute';

/** Verdadero si algún elemento de la despensa cubre el ingrediente. */
export function inPantry(pantry: readonly string[], ingredientName: string): boolean {
  return pantry.some((item) => phrasesMatch(item, ingredientName));
}

/** Cuántos ingredientes de la receta hay en la despensa. */
export function pantryMatches(recipe: Recipe, profile: Profile): number {
  return recipe.ingredients.filter((ingredient) => inPantry(profile.pantry, ingredient.name))
    .length;
}

// RF-03: estado de cada ingrediente frente a la despensa, por id de ingrediente.
export function pantryStatus(recipe: Recipe, profile: Profile): Record<string, IngredientStatus> {
  const status: Record<string, IngredientStatus> = {};
  for (const ingredient of recipe.ingredients) {
    status[ingredient.id] = inPantry(profile.pantry, ingredient.name)
      ? 'have'
      : ingredient.substitutes.length
        ? 'substitute'
        : 'missing';
  }
  return status;
}

/** Agrega elementos a la despensa sin repetir los que ya están (CA-03.1). */
export function addToPantry(pantry: readonly string[], items: readonly string[]): string[] {
  const key = (text: string) => tokens(text).join(' ');
  const next = [...pantry];
  for (const raw of items) {
    const item = raw.trim();
    if (key(item) && !next.some((existing) => key(existing) === key(item))) next.push(item);
  }
  return next;
}
