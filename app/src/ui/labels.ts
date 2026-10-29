// Textos e ilustraciones de la interfaz asociados a valores de los datos.

import type { Difficulty } from '@chef/shared';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  basico: 'fácil',
  intermedio: 'intermedio',
  avanzado: 'avanzado',
};

// Ilustración de cada plato (el prototipo usa emojis como ilustraciones).
const RECIPE_ART: Record<string, string> = {
  'REC-001': '🍲',
  'REC-002': '🥩',
  'REC-003': '🥔',
  'REC-004': '🍳',
  'REC-005': '🍝',
  'REC-006': '🥗',
  'REC-007': '🍚',
  'REC-008': '🌶️',
  'REC-009': '🐟',
  'REC-010': '🍛',
};

export function recipeArt(recipeId: string): string {
  return RECIPE_ART[recipeId] ?? '🍽️';
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
