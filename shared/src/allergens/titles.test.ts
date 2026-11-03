import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import { toRecipes } from '../data/mappers';
import type { RawRecipeBook } from '../data/raw';
import type { DietaryConstraints } from '../assistant';
import type { Recipe } from '../types/recipe';
import { neutralizeTitles, watchedAllergens } from './titles';

const base = toRecipes(rawRecipes as unknown as RawRecipeBook)[0]!;
const titled = (name: string, description: string): Recipe => ({ ...base, name, description });
const only = (...allergies: DietaryConstraints['allergies']): DietaryConstraints => ({
  allergies,
  dinerRestrictions: [],
  diet: 'omnivora',
});

describe('watchedAllergens', () => {
  it('junta las alergias del perfil y las restricciones de los comensales (RF-07)', () => {
    const constraints: DietaryConstraints = {
      allergies: ['mani'],
      dinerRestrictions: [{ diner: 'esposo', restriction: 'leche', reason: 'lactosa' }],
      diet: 'omnivora',
    };
    expect([...watchedAllergens(constraints)].sort()).toEqual(['leche', 'mani']);
  });
});

describe('neutralizeTitles', () => {
  it('reemplaza por un texto neutro el nombre y la descripción que nombran un alérgeno vigilado (RNF-06)', () => {
    const original = titled('Ocopa', 'Papas con salsa de maní.');
    const result = neutralizeTitles(
      titled('Ocopa de maní', 'Salsa de maní.'),
      only('mani'),
      original,
    );
    expect(result.name).toBe('Ocopa');
    expect(result.description).toBe('Versión adaptada de Ocopa.');
  });

  it('usa "Receta adaptada" si el nombre original también nombra el alérgeno (RNF-06)', () => {
    const original = titled('Sopa de maní', 'Sopa.');
    const result = neutralizeTitles(titled('Sopa de maní', 'Con maní.'), only('mani'), original);
    expect(result.name).toBe('Receta adaptada');
    expect(result.description).toBe('Versión adaptada de Receta adaptada.');
  });

  it('sin la receta original, la propia receta sirve de referencia (RNF-06)', () => {
    const result = neutralizeTitles(titled('Pasta de maní', 'Con maní.'), only('mani'));
    expect(result.name).toBe('Receta adaptada');
    expect(result.description).toBe('Versión adaptada de Receta adaptada.');
  });

  it('deja intactos los textos que no nombran un alérgeno vigilado (RNF-06)', () => {
    const recipe = titled('Ocopa de maní', 'Con queso fresco.');
    const result = neutralizeTitles(recipe, only('huevo'));
    expect(result).toEqual(recipe);
  });

  it('también vigila las restricciones de los comensales (CA-23.1)', () => {
    const constraints: DietaryConstraints = {
      allergies: [],
      dinerRestrictions: [{ diner: 'esposo', restriction: 'leche', reason: 'lactosa' }],
      diet: 'omnivora',
    };
    const result = neutralizeTitles(titled('Arroz', 'Con queso.'), constraints);
    expect(result.name).toBe('Arroz');
    expect(result.description).toBe('Versión adaptada de Arroz.');
  });

  it('no modifica la receta recibida (RNF-06)', () => {
    const recipe = titled('Ocopa de maní', 'Con maní.');
    const before = JSON.stringify(recipe);
    neutralizeTitles(recipe, only('mani'));
    expect(JSON.stringify(recipe)).toBe(before);
  });
});
