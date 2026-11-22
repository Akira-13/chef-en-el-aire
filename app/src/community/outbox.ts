// Acciones de la Comunidad (RF-34, RF-36, RF-37). Publicar, comentar y aplaudir entran primero a
// la cola y se envían enseguida; si no hay conexión, quedan "pendientes" y salen al reconectar o
// en el siguiente sondeo exitoso (CA-28.3). Mide RNF-09: de la reconexión a la cola vacía.

import type { NewCommunityComment, NewCommunityPost } from '@chef/shared';
import { metrics } from '../core/metrics';
import { output } from '../core/services';
import { communityClient, isFailure } from './client';
import { getDeviceKey, newClientId } from './device';
import {
  enqueue,
  flushQueue,
  loadQueue,
  resetBackoff,
  type FlushResult,
  type QueueItem,
  type SendOutcome,
} from './queue';
import {
  addApplaudedPostId,
  addOwnCommentId,
  addOwnPostId,
  getOwnPostIds,
  removeOwnPostId,
} from './storage';

/** Resultado de una acción: enviada ya, pendiente en la cola o rechazada por el servidor. */
export type ActionResult = 'sent' | 'pending' | 'rejected';

async function send(item: QueueItem): Promise<SendOutcome> {
  switch (item.kind) {
    case 'post': {
      const result = await communityClient.publish(item.body);
      if (!isFailure(result)) {
        addOwnPostId(result.id);
        return 'sent';
      }
      // Todo 4xx (404 incluido) es definitivo; solo lo que no llegó se reintenta.
      return result.status === 'unavailable' ? 'unavailable' : 'rejected';
    }
    case 'comment': {
      const result = await communityClient.comment(item.postId, item.body);
      if (!isFailure(result)) {
        addOwnCommentId(result.id);
        return 'sent';
      }
      // Comentar o aplaudir algo que ya se borró no tiene arreglo: se descarta.
      return result.status === 'unavailable' ? 'unavailable' : 'rejected';
    }
    case 'applause': {
      const result = await communityClient.applaud(item.postId, item.deviceKey);
      if (!isFailure(result)) return 'sent';
      return result.status === 'unavailable' ? 'unavailable' : 'rejected';
    }
  }
}

const KIND_LABELS: Record<QueueItem['kind'], string> = {
  post: 'tu publicación',
  comment: 'tu comentario',
  applause: 'tu aplauso',
};

// Momento de la reconexión con la cola llena; se cierra al vaciarla (RNF-09).
let reconnectedAt: number | undefined;

/** Marca que volvió la conexión; solo cuenta si hay algo pendiente. */
export function markReconnected(): void {
  // Con la red de vuelta no tiene sentido seguir esperando el reintento.
  resetBackoff();
  if (reconnectedAt === undefined && loadQueue().length > 0) reconnectedAt = performance.now();
}

/** Envía lo pendiente y avisa de lo rechazado. */
export async function flushOutbox(): Promise<FlushResult> {
  const result = await flushQueue(send);
  for (const item of result.rejected) {
    output.announce({
      text: `La Comunidad no aceptó ${KIND_LABELS[item.kind]} y la descarté.`,
      kind: 'error',
    });
  }
  for (const item of result.expired) {
    output.announce({
      text: `No pude enviar ${KIND_LABELS[item.kind]} tras varios intentos y la descarté.`,
      kind: 'error',
    });
  }
  if (result.remaining === 0 && reconnectedAt !== undefined) {
    metrics.record('community.queueFlush', performance.now() - reconnectedAt, 'ms', {
      sent: result.sent.length,
    });
    reconnectedAt = undefined;
  }
  return result;
}

async function submit(item: QueueItem): Promise<ActionResult> {
  enqueue(item);
  const result = await flushOutbox();
  if (result.sent.some((i) => i.clientId === item.clientId)) return 'sent';
  if ([...result.rejected, ...result.expired].some((i) => i.clientId === item.clientId)) {
    return 'rejected';
  }
  return 'pending';
}

const now = () => new Date().toISOString();

export function publishPost(
  post: Omit<NewCommunityPost, 'clientId' | 'deviceKey'>,
): Promise<ActionResult> {
  const clientId = newClientId();
  return submit({
    kind: 'post',
    clientId,
    queuedAt: now(),
    body: { ...post, clientId, deviceKey: getDeviceKey() },
  });
}

export function commentOn(postId: string, alias: string, text: string): Promise<ActionResult> {
  const clientId = newClientId();
  const body: NewCommunityComment = { clientId, deviceKey: getDeviceKey(), alias, text };
  return submit({ kind: 'comment', clientId, queuedAt: now(), postId, body });
}

export function applaudPost(postId: string): Promise<ActionResult> {
  // Se marca antes de enviar: el servidor acepta un aplauso por dispositivo y no se repite.
  addApplaudedPostId(postId);
  return submit({
    kind: 'applause',
    clientId: newClientId(),
    queuedAt: now(),
    postId,
    deviceKey: getDeviceKey(),
  });
}

/** Borra una publicación propia en el servidor. */
export async function removePost(postId: string): Promise<'deleted' | 'unavailable' | 'rejected'> {
  const result = await communityClient.remove(postId, getDeviceKey());
  if (result.status === 'deleted') removeOwnPostId(postId);
  return result.status;
}

/**
 * Antes de "Borrar mis datos" (CA-25.3): intenta borrar en el servidor todo lo publicado desde
 * este dispositivo. Devuelve cuántas no se pudieron borrar, que quedarán publicadas.
 */
export async function removeOwnPosts(): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;
  for (const id of getOwnPostIds()) {
    if ((await removePost(id)) === 'deleted') deleted += 1;
    else failed += 1;
  }
  return { deleted, failed };
}

// Al volver la red se envía lo pendiente aunque la Comunidad no esté abierta (RF-37): un logro
// compartido sin conexión desde la celebración no debe esperar a que se abra la pantalla.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    markReconnected();
    void flushOutbox();
  });
  if (loadQueue().length > 0 && navigator.onLine) void flushOutbox();
}
