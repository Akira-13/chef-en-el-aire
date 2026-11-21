import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import { ALLERGEN_CATEGORIES } from '../types/recipe';
import { toProfile, toRawProfile, toRawRecipe, toRecipe, toRecipes } from './mappers';
import type { RawProfile, RawProfileBook, RawRecipeBook } from './raw';

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

  it('conserva lo aprendido con el uso y su origen (RF-29, CA-25.1)', () => {
    const base = profileBook.perfiles[0]!;
    const raw: RawProfile = {
      ...base,
      aprendido: {
        ...base.aprendido,
        sustituciones_rechazadas: [{ original: 'pan de molde', sustituto: 'pan sin gluten' }],
        pasos_dificiles: [{ receta_id: 'REC-001', paso: 3 }],
        lecturas_saltadas_seguidas: ['REC-001', 'REC-003'],
        origenes: [{ clave: 'skipsFullReading', evento: 'readingSkipped', fecha: '2026-10-05' }],
      },
      emocional: { ...base.emocional, ultima_emocion: { emocion: 'nervous', fecha: '2026-10-05' } },
    };
    expect(toRawProfile(toProfile(raw))).toEqual(raw);
  });

  it('conserva el alias, el origen de la emoción y el detalle del origen (RNF-11, RF-42)', () => {
    const base = profileBook.perfiles[1]!;
    const raw: RawProfile = {
      ...base,
      aprendido: {
        ...base.aprendido,
        origenes: [
          {
            clave: 'lastFeeling',
            evento: 'stepRepeated',
            fecha: '2026-11-16',
            detalle: 'repetiste el paso 4 tres veces',
          },
        ],
      },
      emocional: {
        ...base.emocional,
        ultima_emocion: {
          emocion: 'confused',
          fecha: '2026-11-16',
          origen: 'inferida',
          fecha_hora: '2026-11-16T15:30:00.000Z',
        },
      },
      comunidad: { alias: 'CocineroDelSur' },
    };
    const profile = toProfile(raw);
    expect(profile.community).toEqual({ alias: 'CocineroDelSur' });
    expect(profile.emotional.lastFeeling).toEqual({
      feeling: 'confused',
      date: '2026-11-16',
      source: 'inferred',
      at: '2026-11-16T15:30:00.000Z',
    });
    expect(profile.learned.origins?.[0]?.detail).toBe('repetiste el paso 4 tres veces');
    expect(toRawProfile(profile)).toEqual(raw);
  });

  it('no agrega los campos opcionales nuevos si el perfil no los tiene (RNF-11)', () => {
    const base = profileBook.perfiles[0]!;
    const raw: RawProfile = {
      ...base,
      aprendido: {
        ...base.aprendido,
        origenes: [{ clave: 'lastFeeling', evento: 'feelingDeclared', fecha: '2026-10-05' }],
      },
      emocional: { ...base.emocional, ultima_emocion: { emocion: 'nervous', fecha: '2026-10-05' } },
    };
    const profile = toProfile(raw);
    expect(profile.community).toBeUndefined();
    expect(Object.keys(profile.emotional.lastFeeling!)).toEqual(['feeling', 'date']);
    expect(Object.keys(profile.learned.origins![0]!)).toEqual(['key', 'event', 'date']);

    const exported = toRawProfile(profile);
    expect(exported).not.toHaveProperty('comunidad');
    expect(Object.keys(exported.emocional.ultima_emocion!)).toEqual(['emocion', 'fecha']);
    expect(Object.keys(exported.aprendido.origenes![0]!)).toEqual(['clave', 'evento', 'fecha']);
  });
});
