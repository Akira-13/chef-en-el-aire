import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COMMUNITY_ROUTES,
  COMMUNITY_UNAVAILABLE_MESSAGE,
  type NewCommunityPost,
} from '@chef/shared';
import { communityClient } from './client';

const unavailable = { status: 'unavailable', message: COMMUNITY_UNAVAILABLE_MESSAGE };

function respond(status: number, body?: unknown) {
  const fetchMock = vi.fn(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const post: NewCommunityPost = {
  clientId: 'c1',
  deviceKey: 'dev-1',
  kind: 'achievement',
  alias: 'Sazón 1234',
  recipeId: 'REC-001',
  recipeName: 'Ají de gallina',
  rating: 'up',
};

afterEach(() => vi.unstubAllGlobals());

describe('cliente de la Comunidad', () => {
  it('trae la lista de la ruta del contrato (RF-33)', async () => {
    const fetchMock = respond(200, { posts: [], serverTime: '2026-11-21T10:00:00.000Z' });
    expect(await communityClient.feed()).toEqual({
      posts: [],
      serverTime: '2026-11-21T10:00:00.000Z',
    });
    expect(fetchMock).toHaveBeenCalledWith(COMMUNITY_ROUTES.posts, { method: 'GET' });
  });

  it('nunca lanza error: sin red o con el servidor caído está "no disponible" (RF-33)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await communityClient.feed()).toEqual(unavailable);
    expect(await communityClient.publish(post)).toEqual(unavailable);

    respond(500, { error: 'Falla' });
    expect(await communityClient.feed()).toEqual(unavailable);
    expect(await communityClient.comment('PUB-0001', { ...post, text: 'hola' })).toEqual(
      unavailable,
    );

    respond(200, { algo: 'raro' });
    expect(await communityClient.feed()).toEqual(unavailable);
  });

  it('distingue lo rechazado (400) y lo que ya no existe (404) (RNF-09)', async () => {
    respond(400, { error: 'El alias es muy largo.' });
    expect(await communityClient.publish(post)).toEqual({
      status: 'rejected',
      message: 'El alias es muy largo.',
    });
    respond(404, { error: 'No existe.' });
    expect(await communityClient.applaud('PUB-9', 'dev-1')).toMatchObject({ status: 'notFound' });
  });

  it('envía el cuerpo como JSON a la ruta de cada publicación (RF-36)', async () => {
    const fetchMock = respond(200, { applause: 3 });
    expect(await communityClient.applaud('PUB 1', 'dev-1')).toEqual({ applause: 3 });
    expect(fetchMock).toHaveBeenCalledWith(COMMUNITY_ROUTES.applause('PUB 1'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceKey: 'dev-1' }),
    });
  });

  it('borrar devuelve "deleted" con 204 o si ya no existía, y rechaza si no es propia', async () => {
    const fetchMock = respond(204);
    expect(await communityClient.remove('PUB-0001', 'dev-1')).toEqual({ status: 'deleted' });
    expect(fetchMock).toHaveBeenCalledWith(
      COMMUNITY_ROUTES.post('PUB-0001'),
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ deviceKey: 'dev-1' }) }),
    );
    respond(404, { error: 'No existe.' });
    expect(await communityClient.remove('PUB-0001', 'dev-1')).toEqual({ status: 'deleted' });
    respond(403, { error: 'No es tuya.' });
    expect(await communityClient.remove('PUB-0001', 'dev-1')).toMatchObject({ status: 'rejected' });
  });
});
