// Validación local de alérgenos, independiente del LLM (RF-07, RNF-06).
// Esta versión solo revisa los alérgenos declarados en cada ingrediente; una receta que viene
// del LLM puede traer ingredientes renombrados o nuevos sin alérgenos declarados, así que la
// validación debe completarse con reconocimiento por nombre antes de usarla en el Gateway LLM.

import type { DietaryConstraints, AllergenFinding } from '../assistant';
import type { Recipe } from '../types/recipe';

export function findAllergens(recipe: Recipe, constraints: DietaryConstraints): AllergenFinding[] {
  const findings: AllergenFinding[] = [];
  for (const ingredient of recipe.ingredients) {
    for (const allergen of ingredient.allergens) {
      if (constraints.allergies.includes(allergen)) {
        findings.push({
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          allergen,
          source: 'profile',
        });
      }
      for (const restriction of constraints.dinerRestrictions) {
        if (restriction.restriction === allergen) {
          findings.push({
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            allergen,
            source: 'diner',
            diner: restriction.diner,
          });
        }
      }
    }
  }
  return findings;
}
