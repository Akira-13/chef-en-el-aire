// Recetario leído de datos/recetas.json, que sigue siendo la única fuente de las recetas.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toRecipes, type RawRecipeBook, type Recipe } from '@chef/shared';

const RECIPES_FILE = fileURLToPath(new URL('../../../datos/recetas.json', import.meta.url));

let cache: Recipe[] | null = null;

export function getRecipes(): Recipe[] {
  if (!cache) {
    const book = JSON.parse(readFileSync(RECIPES_FILE, 'utf8')) as RawRecipeBook;
    cache = toRecipes(book);
  }
  return cache;
}

export function getRecipe(id: string): Recipe | undefined {
  return getRecipes().find((recipe) => recipe.id === id);
}
