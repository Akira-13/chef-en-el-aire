// Servicio de perfil persistente (RF-28, RNF-17). Responde al instante con los perfiles de
// prueba mientras carga lo guardado en IndexedDB; después notifica y resuelve `ready`.
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
import { commandBus } from '../core/commandBus';
import { metrics } from '../core/metrics';
import { addToPantry } from '../personalization/pantry';
import { applyUsageEvent, createLearningSession } from './learning';
import { openProfileStore, type ProfileStore } from './storage';

const DEFAULT_PROFILE_ID = 'USR-002';

function seedProfiles(): Profile[] {
  return (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "papa, pollo y ají amarillo" */
function listInWords(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : (items[0] ?? '');
}

export interface ProfileServiceOptions {
  /** Escucha los comandos de voz del perfil (CA-03.1, CA-24.3). Por defecto, sí. */
  listenToCommands?: boolean;
}

export function createProfileService(options: ProfileServiceOptions = {}): ProfileService {
  let profiles = seedProfiles();
  let currentId = DEFAULT_PROFILE_ID;
  let store: ProfileStore | null = null;
  const listeners = new Set<() => void>();
  const noticeListeners = new Set<(message: string) => void>();
  const session = createLearningSession();

  // getProfile devuelve la referencia guardada en `profiles`: solo cambia cuando se reemplaza
  // el perfil, así useSyncExternalStore no entra en un bucle.
  function current(): Profile {
    const profile = profiles.find((p) => p.id === currentId) ?? profiles[0];
    if (!profile) throw new Error('No hay perfiles cargados');
    return profile;
  }

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  function notice(message: string): void {
    for (const listener of [...noticeListeners]) listener(message);
  }

  // Sin IndexedDB (navegador privado, pruebas) el perfil sigue funcionando en memoria.
  async function persist(write: (s: ProfileStore) => Promise<void>): Promise<void> {
    if (!store) return;
    const startedAt = performance.now();
    try {
      await write(store);
      metrics.record('profile.save', performance.now() - startedAt);
    } catch {
      // Si falla el guardado se conserva el cambio en memoria.
    }
  }

  async function load(): Promise<void> {
    try {
      store = await openProfileStore();
      const saved = await store.loadAll();
      if (saved.profiles.length > 0) {
        const loaded = saved.profiles.map(toProfile);
        // Un perfil de prueba nuevo en datos/perfiles.json aparece aunque haya datos guardados.
        const missing = seedProfiles().filter((s) => !loaded.some((p) => p.id === s.id));
        profiles = [...loaded, ...missing];
        if (saved.currentId && profiles.some((p) => p.id === saved.currentId)) {
          currentId = saved.currentId;
        }
      } else {
        await store.replaceAll(profiles.map(toRawProfile), currentId);
      }
    } catch {
      store = null;
    }
    notify();
  }

  const ready = load();

  async function update(updater: (profile: Profile) => Profile): Promise<void> {
    await ready;
    const next = updater(current());
    if (next === current()) return;
    profiles = profiles.map((p) => (p.id === next.id ? next : p));
    notify();
    await persist((s) => s.saveProfile(toRawProfile(next)));
  }

  async function recordEvent(event: UsageEvent): Promise<void> {
    let message: string | undefined;
    await update((profile) => {
      const result = applyUsageEvent(profile, event, today(), session);
      message = result.notice;
      return result.profile;
    });
    if (message) notice(message);
  }

  // Comandos que modifican el perfil, vengan del canal que vengan.
  if (options.listenToCommands !== false) {
    commandBus.subscribe(({ command }) => {
      if (command.type === 'addPantry') {
        const items = command.items.map((item) => item.trim()).filter(Boolean);
        if (items.length === 0) return;
        void update((p) => ({ ...p, pantry: addToPantry(p.pantry, items) })).then(() =>
          notice(`Agregué ${listInWords(items)} a tu despensa.`),
        );
      } else if (command.type === 'feeling') {
        void recordEvent({ type: 'feelingDeclared', feeling: command.feeling });
      }
    });
  }

  return {
    ready,
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
      await ready;
      if (!profiles.some((p) => p.id === id)) throw new Error(`No existe el perfil ${id}`);
      if (id === currentId) return;
      currentId = id;
      notify();
      await persist((s) => s.saveCurrentId(id));
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
      await ready;
      profiles = seedProfiles();
      currentId = DEFAULT_PROFILE_ID;
      notify();
      await persist((s) => s.replaceAll(profiles.map(toRawProfile), currentId));
    },
  };
}
