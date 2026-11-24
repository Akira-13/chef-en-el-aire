import { describe, expect, it } from 'vitest';
import { toRecipes, type RawRecipeBook, type Recipe } from '@chef/shared';
import rawRecipes from '../../../datos/recetas.json';
import { activeScaling, clampServings, planServingsChange, type ServingsBase } from './servings';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const rec001 = recipes.find((recipe) => recipe.id === 'REC-001') as Recipe;

function quantityOf(recipe: Recipe, ingredientId: string): number {
  const ingredient = recipe.ingredients.find((i) => i.id === ingredientId);
  if (!ingredient) throw new Error(`No existe ${ingredientId}`);
  return ingredient.quantity;
}

/** Aplica un cambio como lo hace el hook: guarda la base y devuelve la receta mostrada. */
function apply(
  entry: ServingsBase | undefined,
  shown: Recipe,
  shownIsAdapted: boolean,
  requested: number,
): { shown: Recipe; entry: ServingsBase | undefined } {
  const action = planServingsChange(entry, shown, shownIsAdapted, requested);
  if (action.kind === 'restoreBase') return { shown: action.base, entry: undefined };
  return { shown: action.scaled, entry: action.entry };
}

describe('selector de porciones (CA-04.2)', () => {
  it('REC-001 de 4 a 2 porciones deja cantidades a la mitad (CA-04.2)', () => {
    const { shown, entry } = apply(undefined, rec001, false, 2);
    expect(shown.servings).toBe(2);
    expect(quantityOf(shown, 'ING-001')).toBe(250); // 500 g
    expect(quantityOf(shown, 'ING-002')).toBe(2); // 4 cda
    expect(quantityOf(shown, 'ING-009')).toBe(1); // 2 unidades
    expect(entry?.fromOriginal).toBe(true);
    expect(activeScaling(entry, shown)).toBeDefined();
  });

  it('ir de 2 a 4 vuelve a las cantidades originales (CA-04.2)', () => {
    const half = apply(undefined, rec001, false, 2);
    const back = apply(half.entry, half.shown, true, 4);
    expect(back.shown).toEqual(rec001);
    expect(back.entry).toBeUndefined();
  });

  it('escalar de nuevo parte de la base y no acumula redondeos (CA-04.2)', () => {
    const half = apply(undefined, rec001, false, 2);
    const three = apply(half.entry, half.shown, true, 3);
    const direct = apply(undefined, rec001, false, 3);
    expect(three.shown).toEqual(direct.shown);
    expect(three.entry?.base).toEqual(rec001);
  });

  it('una adaptación nueva descarta la base guardada (CA-04.2)', () => {
    const half = apply(undefined, rec001, false, 2);
    const adapted: Recipe = { ...half.shown, name: 'REC-001 sin lácteos' };
    expect(activeScaling(half.entry, adapted)).toBeUndefined();
    // Sin escalado activo, la receta que llega pasa a ser la base.
    const next = apply(half.entry, adapted, true, 6);
    expect(next.entry?.base).toEqual(adapted);
    expect(next.entry?.fromOriginal).toBe(false);
  });

  it('acota las porciones entre 1 y 12 (RF-05)', () => {
    expect(clampServings(0)).toBe(1);
    expect(clampServings(13)).toBe(12);
    expect(clampServings(Number.NaN)).toBe(1);
    expect(clampServings(2.4)).toBe(2);
  });
});
