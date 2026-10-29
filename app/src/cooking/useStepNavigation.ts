// Navegación entre pasos del modo cocina: siguiente, anterior, repetir y pausa (RF-12).

import { useCallback, useState } from 'react';
import type { Recipe, Step } from '@chef/shared';

export interface StepNavigation {
  /** Índice del paso actual, empieza en 0. */
  index: number;
  step: Step | undefined;
  total: number;
  isLast: boolean;
  paused: boolean;
  /** Aumenta cada vez que se pide repetir, para volver a anunciar el mismo paso. */
  repeatCount: number;
  next(): void;
  previous(): void;
  repeat(): void;
  setPaused(paused: boolean): void;
}

export function useStepNavigation(
  recipe: Recipe | undefined,
  onFinish: () => void,
): StepNavigation {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const total = recipe?.steps.length ?? 0;
  const isLast = total > 0 && index === total - 1;

  const next = useCallback(() => {
    if (isLast) onFinish();
    else setIndex((i) => Math.min(i + 1, total - 1));
  }, [isLast, onFinish, total]);

  const previous = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const repeat = useCallback(() => setRepeatCount((n) => n + 1), []);

  return {
    index,
    step: recipe?.steps[index],
    total,
    isLast,
    paused,
    repeatCount,
    next,
    previous,
    repeat,
    setPaused,
  };
}
