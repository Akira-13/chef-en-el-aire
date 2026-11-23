// Selector de porciones (RF-05, CA-04.2). Escala siempre desde la base, no desde la receta ya
// escalada, para que 4 → 2 → 4 vuelva exactamente a las cantidades originales. La base se
// guarda en el dispositivo por id de receta (RF-44): sin conexión y tras recargar sigue igual.
// La lógica de decisión es pura; el hook solo conecta el store con `core/recipes`.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { scaleRecipe, type Recipe } from '@chef/shared';
import { clearAdaptedRecipe, setAdaptedRecipe } from '../core/recipes';

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 12;

/** Lleva un número pedido por voz, toque o teclado al rango permitido. */
export function clampServings(value: number): number {
  if (!Number.isFinite(value)) return MIN_SERVINGS;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(value)));
}

/** Escalado en curso de una receta: la base contra la que se escala y lo último que se mostró. */
export interface ServingsBase {
  /** Receta de partida: la original, o la adaptada vigente antes del primer escalado. */
  base: Recipe;
  /** true si la base era la original del recetario y no una adaptación. */
  fromOriginal: boolean;
  /** Copia serializada de lo último guardado con setAdaptedRecipe, para detectar cambios ajenos. */
  scaledJson: string;
}

export type ServingsAction =
  /** Vuelve a las porciones de la base: se retira el escalado guardado. */
  | { kind: 'restoreBase'; base: Recipe; fromOriginal: boolean }
  /** Muestra la receta escalada y recuerda la base. */
  | { kind: 'scale'; scaled: Recipe; entry: ServingsBase };

/**
 * El escalado guardado solo vale si lo que se muestra sigue siendo lo que se escaló. Si llegó
 * una adaptación nueva (LLM, Comunidad, sustitución), la base guardada se descarta (CA-04.2).
 */
export function activeScaling(
  entry: ServingsBase | undefined,
  shown: Recipe,
): ServingsBase | undefined {
  return entry && entry.scaledJson === JSON.stringify(shown) ? entry : undefined;
}

/** Decide qué guardar y mostrar al pedir `requested` porciones sobre la receta mostrada. */
export function planServingsChange(
  entry: ServingsBase | undefined,
  shown: Recipe,
  shownIsAdapted: boolean,
  requested: number,
): ServingsAction {
  const active = activeScaling(entry, shown);
  const base = active?.base ?? shown;
  const fromOriginal = active ? active.fromOriginal : !shownIsAdapted;
  const servings = clampServings(requested);
  if (servings === base.servings) return { kind: 'restoreBase', base, fromOriginal };
  const scaled = scaleRecipe(base, servings);
  return {
    kind: 'scale',
    scaled,
    entry: { base, fromOriginal, scaledJson: JSON.stringify(scaled) },
  };
}

// Escalados en curso, por id de receta.
const useServingBases = create<Record<string, ServingsBase>>()(
  persist(() => ({}), {
    name: 'chef.servingBases',
    storage: createJSONStorage(() => localStorage),
  }),
);

function storeEntry(recipeId: string, entry: ServingsBase | undefined): void {
  useServingBases.setState((all) => {
    const next = { ...all };
    if (entry) next[recipeId] = entry;
    else delete next[recipeId];
    return next;
  }, true);
}

/**
 * Porciones de la receta abierta. `setServings` devuelve el número aplicado, ya acotado.
 * `scaledOnly` indica que la única diferencia con la base son las porciones (CA-04.2).
 */
export function useServings(
  recipeId: string | undefined,
  recipe: Recipe | undefined,
  isAdapted: boolean,
): {
  servings: number | undefined;
  scaledOnly: boolean;
  setServings: (requested: number) => number | undefined;
} {
  const entry = useServingBases((all) => (recipeId ? all[recipeId] : undefined));
  const scaledOnly = recipe !== undefined && activeScaling(entry, recipe) !== undefined;

  const setServings = (requested: number): number | undefined => {
    if (!recipeId || !recipe) return undefined;
    // Se lee del store y no del render: dos cambios seguidos no deben usar una base vieja.
    const current = useServingBases.getState()[recipeId];
    const action = planServingsChange(current, recipe, isAdapted, requested);
    if (action.kind === 'restoreBase') {
      if (action.fromOriginal) clearAdaptedRecipe(recipeId);
      else setAdaptedRecipe(action.base);
      storeEntry(recipeId, undefined);
      return action.base.servings;
    }
    setAdaptedRecipe(action.scaled);
    storeEntry(recipeId, action.entry);
    return action.scaled.servings;
  };

  return { servings: recipe?.servings, scaledOnly, setServings };
}
