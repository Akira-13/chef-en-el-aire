// Servicio de perfil. Esta versión vive en memoria y parte de los perfiles de prueba; la
// persistencia en el dispositivo y el aprendizaje con el uso se implementan aquí (RF-28, RF-29).
// core/services.ts crea el servicio al cargar: este módulo no debe importar core/services ni
// componentes que lo usen, o se forma un ciclo de imports.

import rawProfiles from '../../../datos/perfiles.json';
import {
  toProfile,
  toRawProfile,
  type Profile,
  type RawProfile,
  type RawProfileBook,
} from '@chef/shared';
import type { ProfileService, ProfileSummary, UsageEvent } from '../core/contracts';

const DEFAULT_PROFILE_ID = 'USR-002';

function seedProfiles(): Profile[] {
  return (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createProfileService(): ProfileService {
  let profiles = seedProfiles();
  let currentId = DEFAULT_PROFILE_ID;
  const listeners = new Set<() => void>();
  const noticeListeners = new Set<(message: string) => void>();

  function current(): Profile {
    const profile = profiles.find((p) => p.id === currentId) ?? profiles[0];
    if (!profile) throw new Error('No hay perfiles cargados');
    return profile;
  }

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  async function update(updater: (profile: Profile) => Profile): Promise<void> {
    const next = updater(current());
    profiles = profiles.map((p) => (p.id === next.id ? next : p));
    notify();
  }

  async function recordEvent(event: UsageEvent): Promise<void> {
    switch (event.type) {
      case 'recipeCompleted':
        await update((p) => ({
          ...p,
          history: [
            ...p.history,
            { recipeId: event.recipeId, date: today(), substitutions: event.substitutions },
          ],
        }));
        return;
      case 'recipeRated':
        await update((p) => {
          const history = [...p.history];
          const index = history.findLastIndex((h) => h.recipeId === event.recipeId);
          const entry = history[index];
          if (entry) history[index] = { ...entry, rating: event.rating };
          return { ...p, history };
        });
        return;
      default:
        // Los demás eventos alimentan el aprendizaje del perfil.
        return;
    }
  }

  return {
    ready: Promise.resolve(),
    getProfile: current,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update,
    listProfiles(): ProfileSummary[] {
      return profiles.map((p) => ({
        id: p.id,
        name: p.name,
        condition: p.accessibility.condition,
        preferredInput: p.accessibility.preferredInput,
      }));
    },
    async selectProfile(id) {
      if (!profiles.some((p) => p.id === id)) throw new Error(`No existe el perfil ${id}`);
      currentId = id;
      notify();
    },
    recordEvent,
    onNotice(listener) {
      noticeListeners.add(listener);
      return () => {
        noticeListeners.delete(listener);
      };
    },
    exportRaw(): RawProfile {
      return toRawProfile(current());
    },
    async reset() {
      profiles = seedProfiles();
      currentId = DEFAULT_PROFILE_ID;
      notify();
    },
  };
}
