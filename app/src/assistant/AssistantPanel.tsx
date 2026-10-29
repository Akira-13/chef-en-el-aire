// Panel del asistente dentro del modo cocina: dudas con el contexto del paso actual (RF-08) y
// explicación ampliada del paso (RF-13).

import type { Recipe, Step } from '@chef/shared';

export interface AssistantPanelProps {
  recipe: Recipe;
  step: Step;
}

export function AssistantPanel(_props: AssistantPanelProps) {
  return null;
}
