import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COMMUNITY_LIMITS } from '@chef/shared';
import { createCommunityStore, type NewPostInput } from './store';

let dir: string;
let file: string;

// Un archivo temporal por prueba, para que ninguna dependa del estado de otra.
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chef-community-'));
  file = join(dir, 'community.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const DEVICE = 'device-key-author';

const post = (overrides: Partial<NewPostInput> = {}): NewPostInput => ({
  clientId: 'c-1',
  deviceKey: DEVICE,
  kind: 'achievement',
  alias: 'Dieguito',
  recipeId: 'REC-001',
  recipeName: 'Ají de gallina',
  rating: 'up',
  ...overrides,
});

describe('almacén de la Comunidad', () => {
  it('crea 2 publicaciones de demostración con alias ficticios si no hay archivo', () => {
    const store = createCommunityStore({ file });
    const { posts } = store.getFeed();
    expect(posts).toHaveLength(2);
    expect(posts.map((p) => p.id)).toEqual(['PUB-0002', 'PUB-0001']);
    expect(posts.every((p) => p.alias && p.recipeName)).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toBeTruthy();
  });

  it('publica y lista con la más reciente primero (CA-27.3)', async () => {
    const store = createCommunityStore({ file });
    await store.createPost(post({ clientId: 'a', recipeName: 'Primera' }));
    await store.createPost(post({ clientId: 'b', recipeName: 'Segunda' }));
    const { posts, serverTime } = store.getFeed();
    expect(posts[0]?.recipeName).toBe('Segunda');
    expect(posts[1]?.recipeName).toBe('Primera');
    expect(Date.parse(posts[0]!.createdAt)).toBeGreaterThan(0);
    expect(Date.parse(serverTime)).toBeGreaterThan(0);
  });

  it('el mismo clientId no duplica la publicación (CA-28.3)', async () => {
    const store = createCommunityStore({ file });
    const first = await store.createPost(post());
    const second = await store.createPost(post());
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.post.id).toBe(first.post.id);
    expect(store.getFeed().posts.filter((p) => p.alias === 'Dieguito')).toHaveLength(1);
  });

  it('comenta una publicación (CA-28.2) y el mismo clientId no duplica (CA-28.3)', async () => {
    const store = createCommunityStore({ file });
    const { post: created } = await store.createPost(post());
    const input = { clientId: 'k-1', deviceKey: 'otro', alias: 'Rosa', text: 'Quedó rico' };
    const first = await store.addComment(created.id, input);
    const second = await store.addComment(created.id, input);
    expect(first.status).toBe('created');
    expect(second.status).toBe('existing');
    const stored = store.getFeed().posts.find((p) => p.id === created.id);
    expect(stored?.comments).toHaveLength(1);
    expect(stored?.comments[0]).toMatchObject({
      id: 'COM-0002',
      alias: 'Rosa',
      text: 'Quedó rico',
    });
  });

  it('comentar una publicación inexistente devuelve not-found', async () => {
    const store = createCommunityStore({ file });
    const result = await store.addComment('PUB-9999', {
      clientId: 'k',
      deviceKey: 'd',
      alias: 'Rosa',
      text: 'Hola',
    });
    expect(result.status).toBe('not-found');
  });

  it('aplaudir dos veces con el mismo dispositivo suma 1 (CA-29.2)', async () => {
    const store = createCommunityStore({ file });
    const { post: created } = await store.createPost(post());
    expect(await store.applaud(created.id, 'device-a')).toBe(1);
    expect(await store.applaud(created.id, 'device-a')).toBe(1);
    expect(await store.applaud(created.id, 'device-b')).toBe(2);
    expect(await store.applaud('PUB-9999', 'device-a')).toBeUndefined();
  });

  it('borrar con otro deviceKey da forbidden y con el del autor lo elimina', async () => {
    const store = createCommunityStore({ file });
    const { post: created } = await store.createPost(post());
    expect(await store.deletePost(created.id, 'ajeno')).toBe('forbidden');
    expect(store.getFeed().posts.some((p) => p.id === created.id)).toBe(true);
    expect(await store.deletePost(created.id, DEVICE)).toBe('deleted');
    expect(store.getFeed().posts.some((p) => p.id === created.id)).toBe(false);
    expect(await store.deletePost(created.id, DEVICE)).toBe('not-found');
  });

  it('nunca devuelve deviceKey, clientId ni los dispositivos que aplaudieron', async () => {
    const store = createCommunityStore({ file });
    const { post: created } = await store.createPost(post());
    await store.applaud(created.id, 'device-secret-applause');
    await store.addComment(created.id, {
      clientId: 'k-secret',
      deviceKey: 'device-secret-comment',
      alias: 'Rosa',
      text: 'Hola',
    });
    const body = JSON.stringify([store.getFeed(), created]);
    for (const secret of [
      DEVICE,
      'device-secret-applause',
      'device-secret-comment',
      'k-secret',
      '"clientId"',
      'deviceKey',
    ]) {
      expect(body).not.toContain(secret);
    }
  });

  it('no guarda los deviceKey en claro en el archivo', async () => {
    const store = createCommunityStore({ file });
    await store.createPost(post());
    await store.applaud('PUB-0003', 'device-secret-applause');
    const raw = readFileSync(file, 'utf8');
    expect(raw).not.toContain(DEVICE);
    expect(raw).not.toContain('device-secret-applause');
  });

  it('persiste entre dos instancias del almacén', async () => {
    const first = createCommunityStore({ file });
    const { post: created } = await first.createPost(post());
    await first.applaud(created.id, 'device-a');

    const second = createCommunityStore({ file });
    const stored = second.getFeed().posts.find((p) => p.id === created.id);
    expect(stored?.applause).toBe(1);
    // La idempotencia, el aplauso único y la autoría sobreviven al reinicio.
    expect((await second.createPost(post())).created).toBe(false);
    expect(await second.applaud(created.id, 'device-a')).toBe(1);
    expect(await second.deletePost(created.id, 'ajeno')).toBe('forbidden');
    // Los ids siguen sin repetirse y la semilla no se vuelve a crear.
    const next = await second.createPost(post({ clientId: 'c-2' }));
    expect(next.post.id).toBe('PUB-0004');
    expect(second.getFeed().posts).toHaveLength(4);
  });

  it('serializa las escrituras simultáneas sin perder ni repetir publicaciones', async () => {
    const store = createCommunityStore({ file });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => store.createPost(post({ clientId: `c-${i}` }))),
    );
    expect(new Set(results.map((r) => r.post.id)).size).toBe(20);
    const reloaded = createCommunityStore({ file });
    expect(reloaded.getFeed().posts).toHaveLength(22);
  });

  it('guarda como máximo 200 publicaciones y descarta las más antiguas', async () => {
    const store = createCommunityStore({ file });
    for (let i = 0; i < 205; i += 1) {
      await store.createPost(post({ clientId: `c-${i}`, message: `n${i}` }));
    }
    const saved = JSON.parse(readFileSync(file, 'utf8')) as { posts: unknown[] };
    expect(saved.posts).toHaveLength(200);
    const { posts } = store.getFeed();
    expect(posts).toHaveLength(COMMUNITY_LIMITS.feedSize);
    expect(posts[0]?.message).toBe('n204');
  });

  it('un archivo dañado se aparta y se vuelve a sembrar', () => {
    writeFileSync(file, '{ no es json');
    const store = createCommunityStore({ file });
    expect(store.getFeed().posts).toHaveLength(2);
  });
});
