import { describe, expect, it } from 'vitest';
import type { Recipe } from '@chef/shared';
import { getRecipe } from '../data/recipes';
import { parseDeviceKey, parseNewComment, parseNewPost } from './schemas';

const recipe = (id = 'REC-008'): Recipe => structuredClone(getRecipe(id)!);

const achievement = {
  clientId: 'c-1',
  deviceKey: 'device-key-1',
  kind: 'achievement',
  alias: '  Dieguito ',
  recipeId: 'REC-001',
  recipeName: 'Ají de gallina',
  rating: 'up',
};

const recipePost = () => ({
  clientId: 'c-2',
  deviceKey: 'device-key-1',
  kind: 'recipe',
  alias: 'Dieguito',
  recipeId: 'REC-008',
  recipeName: 'Ocopa arequipeña',
  recipe: recipe(),
  changes: [{ kind: 'ingredient', before: 'Maní', after: 'Semillas de zapallo' }],
});

function failure(body: unknown): string {
  const result = parseNewPost(body);
  if (result.ok) throw new Error('Se esperaba un rechazo');
  return result.error;
}

describe('validación de publicaciones', () => {
  it('acepta un logro y recorta los espacios del alias', () => {
    const result = parseNewPost(achievement);
    expect(result.ok && result.data.alias).toBe('Dieguito');
  });

  it('acepta una receta adaptada completa', () => {
    const result = parseNewPost(recipePost());
    expect(result.ok && result.data.recipe?.id).toBe('REC-008');
  });

  it('rechaza un alias de 31 caracteres con un mensaje en español', () => {
    expect(failure({ ...achievement, alias: 'a'.repeat(31) })).toBe(
      'El alias admite hasta 30 caracteres.',
    );
  });

  it('rechaza un alias vacío o solo de espacios', () => {
    expect(failure({ ...achievement, alias: '   ' })).toMatch(/alias/i);
  });

  it('rechaza un mensaje de más de 500 caracteres', () => {
    expect(failure({ ...achievement, message: 'a'.repeat(501) })).toMatch(/500/);
  });

  it('rechaza enlaces http o https en el mensaje, el alias y los cambios', () => {
    for (const link of ['mira http://malo.example', 'HTTPS://malo.example/x']) {
      expect(failure({ ...achievement, message: link })).toMatch(/enlaces/i);
      expect(failure({ ...achievement, alias: link })).toMatch(/enlaces/i);
      const changes = [{ kind: 'step', before: 'A', after: link }];
      expect(failure({ ...recipePost(), changes })).toMatch(/enlaces/i);
    }
  });

  it('rechaza cuerpos que no son objetos sin lanzar error', () => {
    expect(failure(null)).toBeTruthy();
    expect(failure('hola')).toBeTruthy();
  });

  it('exige la receta cuando el tipo es "recipe"', () => {
    const { recipe: _omit, ...withoutRecipe } = recipePost();
    expect(failure(withoutRecipe)).toMatch(/receta/i);
  });

  it('rechaza una receta dentro de un logro y una valoración dentro de una receta', () => {
    expect(failure({ ...achievement, recipe: recipe('REC-001') })).toMatch(/receta/i);
    expect(failure({ ...recipePost(), rating: 'up' })).toMatch(/valoración/i);
  });

  it('rechaza una receta cuyo id no coincide con recipeId', () => {
    expect(failure({ ...recipePost(), recipeId: 'REC-001' })).toMatch(/no coincide/i);
  });

  it('rechaza un recipeId que no está en el recetario', () => {
    const unknown = { ...recipe(), id: 'REC-999' };
    expect(failure({ ...recipePost(), recipeId: 'REC-999', recipe: unknown })).toMatch(
      /recetario/i,
    );
  });

  it('rechaza una receta mal formada sin lanzar error', () => {
    const broken = { ...recipePost(), recipe: { ...recipe(), ingredients: 'maní' } };
    expect(failure(broken)).toMatch(/receta/i);
    const noSteps = { ...recipePost(), recipe: { ...recipe(), steps: [] } };
    expect(failure(noSteps)).toMatch(/receta/i);
    const empty = { ...recipePost(), recipe: {} };
    expect(failure(empty)).toMatch(/receta/i);
  });

  it('no deja pasar campos desconocidos de la receta', () => {
    const body = { ...recipePost(), recipe: { ...recipe(), secreto: 'x' } };
    const result = parseNewPost(body);
    expect(result.ok && 'secreto' in (result.data.recipe ?? {})).toBe(false);
  });
});

describe('validación de comentarios y aplausos', () => {
  const comment = {
    clientId: 'k-1',
    deviceKey: 'device-key-1',
    alias: 'Rosa',
    text: ' Quedó rico ',
  };

  it('acepta un comentario y recorta el texto', () => {
    const result = parseNewComment(comment);
    expect(result.ok && result.data.text).toBe('Quedó rico');
  });

  it('rechaza un comentario vacío o de más de 500 caracteres', () => {
    const empty = parseNewComment({ ...comment, text: '  ' });
    const long = parseNewComment({ ...comment, text: 'a'.repeat(501) });
    expect(!empty.ok && empty.error).toMatch(/comentario/i);
    expect(!long.ok && long.error).toMatch(/500/);
  });

  it('rechaza un comentario con enlaces http o https', () => {
    for (const text of ['entra a http://malo.example', 'Mira HTTPS://malo.example']) {
      const result = parseNewComment({ ...comment, text });
      expect(!result.ok && result.error).toMatch(/enlaces/i);
    }
  });

  it('exige el deviceKey', () => {
    expect(parseDeviceKey({}).ok).toBe(false);
    expect(parseDeviceKey(undefined).ok).toBe(false);
    expect(parseDeviceKey({ deviceKey: 'device-key-1' }).ok).toBe(true);
  });
});
