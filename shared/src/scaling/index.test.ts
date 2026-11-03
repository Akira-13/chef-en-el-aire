import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import { toRecipes } from '../data/mappers';
import type { RawRecipeBook } from '../data/raw';
import { scaleRecipe } from './index';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);

function byId(id: string) {
  const recipe = recipes.find((r) => r.id === id);
  if (!recipe) throw new Error(`No existe ${id}`);
  return recipe;
}

function quantityOf(recipe: ReturnType<typeof byId>, ingredientId: string): number {
  const ingredient = recipe.ingredients.find((i) => i.id === ingredientId);
  if (!ingredient) throw new Error(`No existe ${ingredientId}`);
  return ingredient.quantity;
}

describe('scaleRecipe', () => {
  it('reduce a la mitad REC-001 de 4 a 2 porciones (CA-04.2)', () => {
    const scaled = scaleRecipe(byId('REC-001'), 2);
    expect(scaled.servings).toBe(2);
    expect(quantityOf(scaled, 'ING-001')).toBe(250); // 500 g
    expect(quantityOf(scaled, 'ING-002')).toBe(2); // 4 cda
    expect(quantityOf(scaled, 'ING-006')).toBe(200); // 400 ml
    expect(quantityOf(scaled, 'ING-008')).toBe(15); // 30 g
    expect(quantityOf(scaled, 'ING-009')).toBe(1); // 2 unidades
    expect(quantityOf(scaled, 'ING-010')).toBe(2); // 4 unidades
  });

  it('redondea cda, cdta y taza a cuartos (CA-04.2)', () => {
    const scaled = scaleRecipe(byId('REC-006'), 2); // 3 → 2 porciones
    expect(quantityOf(scaled, 'ING-035')).toBe(0.75); // 1 taza × 2/3 = 0.67 → ¾
    const doubled = scaleRecipe(byId('REC-002'), 3); // 2 → 3 porciones
    expect(quantityOf(doubled, 'ING-014')).toBe(3); // 2 cda × 1.5
    expect(quantityOf(doubled, 'ING-015')).toBe(1.5); // 1 cda × 1.5
  });

  it('redondea unidades enteras con mínimo 1 (CA-04.2)', () => {
    const scaled = scaleRecipe(byId('REC-004'), 1); // 2 → 1 porción
    expect(quantityOf(scaled, 'ING-028')).toBe(1); // 0.5 unidad → mínimo 1
    expect(quantityOf(scaled, 'ING-025')).toBe(2); // 4 unidades → 2
    const dientes = scaleRecipe(byId('REC-005'), 2); // 4 → 2 porciones
    expect(quantityOf(dientes, 'ING-032')).toBe(2); // 3 dientes × 0.5 = 1.5 → 2
    expect(quantityOf(dientes, 'ING-033')).toBe(5); // 10 hojas
  });

  it('conserva en 0 la cantidad "omitir" y el resto de la receta (CA-04.2)', () => {
    const base = byId('REC-001');
    const withZero = {
      ...base,
      ingredients: base.ingredients.map((i) => (i.id === 'ING-004' ? { ...i, quantity: 0 } : i)),
    };
    const scaled = scaleRecipe(withZero, 2);
    expect(quantityOf(scaled, 'ING-004')).toBe(0);
    expect(scaled.steps).toEqual(base.steps);
    expect(scaled.ingredients.map((i) => i.id)).toEqual(base.ingredients.map((i) => i.id));
  });

  it('devuelve la receta igual si las porciones no cambian y no muta la original (CA-04.2)', () => {
    const base = byId('REC-001');
    const snapshot = JSON.parse(JSON.stringify(base)) as typeof base;
    expect(scaleRecipe(base, 4)).toEqual(snapshot);
    scaleRecipe(base, 2);
    expect(base).toEqual(snapshot);
  });

  it('ignora porciones inválidas (CA-04.2)', () => {
    const base = byId('REC-001');
    expect(scaleRecipe(base, 0)).toEqual(base);
    expect(scaleRecipe(base, Number.NaN)).toEqual(base);
  });
});
