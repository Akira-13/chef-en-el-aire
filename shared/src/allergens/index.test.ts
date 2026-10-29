import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import { toProfile, toRecipes } from '../data/mappers';
import type { RawProfileBook, RawRecipeBook } from '../data/raw';
import { findAllergens } from './index';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const profiles = (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile);

function byId<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`No existe ${id}`);
  return item;
}

describe('findAllergens', () => {
  it('detecta el maní de la ocopa para Diego (CA-06.1)', () => {
    const diego = byId(profiles, 'USR-002');
    const findings = findAllergens(byId(recipes, 'REC-008'), diego.explicit);
    expect(findings.map((f) => f.allergen)).toContain('mani');
    expect(findings.every((f) => f.source === 'profile')).toBe(true);
  });

  it('detecta la restricción de un comensal (CA-23.1)', () => {
    const rosa = byId(profiles, 'USR-001');
    const findings = findAllergens(byId(recipes, 'REC-001'), rosa.explicit);
    expect(findings.some((f) => f.source === 'diner' && f.allergen === 'leche')).toBe(true);
  });

  it('no reporta nada si la receta no tiene alérgenos del perfil', () => {
    const diego = byId(profiles, 'USR-002');
    expect(findAllergens(byId(recipes, 'REC-006'), diego.explicit)).toEqual([]);
  });
});
