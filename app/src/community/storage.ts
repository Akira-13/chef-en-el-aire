// Datos de la Comunidad guardados en el dispositivo (RNF-11): la clave del dispositivo, los ids
// de las publicaciones propias y la cola sin conexión. Módulo puro, sin core/services, para que
// "Borrar mis datos" del perfil pueda limpiarlo.

export const COMMUNITY_STORAGE_KEYS = {
  deviceKey: 'chef.community.deviceKey',
  ownPosts: 'chef.community.ownPosts',
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

/** Ids de las publicaciones hechas desde este dispositivo: solo esas se pueden borrar. */
export function getOwnPostIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(readItem(COMMUNITY_STORAGE_KEYS.ownPosts) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function addOwnPostId(id: string): void {
  const ids = getOwnPostIds();
  if (!ids.includes(id)) writeItem(COMMUNITY_STORAGE_KEYS.ownPosts, JSON.stringify([...ids, id]));
}

/** Borra todo lo de la Comunidad guardado en el dispositivo (CA-25.3). */
export function clearCommunityData(): void {
  for (const key of Object.values(COMMUNITY_STORAGE_KEYS)) removeItem(key);
}
