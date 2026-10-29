// Acceso al recetario desde la interfaz. Las recetas vienen de la API ya convertidas al
// tipo Recipe; se piden una sola vez por sesión. Si el usuario eligió una versión adaptada
// (por el asistente o por una sustitución), `useRecipe` la devuelve en lugar de la original,
// que se conserva intacta (RF-06, CA-05.2).

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { Recipe } from '@chef/shared';

export type RecipesState =
  | { status: 'loading'; recipes: Recipe[] }
  | { status: 'ready'; recipes: Recipe[] }
  | { status: 'error'; recipes: Recipe[]; error: string };

let request: Promise<Recipe[]> | null = null;

export function fetchRecipes(): Promise<Recipe[]> {
  request ??= fetch('/api/recipes').then(async (res) => {
    if (!res.ok) throw new Error(`Error ${res.status} al cargar las recetas`);
    return (await res.json()) as Recipe[];
  });
  request.catch(() => {
    // Permite reintentar en el próximo montaje.
    request = null;
  });
  return request;
}

export function useRecipes(): RecipesState {
  const [state, setState] = useState<RecipesState>({ status: 'loading', recipes: [] });
  useEffect(() => {
    let active = true;
    fetchRecipes()
      .then((recipes) => active && setState({ status: 'ready', recipes }))
      .catch(
        (error: unknown) =>
          active && setState({ status: 'error', recipes: [], error: String(error) }),
      );
    return () => {
      active = false;
    };
  }, []);
  return state;
}

// Versiones adaptadas elegidas por el usuario, por id de receta.
const useAdaptedRecipes = create<Record<string, Recipe>>(() => ({}));

/** Usa `recipe` en lugar de la original con el mismo id hasta que se descarte. */
export function setAdaptedRecipe(recipe: Recipe): void {
  useAdaptedRecipes.setState({ [recipe.id]: recipe });
}

/** Vuelve a la receta original (CA-05.2). */
export function clearAdaptedRecipe(recipeId: string): void {
  useAdaptedRecipes.setState((adapted) => {
    const next = { ...adapted };
    delete next[recipeId];
    return next;
  }, true);
}

export function useRecipe(id: string | undefined): {
  status: RecipesState['status'];
  recipe: Recipe | undefined;
  /** Receta tal como está en el recetario, aunque haya una versión adaptada. */
  original: Recipe | undefined;
  isAdapted: boolean;
} {
  const state = useRecipes();
  const adapted = useAdaptedRecipes((all) => (id ? all[id] : undefined));
  const original = state.recipes.find((recipe) => recipe.id === id);
  return {
    status: state.status,
    recipe: adapted ?? original,
    original,
    isAdapted: adapted !== undefined,
  };
}
