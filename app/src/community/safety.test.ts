// RF-35: una receta publicada en la Comunidad es dato no confiable. Quien la abre la valida con
// su propio perfil, aunque llegue sin alérgenos declarados.

import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import {
  findAllergens,
  toProfile,
  toRecipes,
  type Profile,
  type RawProfileBook,
  type RawRecipeBook,
  type Recipe,
} from '@chef/shared';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const profiles = (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile);
const byId = (id: string) => profiles.find((p) => p.id === id)!;
const rosa = byId('USR-001');
const diego = byId('USR-002');
const javier = byId('USR-004');

/** La receta tal como llegaría del servidor: una copia serializada, sin referencias locales. */
function published(recipeId: string): Recipe {
  return JSON.parse(JSON.stringify(recipes.find((r) => r.id === recipeId)!)) as Recipe;
}

/** La misma receta sin ninguna etiqueta de alérgeno, ni en la receta ni en sus ingredientes. */
function withoutAllergenTags(recipe: Recipe): Recipe {
  return {
    ...recipe,
    allergens: [],
    ingredients: recipe.ingredients.map((i) => ({ ...i, allergens: [] })),
  };
}

// Lo mismo que calcula la pantalla de la receta para decidir si bloquea.
const blocks = (recipe: Recipe, profile: Profile) =>
  findAllergens(recipe, profile.explicit).length > 0;

describe('recetas publicadas en la Comunidad', () => {
  it('con Rosa encuentra la leche y bloquea (RF-35, CA-28.1)', () => {
    const recipe = published('REC-001');
    const findings = findAllergens(recipe, rosa.explicit);
    expect(findings.map((f) => f.allergen)).toContain('leche');
    expect(findings.find((f) => f.allergen === 'leche')).toMatchObject({
      source: 'diner',
      diner: 'esposo',
    });
    expect(blocks(recipe, rosa)).toBe(true);
  });

  it('sin etiquetas de alérgenos, la detección por texto sigue encontrando la leche (RF-35, CA-28.1)', () => {
    const recipe = withoutAllergenTags(published('REC-001'));
    expect(recipe.ingredients.every((i) => i.allergens.length === 0)).toBe(true);
    const findings = findAllergens(recipe, rosa.explicit);
    expect(findings.map((f) => f.allergen)).toContain('leche');
    expect(blocks(recipe, rosa)).toBe(true);
  });

  it('los hallazgos dependen del perfil de quien la abre (RF-35)', () => {
    for (const recipe of [published('REC-008'), withoutAllergenTags(published('REC-008'))]) {
      const allergensFor = (profile: Profile) =>
        new Set(findAllergens(recipe, profile.explicit).map((f) => f.allergen));
      expect([...allergensFor(rosa)]).toEqual(['leche']);
      expect([...allergensFor(diego)]).toEqual(['mani']);
      expect(blocks(recipe, javier)).toBe(false);
    }
  });
});
