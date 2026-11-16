// Publicar en la Comunidad una receta adaptada con sus cambios (RF-34). Por ahora no muestra
// nada: la firma ya es la definitiva para que el panel de adaptación pueda montarlo.

import type { ReactElement } from 'react';
import type { Recipe, RecipeChange } from '@chef/shared';

export interface PublishRecipeButtonProps {
  recipe: Recipe;
  changes: RecipeChange[];
}

export function PublishRecipeButton(_props: PublishRecipeButtonProps): ReactElement | null {
  return null;
}
