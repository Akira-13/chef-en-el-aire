// Almacenamiento del perfil en el dispositivo con IndexedDB (RF-28, RNF-17). Los perfiles se
// guardan en el formato de datos/perfiles.json, el mismo que se exporta (RNF-11).

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RawProfile } from '@chef/shared';

const DB_NAME = 'chef-en-el-aire';
const DB_VERSION = 1;
const CURRENT_ID_KEY = 'currentId';

interface ChefDB extends DBSchema {
  profiles: { key: string; value: RawProfile };
  meta: { key: string; value: string };
}

export interface ProfileStore {
  loadAll(): Promise<{ profiles: RawProfile[]; currentId: string | undefined }>;
  saveProfile(profile: RawProfile): Promise<void>;
  saveCurrentId(id: string): Promise<void>;
  /** Reemplaza todo lo guardado por estos perfiles. */
  replaceAll(profiles: RawProfile[], currentId: string): Promise<void>;
}

export async function openProfileStore(): Promise<ProfileStore> {
  const db: IDBPDatabase<ChefDB> = await openDB<ChefDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('profiles')) {
        database.createObjectStore('profiles', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta');
    },
  });

  return {
    async loadAll() {
      const [profiles, currentId] = await Promise.all([
        db.getAll('profiles'),
        db.get('meta', CURRENT_ID_KEY),
      ]);
      return { profiles, currentId };
    },
    async saveProfile(profile) {
      await db.put('profiles', profile);
    },
    async saveCurrentId(id) {
      await db.put('meta', id, CURRENT_ID_KEY);
    },
    async replaceAll(profiles, currentId) {
      const tx = db.transaction(['profiles', 'meta'], 'readwrite');
      const profileStore = tx.objectStore('profiles');
      await profileStore.clear();
      for (const profile of profiles) await profileStore.put(profile);
      await tx.objectStore('meta').put(currentId, CURRENT_ID_KEY);
      await tx.done;
    },
  };
}
