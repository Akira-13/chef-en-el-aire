import { beforeEach, describe, expect, it } from 'vitest';
import type { NewCommunityComment } from '@chef/shared';
import {
  enqueue,
  flushQueue,
  loadQueue,
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

beforeEach(() => localStorage.clear());

describe('cola sin conexión de la Comunidad', () => {
  it('reenviar la cola dos veces no duplica: se conserva el clientId (CA-28.3)', async () => {
    enqueue(comment('c1'));
    enqueue(comment('c1'));
    expect(loadQueue()).toHaveLength(1);

    const { attempts, send } = sender({ c1: ['unavailable', 'sent'] });
    const first = await flushQueue(send);
    expect(first).toMatchObject({ sent: [], remaining: 1 });

    const second = await flushQueue(send);
    expect(second.sent.map((i) => i.clientId)).toEqual(['c1']);
    expect(await flushQueue(send)).toMatchObject({ sent: [], remaining: 0 });
    expect(attempts).toEqual(['c1', 'c1']);
  });

  it('envía en el orden en que entraron y se detiene sin red (CA-28.3)', async () => {
    enqueue(comment('a'));
    enqueue(comment('b'));
    enqueue(comment('c'));
    const { attempts, send } = sender({ b: ['unavailable'] });

    const result = await flushQueue(send);
    expect(attempts).toEqual(['a', 'b']);
    expect(loadQueue().map((i) => i.clientId)).toEqual(['b', 'c']);
    expect(result.remaining).toBe(2);

    await flushQueue(send);
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
});
