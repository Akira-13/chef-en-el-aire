// Medición de RNF-09 en el cliente: cuánto tarda en verse una publicación o un comentario de otra
// persona. Solo cuenta lo que aparece con la pantalla abierta; lo propio y lo que ya estaba al
// abrir no se mide. El retraso usa la hora del servidor para no depender del reloj del teléfono.

import type { CommunityPost } from '@chef/shared';

export interface FeedItemRef {
  id: string;
  alias: string;
  createdAt: string;
}

/** Publicaciones y comentarios de la lista, en una sola secuencia. */
export function feedItems(posts: readonly CommunityPost[]): FeedItemRef[] {
  return posts.flatMap((post) => [
    { id: post.id, alias: post.alias, createdAt: post.createdAt },
    ...post.comments.map(({ id, alias, createdAt }) => ({ id, alias, createdAt })),
  ]);
}

/** Lo que no estaba en `seen` y no es propio. */
export function newForeignItems(
  posts: readonly CommunityPost[],
  seen: ReadonlySet<string>,
  isOwn: (item: FeedItemRef) => boolean,
): FeedItemRef[] {
  return feedItems(posts).filter((item) => !seen.has(item.id) && !isOwn(item));
}

/**
 * Milisegundos desde que el servidor creó el elemento hasta ahora, en la hora del servidor.
 * `offsetMs` es `serverTime - Date.now()` de la última respuesta. Nunca es negativo.
 */
export function visibleDelayMs(createdAt: string, offsetMs: number, now = Date.now()): number {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, now + offsetMs - created);
}
