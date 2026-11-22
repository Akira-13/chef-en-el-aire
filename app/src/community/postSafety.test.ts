// La marca de la lista usa el mismo validador que la pantalla de la receta, con el perfil de
// quien mira (RF-35).

import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import {
  toProfile,
  toRecipes,
  type CommunityPost,
  type RawProfileBook,
  type RawRecipeBook,
  type Recipe,
} from '@chef/shared';
import { postSafety } from './postSafety';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const profiles = (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile);
const byId = (id: string) => profiles.find((p) => p.id === id)!;
const rosa = byId('USR-001');
const diego = byId('USR-002');
const javier = byId('USR-004');

function recipePost(recipeId: string, recipe?: Recipe): Pick<CommunityPost, 'kind' | 'recipe'> {
  const found = recipes.find((r) => r.id === recipeId)!;
  // Copia serializada: así llegaría del servidor.
  return { kind: 'recipe', recipe: recipe ?? (JSON.parse(JSON.stringify(found)) as Recipe) };
}

describe('marca de seguridad de las recetas de la Comunidad', () => {
  it('con Rosa marca la leche de su esposo y no es segura (RF-35)', () => {
    const safety = postSafety(recipePost('REC-001'), rosa);
    expect(safety?.safe).toBe(false);
    expect(safety?.text).toContain('leche (para esposo)');
  });

  it('con Diego la misma lista choca por el maní, no por la leche (RF-35)', () => {
    const safety = postSafety(recipePost('REC-008'), diego);
    expect(safety?.safe).toBe(false);
    expect(safety?.text).toContain('maní');
    expect(safety?.text).not.toContain('leche');
  });

  it('con Javier la receta sin sus alérgenos se marca como segura (RF-35)', () => {
    expect(postSafety(recipePost('REC-008'), javier)).toEqual({
      safe: true,
      text: 'Sin alérgenos de tu perfil',
    });
  });

  it('lo detecta aunque la receta llegue sin etiquetas de alérgenos (RF-35)', () => {
    const original = recipes.find((r) => r.id === 'REC-001')!;
    const untagged: Recipe = {
      ...original,
      allergens: [],
      ingredients: original.ingredients.map((i) => ({ ...i, allergens: [] })),
    };
    expect(postSafety(recipePost('REC-001', untagged), rosa)?.safe).toBe(false);
  });

  it('los logros no llevan marca porque no tienen receta (RF-35)', () => {
    expect(postSafety({ kind: 'achievement' }, rosa)).toBeUndefined();
  });

  it('una receta que no se puede leer nunca se da por segura (RF-35)', () => {
    const broken = { kind: 'recipe', recipe: { id: 'REC-X' } } as unknown as Pick<
      CommunityPost,
      'kind' | 'recipe'
    >;
    expect(postSafety(broken, rosa)).toEqual({
      safe: false,
      text: 'No pude revisarla con tu perfil',
    });
  });
});
