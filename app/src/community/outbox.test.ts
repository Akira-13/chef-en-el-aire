import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { output } from '../core/services';
import { applaudPost, commentOn, flushOutbox, markReconnected, publishPost } from './outbox';
import { MAX_SEND_ATTEMPTS, loadQueue, retryDelayMs } from './queue';
import { clearCommunityData } from './storage';

const achievement = {
  kind: 'achievement',
  alias: 'Sazón 1234',
  recipeId: 'REC-001',
  recipeName: 'Ají de gallina',
  rating: 'up',
} as const;

function respond(status: number) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ error: 'Falla' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
  clearCommunityData();
  vi.spyOn(output, 'announce').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('acciones de la Comunidad', () => {
  it.each([400, 401, 403, 404, 410, 422])(
    'un %i es definitivo: se descarta y no atasca la cola (RNF-09)',
    async (status) => {
      respond(status);
      expect(await publishPost(achievement)).toBe('rejected');
      expect(await commentOn('PUB-1', 'Sazón 1234', 'Rico')).toBe('rejected');
      expect(await applaudPost('PUB-1')).toBe('rejected');
      expect(loadQueue()).toEqual([]);
    },
  );

  it.each([408, 429, 500, 503])(
    'un %i se conserva como pendiente y se reintenta más tarde (RNF-09)',
    async (status) => {
      respond(status);
      expect(await publishPost(achievement)).toBe('pending');
      expect(loadQueue()).toHaveLength(1);
    },
  );

  it('al reconectar se reintenta de inmediato sin esperar la espera (RNF-09)', async () => {
    const failing = respond(503);
    expect(await publishPost(achievement)).toBe('pending');
    expect((await flushOutbox()).remaining).toBe(1);
    expect(failing).toHaveBeenCalledTimes(1);

    const working = respond(201);
    markReconnected();
    expect((await flushOutbox()).sent).toHaveLength(1);
    expect(working).toHaveBeenCalledTimes(1);
  });

  it('tras agotar los intentos se descarta y se avisa al usuario (RNF-09)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-21T10:00:00.000Z'));
    respond(503);
    expect(await publishPost(achievement)).toBe('pending');

    for (let attempt = 1; attempt < MAX_SEND_ATTEMPTS - 1; attempt++) {
      vi.advanceTimersByTime(retryDelayMs(attempt));
      expect((await flushOutbox()).remaining).toBe(1);
    }
    vi.advanceTimersByTime(retryDelayMs(MAX_SEND_ATTEMPTS - 1));
    const result = await flushOutbox();
    expect(result.expired).toHaveLength(1);
    expect(loadQueue()).toEqual([]);
    expect(output.announce).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('descart') as unknown }),
    );
  });
});
