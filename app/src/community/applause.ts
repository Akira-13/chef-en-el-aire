// Aplausos nuevos en lo que publiqué (CA-29.2): "el autor ve el aplauso la próxima vez que entra
// a la Comunidad". Se compara el conteo de cada publicación propia con el último que vi, guardado
// en el dispositivo. Mi propio aplauso a mi publicación no cuenta. Puro, sin core/services.

import type { CommunityPost } from '@chef/shared';
import { applauseLabel } from './format';

/** Último conteo ajeno visto por publicación propia. */
export type SeenApplause = Record<string, number>;

export interface NewApplause {
  postId: string;
  recipeName: string;
  count: number;
}

/** Aplausos de otras personas: al conteo del servidor se le quita el mío, si lo di. */
function foreignApplause(post: CommunityPost, applauded: ReadonlySet<string>): number {
  return Math.max(0, post.applause - (applauded.has(post.id) ? 1 : 0));
}

/** Publicaciones propias con más aplausos ajenos que la última vez que entré. */
export function newApplause(
  posts: readonly CommunityPost[],
  own: ReadonlySet<string>,
  applauded: ReadonlySet<string>,
  seen: SeenApplause,
): NewApplause[] {
  return posts.flatMap((post) => {
    if (!own.has(post.id)) return [];
    const count = foreignApplause(post, applauded) - (seen[post.id] ?? 0);
    return count > 0 ? [{ postId: post.id, recipeName: post.recipeName, count }] : [];
  });
}

/** Conteos a guardar como vistos. Descarta las publicaciones que ya no existen. */
export function markApplauseSeen(
  posts: readonly CommunityPost[],
  own: ReadonlySet<string>,
  applauded: ReadonlySet<string>,
): SeenApplause {
  return Object.fromEntries(
    posts.filter((p) => own.has(p.id)).map((p) => [p.id, foreignApplause(p, applauded)]),
  );
}

/** Frase del aviso; sin aplausos nuevos no hay aviso. */
export function applauseNotice(items: readonly NewApplause[]): string | undefined {
  const [first] = items;
  if (!first) return undefined;
  const nuevo = (n: number) => `${applauseLabel(n)} ${n === 1 ? 'nuevo' : 'nuevos'}`;
  if (items.length === 1) {
    return `Tu publicación «${first.recipeName}» recibió ${nuevo(first.count)}.`;
  }
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return `Tus publicaciones recibieron ${nuevo(total)}.`;
}
