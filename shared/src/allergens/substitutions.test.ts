import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import { toProfile, toRecipes } from '../data/mappers';
import type { RawProfileBook, RawRecipeBook } from '../data/raw';
import type { DietaryConstraints } from '../assistant';
import type { Ingredient, Recipe, Substitute } from '../types/recipe';
import { findAllergens } from './index';
import { applySafeSubstitutions } from './substitutions';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const profiles = (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile);

function byId<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`No existe ${id}`);
  return item;
}

const none: DietaryConstraints = { allergies: [], dinerRestrictions: [], diet: 'omnivora' };
const only = (...allergies: DietaryConstraints['allergies']): DietaryConstraints => ({
  ...none,
  allergies,
});

// Receta mínima con un solo ingrediente y los sustitutos indicados.
function recipeWith(name: string, allergens: Ingredient['allergens'], substitutes: Substitute[]) {
  const base = byId(recipes, 'REC-006');
  const ingredient: Ingredient = {
    id: 'ING-X1',
    name,
    quantity: 1,
    unit: 'taza',
    allergens,
    substitutes,
  };
  return { ...base, allergens, ingredients: [ingredient], steps: [] } satisfies Recipe;
}

const sub = (name: string, reason: Substitute['reason']): Substitute => ({
  name,
  quantity: 1,
  unit: 'taza',
  reason,
});

describe('applySafeSubstitutions', () => {
  it('cambia el maní de la ocopa por su sustituto del recetario y queda sin alérgenos (RF-07)', () => {
    const ocopa = byId(recipes, 'REC-008');
    const diego = only('mani');
    const result = applySafeSubstitutions(ocopa, diego)!;
    const peanut = result.adapted.ingredients.find((i) => i.id === 'ING-050')!;
    expect(peanut).toMatchObject({
      name: 'semillas de girasol tostadas',
      quantity: 0.5,
      unit: 'taza',
    });
    expect(result.changes).toContainEqual({
      kind: 'ingredient',
      target: 'ING-050',
      before: 'maní tostado',
      after: 'semillas de girasol tostadas',
      reason: 'Sin maní',
    });
    expect(result.findings).toEqual([]);
    expect(findAllergens(result.adapted, diego)).toEqual([]);
  });

  it('reescribe los pasos que nombraban el ingrediente y lo muestra como cambio (RNF-06)', () => {
    const result = applySafeSubstitutions(byId(recipes, 'REC-008'), only('mani'))!;
    const step3 = result.adapted.steps.find((s) => s.number === 3)!;
    expect(step3.text).not.toMatch(/maní/);
    expect(step3.text).toContain('semillas de girasol tostadas');
    expect(result.changes.find((c) => c.kind === 'step' && c.target === '3')).toBeDefined();
  });

  it('no deja alérgenos vigilados en el nombre ni en la descripción (RNF-06)', () => {
    const result = applySafeSubstitutions(byId(recipes, 'REC-008'), only('mani'))!;
    expect(result.adapted.description).not.toMatch(/maní/);
    expect(result.adapted.allergens).not.toContain('mani');
  });

  it('no modifica la receta original', () => {
    const ocopa = byId(recipes, 'REC-008');
    const before = JSON.stringify(ocopa);
    applySafeSubstitutions(ocopa, only('mani', 'leche'));
    expect(JSON.stringify(ocopa)).toBe(before);
  });

  it('solo usa sustitutos cuyo motivo coincide con las restricciones (CA-06.3)', () => {
    const result = applySafeSubstitutions(byId(recipes, 'REC-008'), only('huevo'))!;
    expect(result.changes.filter((c) => c.kind === 'ingredient').map((c) => c.target)).toEqual([
      'ING-054',
    ]);
    const ocopa = byId(recipes, 'REC-008');
    const leche = result.adapted.ingredients.find((i) => i.id === 'ING-053')!;
    expect(leche).toEqual(ocopa.ingredients.find((i) => i.id === 'ING-053'));
  });

  it('considera las restricciones de los comensales y dice para quién (CA-23.1)', () => {
    const constraints: DietaryConstraints = {
      ...none,
      dinerRestrictions: [{ diner: 'esposo', restriction: 'leche', reason: 'lactosa' }],
    };
    const result = applySafeSubstitutions(byId(recipes, 'REC-001'), constraints)!;
    expect(result.changes).toContainEqual(
      expect.objectContaining({ target: 'ING-008', reason: 'Sin leche (para esposo)' }),
    );
  });

  it('descarta el sustituto que el validador marca y prueba el siguiente (RNF-06)', () => {
    // El tofu es soya: para quien tiene alergia a la leche y a la soya no sirve.
    const recipe = recipeWith(
      'queso fresco',
      ['leche'],
      [sub('tofu firme', 'leche'), sub('palta', 'leche')],
    );
    const result = applySafeSubstitutions(recipe, only('leche', 'soya'))!;
    expect(result.adapted.ingredients[0]?.name).toBe('palta');
    expect(result.findings).toEqual([]);
  });

  it('si ningún sustituto es seguro, deja el ingrediente y lo informa como hallazgo (RNF-06)', () => {
    const recipe = recipeWith('queso fresco', ['leche'], [sub('tofu firme', 'leche')]);
    recipe.ingredients.push({
      ...recipe.ingredients[0]!,
      id: 'ING-X2',
      name: 'maní',
      allergens: ['mani'],
      substitutes: [sub('girasol', 'mani')],
    });
    const result = applySafeSubstitutions(recipe, only('leche', 'soya', 'mani'))!;
    expect(result.adapted.ingredients.map((i) => i.name)).toEqual(['queso fresco', 'girasol']);
    expect(result.findings.map((f) => f.ingredientId)).toEqual(['ING-X1']);
  });

  it('devuelve null si ningún sustituto es seguro y no cambia nada (RNF-06)', () => {
    const recipe = recipeWith('queso fresco', ['leche'], [sub('tofu firme', 'leche')]);
    expect(applySafeSubstitutions(recipe, only('leche', 'soya'))).toBeNull();
  });

  it('omitir quita el ingrediente, y si un paso lo nombra queda como hallazgo (RNF-06)', () => {
    const result = applySafeSubstitutions(byId(recipes, 'REC-008'), only('huevo'))!;
    expect(result.adapted.ingredients.some((i) => i.id === 'ING-054')).toBe(false);
    expect(result.changes).toContainEqual(
      expect.objectContaining({ target: 'ING-054', before: 'huevo duro', after: 'omitir' }),
    );
    expect(result.findings).toEqual([expect.objectContaining({ ingredientId: 'step-5' })]);
  });

  it('con dieta vegetariana aplica los sustitutos "vegetariano" (CA-06.3)', () => {
    const javier = byId(profiles, 'USR-004').explicit;
    const result = applySafeSubstitutions(byId(recipes, 'REC-002'), javier)!;
    expect(result.adapted.ingredients.find((i) => i.id === 'ING-011')?.name).toBe(
      'champiñones en láminas',
    );
    expect(result.changes).toContainEqual(
      expect.objectContaining({ target: 'ING-011', reason: 'Dieta vegetariana' }),
    );
  });

  it('ignora los sustitutos de despensa, gusto o picante: no son restricciones', () => {
    // REC-009 trae un sustituto "picante" para el ají limo y REC-004 uno de "despensa".
    expect(applySafeSubstitutions(byId(recipes, 'REC-009'), none)).toBeNull();
    expect(applySafeSubstitutions(byId(recipes, 'REC-004'), none)).toBeNull();
  });

  it('devuelve null si la receta no necesita sustituir nada', () => {
    expect(applySafeSubstitutions(byId(recipes, 'REC-006'), only('mani'))).toBeNull();
  });

  it('nunca devuelve un reemplazo que el validador marque, en las 10 recetas × 4 perfiles (RNF-06)', () => {
    for (const recipe of recipes) {
      for (const profile of profiles) {
        const constraints = profile.explicit;
        const result = applySafeSubstitutions(recipe, constraints);
        if (!result) continue;
        const before = findAllergens(recipe, constraints);
        // Lo que informa coincide con lo que dice el validador sobre la receta resultante.
        expect(result.findings).toEqual(findAllergens(result.adapted, constraints));
        expect(result.findings.length).toBeLessThanOrEqual(before.length);
        // Los ingredientes nuevos, tal como quedaron, no tienen hallazgos propios.
        const originalIds = new Set(recipe.ingredients.map((i) => i.name));
        for (const ingredient of result.adapted.ingredients) {
          if (originalIds.has(ingredient.name)) continue;
          const alone = { ...result.adapted, ingredients: [ingredient], steps: [] };
          expect(findAllergens(alone, constraints), `${recipe.id} ${profile.name}`).toEqual([]);
        }
      }
    }
  });
});
