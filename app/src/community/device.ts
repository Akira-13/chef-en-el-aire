// Identificadores de la Comunidad. La clave del dispositivo es un token aleatorio que se genera
// una sola vez y permite borrar lo propio; no identifica a la persona. Cada publicación o
// comentario lleva un id de cliente para que reenviarlo no lo duplique (RNF-09).

import { COMMUNITY_STORAGE_KEYS, readItem, writeItem } from './storage';

// Solo se usa si el navegador no deja guardar: así la clave es estable durante la sesión.
let unsavedKey: string | undefined;

export function getDeviceKey(): string {
  const saved = readItem(COMMUNITY_STORAGE_KEYS.deviceKey);
  if (saved) return saved;
  if (unsavedKey) return unsavedKey;
  const key = crypto.randomUUID();
  if (!writeItem(COMMUNITY_STORAGE_KEYS.deviceKey, key)) unsavedKey = key;
  return key;
}

export function newClientId(): string {
  return crypto.randomUUID();
}
