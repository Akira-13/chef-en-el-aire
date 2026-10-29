// Personalización a partir del perfil: sugerencias, búsqueda y estado de la despensa.
// Esta versión es mínima (filtra alérgenos y busca por texto); los criterios completos de
// CA-01.1 a CA-01.3, CA-02.3 y CA-03.2 se implementan aquí.

import type { Profile, Recipe } from '@chef/shared';

export interface SuggestionResult {
  recipes: Recipe[];
  /** Explicación cuando hubo que relajar un filtro (CA-01.3). */
  message?: string;
}

export type IngredientStatus = 'have' | 'missing' | 'substitute';

/** Pasa a minúsculas y quita tildes para comparar textos escritos o dictados. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function isSafeFor(recipe: Recipe, profile: Profile): boolean {
  const blocked = new Set([
    ...profile.explicit.allergies,
    ...profile.explicit.dinerRestrictions.map((r) => r.restriction),
  ]);
  return !recipe.allergens.some((allergen) => blocked.has(allergen));
}

// RF-01: tres recetas sugeridas al abrir la app.
export function suggestRecipes(recipes: Recipe[], profile: Profile): SuggestionResult {
  return { recipes: recipes.filter((recipe) => isSafeFor(recipe, profile)).slice(0, 3) };
}

// RF-02: búsqueda por nombre o por ingrediente.
export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
  const q = normalizeText(query);
  if (!q) return [];
  return recipes.filter(
    (recipe) =>
      normalizeText(recipe.name).includes(q) ||
      recipe.ingredients.some((ingredient) => normalizeText(ingredient.name).includes(q)),
  );
}

// RF-03: estado de cada ingrediente frente a la despensa, por id de ingrediente.
export function pantryStatus(recipe: Recipe, profile: Profile): Record<string, IngredientStatus> {
  const pantry = profile.pantry.map(normalizeText);
  const status: Record<string, IngredientStatus> = {};
  for (const ingredient of recipe.ingredients) {
    const name = normalizeText(ingredient.name);
    const have = pantry.some((item) => name.includes(item) || item.includes(name));
    status[ingredient.id] = have
      ? 'have'
      : ingredient.substitutes.length
        ? 'substitute'
        : 'missing';
  }
  return status;
}
