// Navegación entre pasos del modo cocina: siguiente, anterior, repetir y pausa (RF-12).
// El paso actual se guarda en la sesión de cocina para retomarlo tras una recarga (RF-44).

import { useCallback, useEffect, useState } from 'react';
import type { Recipe, Step } from '@chef/shared';
import { savedStepIndex, saveCookingStep } from './session';

export interface StepNavigation {
  /** Índice del paso actual, empieza en 0. */
  index: number;
  step: Step | undefined;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  paused: boolean;
  /** Aumenta cada vez que se pide repetir, para volver a anunciar el mismo paso. */
  repeatCount: number;
  next(): void;
  /** Devuelve false si ya estaba en el primer paso. */
  previous(): boolean;
  repeat(): void;
  setPaused(paused: boolean): void;
}

export function useStepNavigation(
  recipeId: string | undefined,
  recipe: Recipe | undefined,
  onFinish: () => void,
): StepNavigation {
  const [storedIndex, setIndex] = useState(() => savedStepIndex(recipeId));
  const [paused, setPaused] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const total = recipe?.steps.length ?? 0;
  // Una receta adaptada puede tener menos pasos que los guardados en la sesión.
  const index = total > 0 ? Math.min(storedIndex, total - 1) : storedIndex;
  const isFirst = index === 0;
  const isLast = total > 0 && index === total - 1;

  useEffect(() => {
    if (recipeId && total > 0) saveCookingStep(recipeId, index);
  }, [recipeId, total, index]);

  const next = useCallback(() => {
    setPaused(false);
    if (isLast) onFinish();
    else setIndex(index + 1);
  }, [index, isLast, onFinish]);

  const previous = useCallback(() => {
    if (isFirst) return false;
    setPaused(false);
    setIndex(index - 1);
    return true;
  }, [index, isFirst]);

  const repeat = useCallback(() => setRepeatCount((count) => count + 1), []);

  return {
    index,
    step: recipe?.steps[index],
    total,
    isFirst,
    isLast,
    paused,
    repeatCount,
    next,
    previous,
    repeat,
    setPaused,
  };
}
