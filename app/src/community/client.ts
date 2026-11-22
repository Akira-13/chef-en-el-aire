// Cliente REST de la Comunidad (RF-33 a RF-37). Igual que el del asistente, nunca lanza error:
// si la red o el servidor fallan devuelve "no disponible" y la pantalla sigue con lo último
// cargado. Distingue además lo que el servidor rechazó (cualquier 4xx salvo 408 y 429) y lo que
// ya no existe (404), porque la cola sin conexión descarta ambos y reintenta lo que no llegó:
// la red, el 408, el 429 y el 5xx (RNF-09).

import {
  COMMUNITY_ROUTES,
  COMMUNITY_UNAVAILABLE_MESSAGE,
  type CommunityComment,
  type CommunityFeed,
  type CommunityPost,
  type CommunityUnavailable,
  type NewCommunityComment,
  type NewCommunityPost,
} from '@chef/shared';

export interface CommunityRejected {
  status: 'rejected';
  message: string;
}

export interface CommunityNotFound {
  status: 'notFound';
  message: string;
}

export type CommunityFailure = CommunityUnavailable | CommunityRejected | CommunityNotFound;

const unavailable: CommunityUnavailable = {
  status: 'unavailable',
  message: COMMUNITY_UNAVAILABLE_MESSAGE,
};

/** True si la respuesta es una falla y no el dato pedido. */
export function isFailure<T extends object>(
  result: T | CommunityFailure,
): result is CommunityFailure {
  return (
    'status' in result &&
    (result.status === 'unavailable' ||
      result.status === 'rejected' ||
      result.status === 'notFound')
  );
}

function errorMessage(data: unknown, fallback: string): string {
  return data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
    ? data.error
    : fallback;
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<T | CommunityFailure> {
  try {
    const res = await fetch(url, {
      method,
      ...(body !== undefined && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
    if (res.status === 204) return {} as T;
    const data: unknown = await res.json().catch(() => null);
    if (res.ok && data && typeof data === 'object') return data as T;
    if (res.status === 404) {
      return { status: 'notFound', message: errorMessage(data, 'Ya no existe.') };
    }
    // Un 4xx es definitivo: reenviar lo mismo daría lo mismo. Solo 408 y 429 son pasajeros.
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
      return { status: 'rejected', message: errorMessage(data, 'La Comunidad no lo aceptó.') };
    }
    return unavailable;
  } catch {
    return unavailable;
  }
}

export const communityClient = {
  async feed(): Promise<CommunityFeed | CommunityUnavailable> {
    const result = await request<CommunityFeed>('GET', COMMUNITY_ROUTES.posts);
    // Sin la lista no hay nada que mostrar: cualquier falla equivale a no disponible.
    if (isFailure(result) || !Array.isArray(result.posts)) return unavailable;
    return result;
  },

  publish: (post: NewCommunityPost) => request<CommunityPost>('POST', COMMUNITY_ROUTES.posts, post),

  comment: (postId: string, comment: NewCommunityComment) =>
    request<CommunityComment>('POST', COMMUNITY_ROUTES.comments(postId), comment),

  applaud: (postId: string, deviceKey: string) =>
    request<{ applause: number }>('POST', COMMUNITY_ROUTES.applause(postId), { deviceKey }),

  /** Borra una publicación propia. Si ya no existe, se da por borrada. */
  async remove(
    postId: string,
    deviceKey: string,
  ): Promise<{ status: 'deleted' } | CommunityUnavailable | CommunityRejected> {
    const result = await request<object>('DELETE', COMMUNITY_ROUTES.post(postId), { deviceKey });
    if (!isFailure(result) || result.status === 'notFound') return { status: 'deleted' };
    return result;
  },
};
