import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@chef/shared';

const adapted = { id: 'REC-008', name: 'Ocopa sin maní' } as Recipe;
const STORAGE_KEY = 'chef.adaptedRecipes';

describe('receta adaptada', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('sobrevive a una recarga para no volver a la original en silencio (RF-07, RF-44)', async () => {
    const { setAdaptedRecipe } = await import('./recipes');
    setAdaptedRecipe(adapted);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Ocopa sin maní');
  });

  it('se puede descartar para volver a la original (CA-05.2)', async () => {
    const { clearAdaptedRecipe, setAdaptedRecipe } = await import('./recipes');
    setAdaptedRecipe(adapted);
    clearAdaptedRecipe(adapted.id);
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('Ocopa sin maní');
  });
});
