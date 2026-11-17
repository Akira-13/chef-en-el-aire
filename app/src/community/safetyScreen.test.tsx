// RF-35 de punta a punta: la receta publicada se abre como adaptada y la pantalla de la receta
// bloquea "Empezar a cocinar" hasta confirmar si choca con el perfil de quien la abre.

import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import { toRecipes, type RawRecipeBook, type Recipe } from '@chef/shared';
import { clearAdaptedRecipe, setAdaptedRecipe } from '../core/recipes';
import { profileService } from '../core/services';
import { RecipeScreen } from '../screens/RecipeScreen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
let container: HTMLElement;
let root: Root;

// Receta publicada sin etiquetas de alérgenos: el validador tiene que encontrarlos por texto.
function publishedWithoutTags(recipeId: string): Recipe {
  const recipe = JSON.parse(JSON.stringify(recipes.find((r) => r.id === recipeId)!)) as Recipe;
  return {
    ...recipe,
    allergens: [],
    ingredients: recipe.ingredients.map((i) => ({ ...i, allergens: [] })),
  };
}

async function open(recipeId: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/receta/${recipeId}`]}>
        <Routes>
          <Route path="/receta/:recipeId" element={<RecipeScreen />} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

const buttonTexts = () => [...container.querySelectorAll('button')].map((b) => b.textContent);

beforeEach(async () => {
  // La receta llega solo como adaptada; el recetario del servidor no hace falta.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]', { status: 200 })),
  );
  await profileService.ready;
  await profileService.reset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  clearAdaptedRecipe('REC-001');
  vi.unstubAllGlobals();
});

describe('abrir una receta publicada', () => {
  it('con Rosa advierte la leche y bloquea hasta confirmar (RF-35, CA-28.1)', async () => {
    await profileService.selectProfile('USR-001');
    setAdaptedRecipe(publishedWithoutTags('REC-001'));
    await open('REC-001');
    expect(container.textContent).toContain('Receta adaptada');
    const warning = container.querySelector('[aria-labelledby="allergen-title"]');
    expect(warning?.textContent).toMatch(/leche/i);
    expect(warning?.textContent).toContain('esposo');
    expect(buttonTexts()).toContain('Confirmo, cocinar igual');
    expect(buttonTexts().some((t) => t?.includes('Empezar a cocinar'))).toBe(false);
  });

  it('con Javier la misma receta no bloquea (RF-35)', async () => {
    await profileService.selectProfile('USR-004');
    setAdaptedRecipe(publishedWithoutTags('REC-001'));
    await open('REC-001');
    expect(container.querySelector('[aria-labelledby="allergen-title"]')).toBeNull();
    expect(buttonTexts()).not.toContain('Confirmo, cocinar igual');
    expect(buttonTexts().some((t) => t?.includes('Empezar a cocinar'))).toBe(true);
  });
});
