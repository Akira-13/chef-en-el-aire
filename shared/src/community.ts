// Comunidad: espacio compartido asíncrono para publicar recetas adaptadas, comentarlas y
// compartir logros (RF-33 a RF-37). No hay tiempo real: el cliente consulta cada pocos
// segundos y reenvía lo pendiente al reconectar (RNF-09).

import type { RecipeChange } from './assistant';
import type { Recipe } from './types/recipe';

export const COMMUNITY_ROUTES = {
  posts: '/api/community/posts',
  post: (postId: string) => `/api/community/posts/${encodeURIComponent(postId)}`,
  comments: (postId: string) => `/api/community/posts/${encodeURIComponent(postId)}/comments`,
  applause: (postId: string) => `/api/community/posts/${encodeURIComponent(postId)}/applause`,
} as const;

export const COMMUNITY_LIMITS = {
  aliasMaxLength: 30,
  textMaxLength: 500,
  feedSize: 50,
  pollIntervalMs: 3000,
} as const;

export const COMMUNITY_UNAVAILABLE_MESSAGE =
  'La Comunidad no está disponible ahora. Lo que publiques se enviará al volver la conexión.';

export type CommunityPostKind = 'recipe' | 'achievement';

/** Cambio publicado; `reason` solo viaja si la persona eligió "mostrar motivos" (RF-34). */
export interface CommunityChange {
  kind: RecipeChange['kind'];
  before: string;
  after: string;
  reason?: string;
}

export interface CommunityComment {
  id: string;
  alias: string;
  text: string;
  /** Fecha ISO asignada por el servidor. */
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  kind: CommunityPostKind;
  alias: string;
  recipeId: string;
  recipeName: string;
  /** Fecha ISO asignada por el servidor. */
  createdAt: string;
  /** Receta adaptada completa (solo `recipe`). Quien la abre la valida con su perfil (RF-35). */
  recipe?: Recipe;
  changes?: CommunityChange[];
  /** Valoración del logro (solo `achievement`). */
  rating?: 'up' | 'down';
  message?: string;
  applause: number;
  comments: CommunityComment[];
}

/**
 * `clientId` se genera una vez por publicación: si la cola sin conexión la reenvía, el servidor
 * devuelve la existente en vez de duplicarla (RNF-09). `deviceKey` es un token aleatorio del
 * dispositivo que permite borrar lo propio; el servidor nunca lo devuelve.
 */
export interface NewCommunityPost {
  clientId: string;
  deviceKey: string;
  kind: CommunityPostKind;
  alias: string;
  recipeId: string;
  recipeName: string;
  recipe?: Recipe;
  changes?: CommunityChange[];
  rating?: 'up' | 'down';
  message?: string;
}

export interface NewCommunityComment {
  clientId: string;
  deviceKey: string;
  alias: string;
  text: string;
}

export interface CommunityFeed {
  /** Más recientes primero; como máximo `COMMUNITY_LIMITS.feedSize`. */
  posts: CommunityPost[];
  /** Hora del servidor, para medir el retraso sin depender del reloj del teléfono. */
  serverTime: string;
}

export interface CommunityUnavailable {
  status: 'unavailable';
  message: string;
}
