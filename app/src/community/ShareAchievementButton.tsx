// Compartir en la Comunidad el plato terminado (RF-37). Por ahora no muestra nada: la firma ya
// es la definitiva para que la celebración pueda montarlo.

import type { ReactElement } from 'react';

export interface ShareAchievementButtonProps {
  recipeId: string;
  recipeName: string;
  rating?: 'up' | 'down';
}

export function ShareAchievementButton(_props: ShareAchievementButtonProps): ReactElement | null {
  return null;
}
