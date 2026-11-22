// Cola sin conexión de la Comunidad (RF-37, CA-28.3, RNF-09). Todo lo que se publica, comenta o
// aplaude entra primero aquí y sale en orden cuando el servidor lo confirma. Cada elemento
// conserva su `clientId`, así que reenviarlo no lo duplica. Lo que no llegó se reintenta con una
// espera que crece y, tras varios intentos, se descarta para no atascar la cola. Módulo puro:
// quien envía y el reloj se inyectan.

import type { NewCommunityComment, NewCommunityPost } from '@chef/shared';
import { COMMUNITY_STORAGE_KEYS, readItem, writeItem } from './storage';

interface QueuedBase {
  clientId: string;
  /** Fecha ISO en que entró a la cola. */
  queuedAt: string;
  /** Intentos fallidos por falta de conexión o del servidor. */
  attempts?: number;
  /** Milisegundos (época) antes de los cuales no se reintenta. */
  retryAt?: number;
}

/** Intentos fallidos tras los cuales un elemento se descarta. */
export const MAX_SEND_ATTEMPTS = 6;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

/** Espera antes del siguiente intento tras `attempts` fallidos: 2 s, 4 s, 8 s… con tope. */
export function retryDelayMs(attempts: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), RETRY_MAX_MS);
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
  /** Descartados tras agotar los intentos sin que el servidor respondiera. */
  expired: QueueItem[];
  remaining: number;
}

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedItems: QueueItem[] = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isOptional = (value: unknown, check: (v: unknown) => boolean) =>
  value === undefined || check(value);

function isChange(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.before) &&
    isString(value.after) &&
    isOptional(value.reason, isString)
  );
}

function isPostBody(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.clientId) &&
    isString(value.deviceKey) &&
    (value.kind === 'recipe' || value.kind === 'achievement') &&
    isString(value.alias) &&
    isString(value.recipeId) &&
    isString(value.recipeName) &&
    isOptional(value.recipe, isRecord) &&
    isOptional(value.changes, (v) => Array.isArray(v) && v.every(isChange)) &&
    isOptional(value.rating, (v) => v === 'up' || v === 'down') &&
    isOptional(value.message, isString)
  );
}

function isCommentBody(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.clientId) &&
    isString(value.deviceKey) &&
    isString(value.alias) &&
    isString(value.text)
  );
}

/** Lo guardado puede estar a medias o dañado: cada tipo exige los campos que necesita. */
function isQueueItem(value: unknown): value is QueueItem {
  if (!isRecord(value)) return false;
  const valid =
    isString(value.clientId) &&
    isString(value.queuedAt) &&
    isOptional(value.attempts, Number.isFinite) &&
    isOptional(value.retryAt, Number.isFinite);
  if (!valid) return false;
  switch (value.kind) {
    case 'post':
      return isPostBody(value.body);
    case 'comment':
      return isString(value.postId) && isCommentBody(value.body);
    case 'applause':
      return isString(value.postId) && isString(value.deviceKey);
    default:
      return false;
  }
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

function update(clientId: string, change: (item: QueueItem) => QueueItem): void {
  save(loadQueue().map((i) => (i.clientId === clientId ? change(i) : i)));
}

/** Quita las esperas de reintento, por ejemplo al volver la conexión. */
export function resetBackoff(): void {
  const items = loadQueue();
  if (!items.some((i) => i.retryAt !== undefined)) return;
  save(items.map(({ retryAt: _retryAt, ...rest }) => rest as QueueItem));
}

let running: Promise<unknown> = Promise.resolve();

/**
 * Envía la cola en orden. Lo enviado o rechazado sale de la cola. Al primer "no disponible" se
 * detiene (lo más probable es que el resto tampoco llegue) y ese elemento espera un tiempo que
 * crece antes de reintentarse; mientras espera no frena a los demás, y tras `MAX_SEND_ATTEMPTS`
 * fallos se descarta. Dos llamadas simultáneas se encadenan para no enviar el mismo elemento dos
 * veces a la vez.
 */
export function flushQueue(
  send: (item: QueueItem) => Promise<SendOutcome>,
  now: () => number = Date.now,
): Promise<FlushResult> {
  const next = running.then(async () => {
    const result: FlushResult = { sent: [], rejected: [], expired: [], remaining: 0 };
    for (const item of loadQueue()) {
      if (item.retryAt !== undefined && item.retryAt > now()) continue;
      const outcome = await send(item);
      if (outcome === 'unavailable') {
        const attempts = (item.attempts ?? 0) + 1;
        if (attempts >= MAX_SEND_ATTEMPTS) {
          removeFromQueue(item.clientId);
          result.expired.push(item);
          continue;
        }
        update(item.clientId, (i) => ({ ...i, attempts, retryAt: now() + retryDelayMs(attempts) }));
        break;
      }
      removeFromQueue(item.clientId);
      result[outcome].push(item);
    }
    result.remaining = loadQueue().length;
    return result;
  });
  running = next.catch(() => undefined);
  return next;
}
