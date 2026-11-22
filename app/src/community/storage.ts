// Datos de la Comunidad guardados en el dispositivo (RNF-11): la clave del dispositivo, los ids
// de lo propio, los aplausos dados y vistos y la cola sin conexión. Módulo puro, sin core/services, para
// que "Borrar mis datos" del perfil pueda limpiarlo.

import type { SeenApplause } from './applause';

export const COMMUNITY_STORAGE_KEYS = {
  deviceKey: 'chef.community.deviceKey',
  ownPosts: 'chef.community.ownPosts',
  ownComments: 'chef.community.ownComments',
  applauded: 'chef.community.applauded',
  seenApplause: 'chef.community.seenApplause',
  queue: 'chef.community.queue',
} as const;

// Sin localStorage (navegador privado o bloqueado) se sigue sin guardar, igual que el perfil.
export function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Devuelve `false` si no se pudo guardar. */
export function writeItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nada que borrar.
  }
}

/** Lista de ids guardada como JSON; una lista dañada se toma como vacía. */
function readIds(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(readItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function addId(key: string, id: string): void {
  const ids = readIds(key);
  if (!ids.includes(id)) writeItem(key, JSON.stringify([...ids, id]));
}

/** Ids de las publicaciones hechas desde este dispositivo: solo esas se pueden borrar. */
export function getOwnPostIds(): string[] {
  return readIds(COMMUNITY_STORAGE_KEYS.ownPosts);
}

export function addOwnPostId(id: string): void {
  addId(COMMUNITY_STORAGE_KEYS.ownPosts, id);
}

export function removeOwnPostId(id: string): void {
  writeItem(
    COMMUNITY_STORAGE_KEYS.ownPosts,
    JSON.stringify(getOwnPostIds().filter((p) => p !== id)),
  );
}

/** Comentarios propios: no cuentan para medir cuánto tarda en verse lo ajeno (RNF-09). */
export function getOwnCommentIds(): string[] {
  return readIds(COMMUNITY_STORAGE_KEYS.ownComments);
}

export function addOwnCommentId(id: string): void {
  addId(COMMUNITY_STORAGE_KEYS.ownComments, id);
}

/** Publicaciones que este dispositivo ya aplaudió: el servidor acepta uno por dispositivo. */
export function getApplaudedPostIds(): string[] {
  return readIds(COMMUNITY_STORAGE_KEYS.applauded);
}

export function addApplaudedPostId(id: string): void {
  addId(COMMUNITY_STORAGE_KEYS.applauded, id);
}

/** Aplausos ajenos ya vistos en cada publicación propia (CA-29.2). Un dato dañado se toma como vacío. */
export function getSeenApplause(): SeenApplause {
  try {
    const parsed: unknown = JSON.parse(readItem(COMMUNITY_STORAGE_KEYS.seenApplause) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number',
      ),
    );
  } catch {
    return {};
  }
}

export function setSeenApplause(seen: SeenApplause): void {
  writeItem(COMMUNITY_STORAGE_KEYS.seenApplause, JSON.stringify(seen));
}

/** Borra todo lo de la Comunidad guardado en el dispositivo (CA-25.3). */
export function clearCommunityData(): void {
  for (const key of Object.values(COMMUNITY_STORAGE_KEYS)) removeItem(key);
}
