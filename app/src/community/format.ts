// Textos de la Comunidad: fechas en dd/mm/aaaa, resumen hablado de una publicación y alias
// sugerido. Puro, para probarlo sin pantalla.

import type { CommunityPost } from '@chef/shared';

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha ISO a dd/mm/aaaa en la hora del teléfono. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function kindLabel(post: Pick<CommunityPost, 'kind'>): string {
  return post.kind === 'recipe' ? 'Receta adaptada' : 'Plato terminado';
}

export function applauseLabel(count: number): string {
  return count === 1 ? '1 aplauso' : `${count} aplausos`;
}

export function commentsLabel(count: number): string {
  return count === 1 ? '1 comentario' : `${count} comentarios`;
}

/** Lo que se lee al moverse entre publicaciones. */
export function postHeadline(post: CommunityPost): string {
  return `${post.recipeName}, ${kindLabel(post).toLowerCase()} de ${post.alias}`;
}

/**
 * Lo que se lee con "dónde estoy": la publicación y sus últimos 3 comentarios (RF-36). Si se
 * pasa `safety`, la revisión de la receta con el perfil se lee justo después del título.
 */
export function describePost(
  post: CommunityPost,
  position: number,
  total: number,
  safety?: string,
): string {
  const parts = [`Publicación ${position} de ${total}: ${postHeadline(post)}.`];
  if (safety) parts.push(`${safety}.`);
  if (post.kind === 'achievement' && post.rating) {
    parts.push(post.rating === 'up' ? 'Le gustó.' : 'No le gustó.');
  }
  if (post.changes?.length) parts.push(`Tiene ${post.changes.length} cambios.`);
  parts.push(`${applauseLabel(post.applause)}.`);
  const last = post.comments.slice(-3);
  if (last.length === 0) parts.push('Sin comentarios.');
  else
    parts.push(`Últimos comentarios: ${last.map((c) => `${c.alias} dijo: ${c.text}`).join('. ')}.`);
  return parts.join(' ');
}

/** Alias sugerido cuando la persona aún no eligió uno; nunca usa su nombre. */
export function suggestAlias(random: () => number = Math.random): string {
  return `Sazón ${1000 + Math.floor(random() * 9000)}`;
}
