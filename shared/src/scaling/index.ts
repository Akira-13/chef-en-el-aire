// Escalado determinista de porciones en unidades caseras (CA-04.2).
// Es una función pura y se aplica antes del LLM: el modelo recibe la receta ya escalada y
// solo sustituye ingredientes, nunca recalcula cantidades.

import type { Recipe } from '../types/recipe';

// Unidades que se miden en cuartos (¼, ½, ¾, 1…).
const QUARTER_UNITS = new Set(['cda', 'cdta', 'taza']);
// Unidades que solo admiten enteros, con mínimo 1 si el original era mayor que 0.
const COUNT_UNITS = new Set(['unidad', 'dientes', 'hojas', 'rebanadas', 'tira', 'tallo', 'pizca']);

function roundQuantity(quantity: number, unit: string): number {
  if (quantity <= 0) return 0;
  if (QUARTER_UNITS.has(unit)) return Math.max(0.25, Math.round(quantity * 4) / 4);
  if (COUNT_UNITS.has(unit)) return Math.max(1, Math.round(quantity));
  // Pesos y volúmenes: enteros desde 10, un decimal por debajo.
  return quantity >= 10 ? Math.round(quantity) : Math.round(quantity * 10) / 10;
}

// Copia profunda de los datos de la receta (solo contiene valores JSON).
function cloneRecipe(recipe: Recipe): Recipe {
  return JSON.parse(JSON.stringify(recipe)) as Recipe;
}

/** Devuelve una copia de `recipe` para `servings` porciones; la original no se modifica. */
export function scaleRecipe(recipe: Recipe, servings: number): Recipe {
  const copy = cloneRecipe(recipe);
  const valid = Number.isFinite(servings) && servings > 0;
  if (!valid || servings === recipe.servings) return copy;
  const factor = servings / recipe.servings;
  copy.servings = servings;
  for (const ingredient of copy.ingredients) {
    ingredient.quantity = roundQuantity(ingredient.quantity * factor, ingredient.unit);
  }
  return copy;
}
