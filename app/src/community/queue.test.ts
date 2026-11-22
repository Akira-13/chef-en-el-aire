import { beforeEach, describe, expect, it } from 'vitest';
import type { NewCommunityComment } from '@chef/shared';
import {
  MAX_SEND_ATTEMPTS,
  enqueue,
  flushQueue,
  loadQueue,
  resetBackoff,
  retryDelayMs,
  subscribeQueue,
  type QueueItem,
  type SendOutcome,
} from './queue';
import { COMMUNITY_STORAGE_KEYS } from './storage';

function comment(clientId: string, text = 'Me salió rica'): QueueItem {
  const body: NewCommunityComment = { clientId, deviceKey: 'dev-1', alias: 'Sazón', text };
  return {
    kind: 'comment',
    clientId,
    queuedAt: '2026-11-21T10:00:00.000Z',
    postId: 'PUB-0001',
    body,
  };
}

/** Envío falso que responde según una lista y anota lo que intentó enviar. */
function sender(outcomes: Record<string, SendOutcome[]>) {
  const attempts: string[] = [];
  const send = async (item: QueueItem): Promise<SendOutcome> => {
    attempts.push(item.clientId);
    return outcomes[item.clientId]?.shift() ?? 'sent';
  };
  return { attempts, send };
}

/** Reloj manual: el reintento depende de la hora, así que la prueba la mueve a mano. */
function clock(start = 1_000_000) {
  let time = start;
  return {
    now: () => time,
    advance(ms: number) {
      time += ms;
    },
  };
}

beforeEach(() => localStorage.clear());

describe('cola sin conexión de la Comunidad', () => {
  it('reenviar la cola dos veces no duplica: se conserva el clientId (CA-28.3)', async () => {
    enqueue(comment('c1'));
    enqueue(comment('c1'));
    expect(loadQueue()).toHaveLength(1);

    const time = clock();
    const { attempts, send } = sender({ c1: ['unavailable', 'sent'] });
    const first = await flushQueue(send, time.now);
    expect(first).toMatchObject({ sent: [], remaining: 1 });

    time.advance(retryDelayMs(1));
    const second = await flushQueue(send, time.now);
    expect(second.sent.map((i) => i.clientId)).toEqual(['c1']);
    expect(await flushQueue(send, time.now)).toMatchObject({ sent: [], remaining: 0 });
    expect(attempts).toEqual(['c1', 'c1']);
  });

  it('envía en el orden en que entraron y se detiene sin red (CA-28.3)', async () => {
    enqueue(comment('a'));
    enqueue(comment('b'));
    enqueue(comment('c'));
    const time = clock();
    const { attempts, send } = sender({ b: ['unavailable'] });

    const result = await flushQueue(send, time.now);
    expect(attempts).toEqual(['a', 'b']);
    expect(loadQueue().map((i) => i.clientId)).toEqual(['b', 'c']);
    expect(result.remaining).toBe(2);

    time.advance(retryDelayMs(1));
    await flushQueue(send, time.now);
    expect(attempts).toEqual(['a', 'b', 'b', 'c']);
    expect(loadQueue()).toEqual([]);
  });

  it('un elemento rechazado (400) se descarta y no frena a los demás (RNF-09)', async () => {
    enqueue(comment('malo', ''));
    enqueue(comment('bueno'));
    const { send } = sender({ malo: ['rejected'] });

    const result = await flushQueue(send);
    expect(result.rejected.map((i) => i.clientId)).toEqual(['malo']);
    expect(result.sent.map((i) => i.clientId)).toEqual(['bueno']);
    expect(loadQueue()).toEqual([]);
  });

  it('dos envíos simultáneos no mandan el mismo elemento dos veces (RNF-09)', async () => {
    enqueue(comment('c1'));
    const { attempts, send } = sender({});
    await Promise.all([flushQueue(send), flushQueue(send)]);
    expect(attempts).toEqual(['c1']);
  });

  it('sobrevive a una recarga y descarta lo dañado', () => {
    localStorage.setItem(
      COMMUNITY_STORAGE_KEYS.queue,
      JSON.stringify([comment('ok'), { kind: 'otro' }, 'basura']),
    );
    expect(loadQueue().map((i) => i.clientId)).toEqual(['ok']);
    localStorage.setItem(COMMUNITY_STORAGE_KEYS.queue, '{no es json');
    expect(loadQueue()).toEqual([]);
  });

  it('avisa cuando la cola cambia, para mostrar lo pendiente', () => {
    let calls = 0;
    const unsubscribe = subscribeQueue(() => (calls += 1));
    enqueue(comment('c1'));
    unsubscribe();
    enqueue(comment('c2'));
    expect(calls).toBe(1);
  });

  it('un elemento en espera no frena a los que vienen detrás (RNF-09)', async () => {
    enqueue(comment('a'));
    enqueue(comment('b'));
    const time = clock();
    const { attempts, send } = sender({ a: ['unavailable'] });

    await flushQueue(send, time.now);
    expect(attempts).toEqual(['a']);

    // 'a' sigue esperando su reintento: 'b' sale sin esperarlo.
    const result = await flushQueue(send, time.now);
    expect(attempts).toEqual(['a', 'b']);
    expect(result.sent.map((i) => i.clientId)).toEqual(['b']);
    expect(loadQueue().map((i) => i.clientId)).toEqual(['a']);
  });

  it('no reintenta antes de tiempo y la espera crece hasta un tope (RNF-09)', async () => {
    enqueue(comment('a'));
    const time = clock();
    const { attempts, send } = sender({ a: ['unavailable', 'unavailable', 'unavailable'] });

    await flushQueue(send, time.now);
    time.advance(retryDelayMs(1) - 1);
    await flushQueue(send, time.now);
    expect(attempts).toEqual(['a']);

    time.advance(1);
    await flushQueue(send, time.now);
    expect(attempts).toEqual(['a', 'a']);
    time.advance(retryDelayMs(1));
    await flushQueue(send, time.now);
    expect(attempts).toEqual(['a', 'a']);

    expect(retryDelayMs(2)).toBeGreaterThan(retryDelayMs(1));
    expect(retryDelayMs(3)).toBeGreaterThan(retryDelayMs(2));
    expect(retryDelayMs(MAX_SEND_ATTEMPTS * 10)).toBe(retryDelayMs(MAX_SEND_ATTEMPTS * 20));
  });

  it('tras demasiados intentos fallidos el elemento se descarta y se informa (RNF-09)', async () => {
    enqueue(comment('a'));
    enqueue(comment('b'));
    const time = clock();
    const send = async (item: QueueItem): Promise<SendOutcome> =>
      item.clientId === 'a' ? 'unavailable' : 'sent';

    for (let attempt = 1; attempt < MAX_SEND_ATTEMPTS; attempt++) {
      const result = await flushQueue(send, time.now);
      expect(result.expired).toEqual([]);
      time.advance(retryDelayMs(attempt));
    }
    const last = await flushQueue(send, time.now);
    expect(last.expired.map((i) => i.clientId)).toEqual(['a']);
    expect(last.remaining).toBe(0);
    expect(loadQueue()).toEqual([]);
  });

  it('al volver la conexión se quitan las esperas para enviar de inmediato (RNF-09)', async () => {
    enqueue(comment('a'));
    const time = clock();
    const { attempts, send } = sender({ a: ['unavailable'] });
    await flushQueue(send, time.now);

    resetBackoff();
    await flushQueue(send, time.now);
    expect(attempts).toEqual(['a', 'a']);
    expect(loadQueue()).toEqual([]);
  });

  it('descarta lo guardado a medias: cada tipo exige sus campos', () => {
    const good = comment('ok');
    const noBody = { kind: 'comment', clientId: 'x1', queuedAt: 'now', postId: 'PUB-1' };
    const noPostId = { ...comment('x2'), postId: undefined };
    const badText = { ...comment('x3'), body: { clientId: 'x3', deviceKey: 'd', alias: 'a' } };
    const post = {
      kind: 'post',
      clientId: 'p1',
      queuedAt: '2026-11-21T10:00:00.000Z',
      body: {
        clientId: 'p1',
        deviceKey: 'dev-1',
        kind: 'achievement',
        alias: 'Sazón',
        recipeId: 'REC-001',
        recipeName: 'Ají de gallina',
      },
    };
    const postNoBody = { ...post, clientId: 'p2', body: undefined };
    const postNoName = { ...post, clientId: 'p3', body: { ...post.body, recipeName: undefined } };
    const postBadChanges = { ...post, clientId: 'p4', body: { ...post.body, changes: 'x' } };
    const applause = {
      kind: 'applause',
      clientId: 'a1',
      queuedAt: '2026-11-21T10:00:00.000Z',
      postId: 'PUB-1',
      deviceKey: 'dev-1',
    };
    const applauseNoKey = { ...applause, clientId: 'a2', deviceKey: undefined };
    localStorage.setItem(
      COMMUNITY_STORAGE_KEYS.queue,
      JSON.stringify([
        good,
        noBody,
        noPostId,
        badText,
        post,
        postNoBody,
        postNoName,
        postBadChanges,
        applause,
        applauseNoKey,
      ]),
    );
    expect(loadQueue().map((i) => i.clientId)).toEqual(['ok', 'p1', 'a1']);
  });
});
