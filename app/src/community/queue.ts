// Cola sin conexión de la Comunidad (RF-37, CA-28.3, RNF-09). Todo lo que se publica, comenta o
// aplaude entra primero aquí y sale en orden cuando el servidor lo confirma. Cada elemento
// conserva su `clientId`, así que reenviarlo no lo duplica. Módulo puro: quien envía se inyecta.

import type { NewCommunityComment, NewCommunityPost } from '@chef/shared';
import { COMMUNITY_STORAGE_KEYS, readItem, writeItem } from './storage';

interface QueuedBase {
  clientId: string;
  /** Fecha ISO en que entró a la cola. */
  queuedAt: string;
}

export type QueueItem =
  | (QueuedBase & { kind: 'post'; body: NewCommunityPost })
  | (QueuedBase & { kind: 'comment'; postId: string; body: NewCommunityComment })
  | (QueuedBase & { kind: 'applause'; postId: string; deviceKey: string });

/** `sent`: el servidor respondió 200 o 201. `rejected`: lo rechazó y no tiene sentido reintentar. */
export type SendOutcome = 'sent' | 'rejected' | 'unavailable';

export interface FlushResult {
  sent: QueueItem[];
  rejected: QueueItem[];
  remaining: number;
}

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedItems: QueueItem[] = [];

function isQueueItem(value: unknown): value is QueueItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<QueueItem>;
  return (
    typeof item.clientId === 'string' &&
    (item.kind === 'post' || item.kind === 'comment' || item.kind === 'applause')
  );
}

/** Elementos pendientes, en el orden en que entraron. Devuelve la misma lista si no cambió. */
export function loadQueue(): QueueItem[] {
  const raw = readItem(COMMUNITY_STORAGE_KEYS.queue);
  if (raw === cachedRaw) return cachedItems;
  cachedRaw = raw;
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    cachedItems = Array.isArray(parsed) ? parsed.filter(isQueueItem) : [];
  } catch {
    cachedItems = [];
  }
  return cachedItems;
}

function save(items: QueueItem[]): void {
  writeItem(COMMUNITY_STORAGE_KEYS.queue, JSON.stringify(items));
  for (const listener of [...listeners]) listener();
}

/** Agrega al final; si el `clientId` ya está en la cola, no lo repite. */
export function enqueue(item: QueueItem): void {
  const items = loadQueue();
  if (items.some((i) => i.clientId === item.clientId)) return;
  save([...items, item]);
}

export function removeFromQueue(clientId: string): void {
  const items = loadQueue();
  if (items.some((i) => i.clientId === clientId)) {
    save(items.filter((i) => i.clientId !== clientId));
  }
}

/** Avisa cada vez que la cola cambia (para mostrar lo pendiente). */
export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let running: Promise<unknown> = Promise.resolve();

/**
 * Envía la cola en orden. Lo enviado o rechazado sale de la cola; al primer "no disponible" se
 * detiene y deja el resto para el próximo intento, así no se adelanta nada. Dos llamadas
 * simultáneas se encadenan para no enviar el mismo elemento dos veces a la vez.
 */
export function flushQueue(send: (item: QueueItem) => Promise<SendOutcome>): Promise<FlushResult> {
  const next = running.then(async () => {
    const result: FlushResult = { sent: [], rejected: [], remaining: 0 };
    for (const item of loadQueue()) {
      const outcome = await send(item);
      if (outcome === 'unavailable') break;
      removeFromQueue(item.clientId);
      result[outcome].push(item);
    }
    result.remaining = loadQueue().length;
    return result;
  });
  running = next.catch(() => undefined);
  return next;
}
