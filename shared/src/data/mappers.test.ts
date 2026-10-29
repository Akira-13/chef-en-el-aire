import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import { ALLERGEN_CATEGORIES } from '../types/recipe';
import { toProfile, toRawProfile, toRawRecipe, toRecipe, toRecipes } from './mappers';
import type { RawProfileBook, RawRecipeBook } from './raw';

const recipeBook = rawRecipes as unknown as RawRecipeBook;
const profileBook = rawProfiles as unknown as RawProfileBook;

describe('recetario', () => {
  it('convierte las 10 recetas de ejemplo (RF-04)', () => {
    const recipes = toRecipes(recipeBook);
    expect(recipes).toHaveLength(10);
    for (const recipe of recipes) {
      expect(recipe.steps.map((s) => s.number)).toEqual(recipe.steps.map((_, i) => i + 1));
    }
  });

  it('vuelve al formato original sin perder datos (CA-04.3)', () => {
    for (const raw of recipeBook.recetas) {
      expect(toRawRecipe(toRecipe(raw))).toEqual(raw);
    }
  });

  it('usa solo las categorías de alérgenos conocidas', () => {
    expect([...recipeBook.categorias_alergenos].sort()).toEqual([...ALLERGEN_CATEGORIES].sort());
    for (const recipe of toRecipes(recipeBook)) {
      for (const ingredient of recipe.ingredients) {
        for (const allergen of ingredient.allergens) {
          expect(ALLERGEN_CATEGORIES).toContain(allergen);
        }
      }
    }
  });

  it('declara a nivel de receta los mismos alérgenos que sus ingredientes', () => {
    for (const recipe of toRecipes(recipeBook)) {
      const fromIngredients = new Set(recipe.ingredients.flatMap((i) => i.allergens));
      expect(new Set(recipe.allergens)).toEqual(fromIngredients);
    }
  });
});

describe('perfiles', () => {
  it('convierte los 4 perfiles de prueba', () => {
    const profiles = profileBook.perfiles.map(toProfile);
    expect(profiles.map((p) => p.name)).toEqual(['Rosa', 'Diego', 'Carmen', 'Javier']);
    expect(profiles[1]?.explicit.allergies).toEqual(['mani']);
  });

  it('exporta en el mismo formato de datos/perfiles.json (RNF-11)', () => {
    for (const raw of profileBook.perfiles) {
      expect(toRawProfile(toProfile(raw))).toEqual(raw);
    }
  });
});
