import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COMMUNITY_ROUTES,
  type CommunityComment,
  type CommunityFeed,
  type CommunityPost,
  type Recipe,
} from '@chef/shared';
import { createApp } from '../app';
import { getRecipe } from '../data/recipes';
import { createCommunityStore } from './store';

let dir: string;
let server: Server;
let baseUrl: string;

// Un archivo y un servidor por prueba: ninguna depende del estado de otra.
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'chef-community-routes-'));
  const communityStore = createCommunityStore({ file: join(dir, 'community.json') });
  server = createApp({ communityStore }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const DEVICE = 'device-key-author';

const achievement = (overrides: Record<string, unknown> = {}) => ({
  clientId: 'c-1',
  deviceKey: DEVICE,
  kind: 'achievement',
  alias: 'Dieguito',
  recipeId: 'REC-001',
  recipeName: 'Ají de gallina',
  rating: 'up',
  ...overrides,
});

const recipePost = (recipe: unknown = getRecipe('REC-008'), overrides = {}) => ({
  clientId: 'c-recipe',
  deviceKey: DEVICE,
  kind: 'recipe',
  alias: 'Dieguito',
  recipeId: 'REC-008',
  recipeName: 'Ocopa arequipeña',
  recipe,
  changes: [{ kind: 'ingredient', before: 'Maní', after: 'Semillas de zapallo' }],
  ...overrides,
});

function send(method: string, path: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

async function publish(body: unknown) {
  const res = await send('POST', COMMUNITY_ROUTES.posts, body);
  return { res, post: (await res.json()) as CommunityPost };
}

const feed = async () =>
  (await (await send('GET', COMMUNITY_ROUTES.posts)).json()) as CommunityFeed;

describe('API de la Comunidad', () => {
  it('la lista trae la semilla y la hora del servidor', async () => {
    const res = await send('GET', COMMUNITY_ROUTES.posts);
    const body = (await res.json()) as CommunityFeed;
    expect(res.status).toBe(200);
    expect(body.posts).toHaveLength(2);
    expect(Date.parse(body.serverTime)).toBeGreaterThan(0);
  });

  it('publica y lista con la más reciente primero (CA-27.3)', async () => {
    const first = await publish(achievement({ clientId: 'a', recipeName: 'Primera' }));
    const second = await publish(achievement({ clientId: 'b', recipeName: 'Segunda' }));
    expect(first.res.status).toBe(201);
    expect(second.res.status).toBe(201);
    const { posts } = await feed();
    expect(posts.slice(0, 2).map((p) => p.recipeName)).toEqual(['Segunda', 'Primera']);
    expect(posts[0]).toMatchObject({ alias: 'Dieguito', applause: 0, comments: [] });
  });

  it('el servidor asigna createdAt aunque el cliente mande otro', async () => {
    const { post } = await publish(achievement({ createdAt: '1999-01-01T00:00:00.000Z' }));
    expect(post.createdAt.startsWith('1999')).toBe(false);
  });

  it('reenviar con el mismo clientId devuelve 200 con lo creado y no duplica (CA-28.3)', async () => {
    const first = await publish(achievement());
    const second = await publish(achievement());
    expect(first.res.status).toBe(201);
    expect(second.res.status).toBe(200);
    expect(second.post.id).toBe(first.post.id);
    const { posts } = await feed();
    expect(posts.filter((p) => p.alias === 'Dieguito')).toHaveLength(1);
  });

  it('publica una receta adaptada completa', async () => {
    const { res, post } = await publish(recipePost());
    expect(res.status).toBe(201);
    expect(post.recipe?.id).toBe('REC-008');
    expect(post.changes).toHaveLength(1);
  });

  it('comenta una publicación y el mismo clientId no duplica (CA-28.2, CA-28.3)', async () => {
    const { post } = await publish(achievement());
    const comment = { clientId: 'k-1', deviceKey: 'otro-dispositivo', alias: 'Rosa', text: 'Rico' };
    const first = await send('POST', COMMUNITY_ROUTES.comments(post.id), comment);
    const second = await send('POST', COMMUNITY_ROUTES.comments(post.id), comment);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const created = (await first.json()) as CommunityComment;
    expect(((await second.json()) as CommunityComment).id).toBe(created.id);
    const stored = (await feed()).posts.find((p) => p.id === post.id);
    expect(stored?.comments).toHaveLength(1);
    expect(stored?.comments[0]?.text).toBe('Rico');
  });

  it('comentar una publicación inexistente da 404 y un comentario vacío 400', async () => {
    const comment = { clientId: 'k', deviceKey: 'otro-dispositivo', alias: 'Rosa', text: 'Hola' };
    const missing = await send('POST', COMMUNITY_ROUTES.comments('PUB-9999'), comment);
    expect(missing.status).toBe(404);
    const { post } = await publish(achievement());
    const empty = await send('POST', COMMUNITY_ROUTES.comments(post.id), { ...comment, text: ' ' });
    expect(empty.status).toBe(400);
  });

  it('aplaudir dos veces desde el mismo dispositivo cuenta 1 (CA-29.2)', async () => {
    const { post } = await publish(achievement());
    const url = COMMUNITY_ROUTES.applause(post.id);
    const first = await send('POST', url, { deviceKey: 'device-applause-1' });
    const second = await send('POST', url, { deviceKey: 'device-applause-1' });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ applause: 1 });
    expect(await second.json()).toEqual({ applause: 1 });
    const other = await send('POST', url, { deviceKey: 'device-applause-2' });
    expect(await other.json()).toEqual({ applause: 2 });
    expect(
      (
        await send('POST', COMMUNITY_ROUTES.applause('PUB-9999'), {
          deviceKey: 'device-applause-1',
        })
      ).status,
    ).toBe(404);
  });

  it('borrar con otro deviceKey da 403 y con el del autor da 204', async () => {
    const { post } = await publish(achievement());
    const url = COMMUNITY_ROUTES.post(post.id);
    expect((await send('DELETE', url, { deviceKey: 'device-intruder' })).status).toBe(403);
    expect((await feed()).posts.some((p) => p.id === post.id)).toBe(true);
    expect((await send('DELETE', url, { deviceKey: DEVICE })).status).toBe(204);
    expect((await feed()).posts.some((p) => p.id === post.id)).toBe(false);
    expect((await send('DELETE', url, { deviceKey: DEVICE })).status).toBe(404);
  });

  it('borrar sin deviceKey da 400', async () => {
    const { post } = await publish(achievement());
    const res = await fetch(`${baseUrl}${COMMUNITY_ROUTES.post(post.id)}`, { method: 'DELETE' });
    expect(res.status).toBe(400);
  });

  it('un alias de 31 caracteres da 400 con un mensaje en español', async () => {
    const res = await send('POST', COMMUNITY_ROUTES.posts, achievement({ alias: 'a'.repeat(31) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'El alias admite hasta 30 caracteres.' });
  });

  it('rechaza una receta mal formada, con otro id o fuera del recetario (400)', async () => {
    const recipe = getRecipe('REC-008') as Recipe;
    const malformed = await send(
      'POST',
      COMMUNITY_ROUTES.posts,
      recipePost({ ...recipe, ingredients: 'maní' }),
    );
    const mismatch = await send(
      'POST',
      COMMUNITY_ROUTES.posts,
      recipePost(recipe, { recipeId: 'REC-001' }),
    );
    const unknown = await send(
      'POST',
      COMMUNITY_ROUTES.posts,
      recipePost({ ...recipe, id: 'REC-999' }, { recipeId: 'REC-999' }),
    );
    for (const res of [malformed, mismatch, unknown]) {
      expect(res.status).toBe(400);
      expect(typeof ((await res.json()) as { error: string }).error).toBe('string');
    }
    expect((await feed()).posts).toHaveLength(2);
  });

  it('un JSON roto da 400 con { error } y sin trazas internas', async () => {
    const res = await fetch(`${baseUrl}${COMMUNITY_ROUTES.posts}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ no es json',
    });
    const text = await res.text();
    expect(res.status).toBe(400);
    expect(JSON.parse(text)).toEqual({ error: expect.any(String) });
    expect(text).not.toContain('at ');
    expect(text).not.toContain('node_modules');
  });

  it('ninguna respuesta contiene el deviceKey ni el clientId', async () => {
    const secret = 'device-key-super-secreto';
    const created = await send(
      'POST',
      COMMUNITY_ROUTES.posts,
      achievement({ deviceKey: secret, clientId: 'cid-secreto' }),
    );
    const repeated = await send(
      'POST',
      COMMUNITY_ROUTES.posts,
      achievement({ deviceKey: secret, clientId: 'cid-secreto' }),
    );
    const { id } = (await created.clone().json()) as CommunityPost;
    const commented = await send('POST', COMMUNITY_ROUTES.comments(id), {
      clientId: 'cid-comentario',
      deviceKey: secret,
      alias: 'Rosa',
      text: 'Hola',
    });
    const applauded = await send('POST', COMMUNITY_ROUTES.applause(id), { deviceKey: secret });
    const list = await send('GET', COMMUNITY_ROUTES.posts);
    for (const res of [created, repeated, commented, applauded, list]) {
      const text = await res.text();
      expect(text).not.toContain(secret);
      expect(text).not.toContain('deviceKey');
      expect(text).not.toContain('cid-');
    }
  });

  it('rechaza con 400 un mensaje o comentario con enlaces', async () => {
    const link = await send(
      'POST',
      COMMUNITY_ROUTES.posts,
      achievement({ message: 'http://x.io' }),
    );
    expect(link.status).toBe(400);
    expect(((await link.json()) as { error: string }).error).toMatch(/enlaces/i);
    const { post } = await publish(achievement());
    const comment = { clientId: 'k-1', deviceKey: 'otro-dispositivo', alias: 'Rosa' };
    const bad = await send('POST', COMMUNITY_ROUTES.comments(post.id), {
      ...comment,
      text: 'mira HTTPS://x.io',
    });
    expect(bad.status).toBe(400);
  });

  it('responde 429 en español a la publicación 11 de la hora, sin afectar a las ya enviadas', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect(
        (await send('POST', COMMUNITY_ROUTES.posts, achievement({ clientId: `c-${i}` }))).status,
      ).toBe(201);
    }
    const limited = await send('POST', COMMUNITY_ROUTES.posts, achievement({ clientId: 'c-11' }));
    expect(limited.status).toBe(429);
    expect(((await limited.json()) as { error: string }).error).toMatch(/publicaciones/i);
    const repeated = await send('POST', COMMUNITY_ROUTES.posts, achievement({ clientId: 'c-0' }));
    expect(repeated.status).toBe(200);
  });

  it('si no se puede guardar responde 503 sin detalles internos', async () => {
    // La carpeta del archivo es en realidad un archivo: crear el JSON es imposible.
    writeFileSync(join(dir, 'bloqueado'), '');
    const blocked = createCommunityStore({ file: join(dir, 'bloqueado', 'community.json') });
    const other = createApp({ communityStore: blocked }).listen(0);
    await new Promise<void>((resolve) => other.once('listening', resolve));
    try {
      const url = `http://localhost:${(other.address() as AddressInfo).port}${COMMUNITY_ROUTES.posts}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(achievement()),
      });
      const text = await res.text();
      expect(res.status).toBe(503);
      expect(text).not.toContain('ENOTDIR');
    } finally {
      other.close();
    }
  });
});
