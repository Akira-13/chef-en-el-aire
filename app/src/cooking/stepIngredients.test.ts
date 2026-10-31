import { describe, expect, it } from 'vitest';
import { toRecipes, type RawRecipeBook, type Recipe } from '@chef/shared';
import rawRecipes from '../../../datos/recetas.json';
import { stepIngredients } from './stepIngredients';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);

function names(recipeId: string, stepNumber: number): string[] {
  const recipe = recipes.find((r) => r.id === recipeId) as Recipe;
  const step = recipe.steps[stepNumber - 1];
  if (!step) throw new Error(`No existe el paso ${stepNumber}`);
  return stepIngredients(step, recipe.ingredients).map((ingredient) => ingredient.name);
}

describe('stepIngredients (CA-09.1)', () => {
  it('reconoce ingredientes nombrados a medias en el paso', () => {
    expect(names('REC-001', 1)).toEqual(['pechuga de pollo']);
    expect(names('REC-001', 4)).toEqual(['pasta de ají amarillo', 'cebolla roja', 'ajo molido']);
  });

  it('ignora tildes y plurales', () => {
    expect(names('REC-002', 1)).toEqual(['papas en bastones']);
    expect(names('REC-003', 3)).toEqual([
      'papa amarilla',
      'pasta de ají amarillo',
      'jugo de limón',
      'aceite vegetal',
    ]);
  });

  it('no incluye ingredientes que solo comparten una palabra descriptiva', () => {
    expect(names('REC-001', 7)).toEqual(['huevo duro', 'papa amarilla sancochada']);
    expect(names('REC-003', 6)).toEqual([]);
  });

  it('encuentra al menos un ingrediente en la mayoría de los pasos del recetario', () => {
    const steps = recipes.flatMap((recipe) =>
      recipe.steps.map((step) => stepIngredients(step, recipe.ingredients).length),
    );
    const withIngredients = steps.filter((count) => count > 0).length;
    expect(withIngredients / steps.length).toBeGreaterThan(0.75);
  });
});
