import { describe, expect, it } from 'vitest';
import type { Ingredient, Recipe } from '@chef/shared';
import { celebrationPlan, estimatedReadingMs, substitutedIngredients } from './progress';

function recipe(ingredients: Pick<Ingredient, 'id' | 'name'>[]): Recipe {
  return { ingredients } as Recipe;
}

describe('substitutedIngredients', () => {
  const original = recipe([
    { id: 'ING-006', name: 'leche evaporada' },
    { id: 'ING-007', name: 'pecanas picadas' },
    { id: 'ING-001', name: 'pechuga de pollo' },
  ]);

  it('lista los ingredientes reemplazados o quitados (CA-26.1)', () => {
    const cooked = recipe([
      { id: 'ING-006', name: 'caldo de pollo + 2 cda de maicena' },
      { id: 'ING-001', name: 'pechuga de pollo' },
    ]);
    expect(substitutedIngredients(original, cooked)).toEqual(['ING-006', 'ING-007']);
  });

  it('no lista nada si se cocinó la receta original', () => {
    expect(substitutedIngredients(original, original)).toEqual([]);
    expect(substitutedIngredients(undefined, original)).toEqual([]);
  });
});

describe('celebrationPlan', () => {
  it('dura como máximo 5 s con cualquier preferencia (RNF-16)', () => {
    for (const style of ['breve', 'completa', 'sonora', 'solo_visual'] as const) {
      expect(celebrationPlan(style, true).durationMs).toBeLessThanOrEqual(5000);
    }
  });

  it('es más corta con la preferencia "breve"', () => {
    expect(celebrationPlan('breve', true).durationMs).toBeLessThan(
      celebrationPlan('completa', true).durationMs,
    );
  });

  it('no suena para quien eligió solo lo visual o no tiene salida de audio (CA-32.2)', () => {
    expect(celebrationPlan('solo_visual', true).sound).toBe(false);
    expect(celebrationPlan('completa', false).sound).toBe(false);
    expect(celebrationPlan('sonora', true).sound).toBe(true);
  });
});

describe('estimatedReadingMs', () => {
  it('crece con el largo del texto', () => {
    expect(estimatedReadingMs('un paso largo de la receta')).toBeGreaterThan(
      estimatedReadingMs('corto'),
    );
  });
});
