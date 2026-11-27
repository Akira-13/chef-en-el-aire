import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commandBus } from '../core/commandBus';
import { metrics } from '../core/metrics';
import { createProfileService } from './index';
import { PROFILE_NAME_MAX_LENGTH } from './name';

beforeEach(() => {
  // Base vacía en cada prueba.
  globalThis.indexedDB = new IDBFactory();
  metrics.clear();
});

describe('perfil persistente', () => {
  it('responde al instante con el perfil sembrado antes de cargar', () => {
    const service = createProfileService();
    expect(service.getProfile().id).toBe('USR-002');
  });

  it('conserva los cambios entre dos sesiones (CA-23.2)', async () => {
    const first = createProfileService();
    await first.ready;
    await first.selectProfile('USR-001');
    await first.update((p) => ({ ...p, pantry: [...p.pantry, 'maicena'] }));

    const second = createProfileService();
    await second.ready;
    expect(second.getProfile().id).toBe('USR-001');
    expect(second.getProfile().pantry).toContain('maicena');
  });

  it('devuelve el mismo objeto mientras el perfil no cambie', async () => {
    const service = createProfileService();
    await service.ready;
    const a = service.getProfile();
    expect(service.getProfile()).toBe(a);
    await service.update((p) => ({ ...p, pantry: ['sal'] }));
    expect(service.getProfile()).not.toBe(a);
  });

  it('notifica al terminar de cargar y al cambiar', async () => {
    const service = createProfileService();
    let calls = 0;
    service.subscribe(() => calls++);
    await service.ready;
    expect(calls).toBe(1);
    await service.selectProfile('USR-003');
    expect(calls).toBe(2);
  });

  it('mide el guardado en menos de 1 s (RNF-17)', async () => {
    const service = createProfileService();
    await service.ready;
    await service.update((p) => ({ ...p, pantry: ['sal'] }));
    const saves = metrics.samples().filter((s) => s.name === 'profile.save');
    expect(saves).toHaveLength(1);
    expect(saves[0]!.value).toBeLessThan(1000);
  });

  it('reset borra lo guardado y vuelve a los perfiles de prueba', async () => {
    const first = createProfileService();
    await first.ready;
    await first.selectProfile('USR-004');
    await first.update((p) => ({ ...p, pantry: [] }));
    await first.reset();
    expect(first.getProfile().id).toBe('USR-002');

    const second = createProfileService();
    await second.ready;
    expect(second.getProfile().id).toBe('USR-002');
    expect(second.listProfiles().find((p) => p.id === 'USR-004')).toBeDefined();
    await second.selectProfile('USR-004');
    expect(second.getProfile().pantry.length).toBeGreaterThan(0);
  });

  it('marca como ejemplo solo a los perfiles de prueba, no a los creados', async () => {
    const service = createProfileService();
    await service.ready;
    const id = await service.createProfile('Lucía');
    const list = service.listProfiles();
    expect(list.filter((p) => p.example).map((p) => p.id)).toEqual([
      'USR-001',
      'USR-002',
      'USR-003',
      'USR-004',
    ]);
    expect(list.find((p) => p.id === id)?.example).toBe(false);
  });

  it('exporta el perfil en el formato de datos/perfiles.json (RNF-11)', async () => {
    const service = createProfileService();
    await service.ready;
    const raw = service.exportRaw();
    expect(raw.nombre).toBe('Diego');
    expect(raw.explicito.alergias).toEqual(['mani']);
  });
});

describe('crear perfil (CA-22.3)', () => {
  it('crea un perfil neutro, lo selecciona y no toca a Diego', async () => {
    const service = createProfileService();
    await service.ready;
    const diegoBefore = service.getProfile();
    const id = await service.createProfile('  Lucía  ');

    const created = service.getProfile();
    expect(created.id).toBe(id);
    expect(created.name).toBe('Lucía');
    expect(created.explicit.allergies).toEqual([]);
    expect(created.pantry).toEqual([]);
    expect(created.history).toEqual([]);
    expect(created.learned.likes).toEqual([]);
    expect(created.learned.dislikes).toEqual([]);
    expect(created.learned.frequentExplanations ?? []).toEqual([]);

    await service.selectProfile('USR-002');
    expect(service.getProfile()).toEqual(diegoBefore);
  });

  it('los cambios posteriores se guardan en el perfil nuevo, no en Diego', async () => {
    const service = createProfileService();
    await service.ready;
    const id = await service.createProfile('Lucía');
    await service.update((p) => ({
      ...p,
      accessibility: { ...p.accessibility, fontSize: 'extragrande' },
      pantry: ['quinua'],
    }));
    expect(service.getProfile().accessibility.fontSize).toBe('extragrande');
    await service.selectProfile('USR-002');
    expect(service.getProfile().accessibility.fontSize).toBe('normal');
    expect(service.getProfile().pantry).not.toContain('quinua');
    await service.selectProfile(id);
    expect(service.getProfile().pantry).toEqual(['quinua']);
  });

  it('lo guarda y lo conserva como perfil actual en la siguiente sesión', async () => {
    const first = createProfileService();
    await first.ready;
    const id = await first.createProfile('Lucía');

    const second = createProfileService();
    await second.ready;
    expect(second.getProfile().id).toBe(id);
    expect(second.getProfile().name).toBe('Lucía');
    expect(second.listProfiles().map((p) => p.id)).toEqual(
      expect.arrayContaining(['USR-001', 'USR-002', 'USR-003', 'USR-004', id]),
    );
  });

  it('genera ids únicos que no chocan con los existentes', async () => {
    const service = createProfileService();
    await service.ready;
    const a = await service.createProfile('Ana');
    const b = await service.createProfile('Beto');
    const ids = service.listProfiles().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^USR-\d+$/);
  });

  it('notifica a quien escucha al crear', async () => {
    const service = createProfileService();
    await service.ready;
    let calls = 0;
    service.subscribe(() => calls++);
    await service.createProfile('Lucía');
    expect(calls).toBe(1);
  });

  it('valida el nombre: no vacío, con largo máximo y sin repetir (sin importar mayúsculas)', async () => {
    const service = createProfileService();
    await service.ready;
    await expect(service.createProfile('   ')).rejects.toThrow('Escribe tu nombre');
    await expect(service.createProfile('x'.repeat(PROFILE_NAME_MAX_LENGTH + 1))).rejects.toThrow(
      'hasta',
    );
    await service.createProfile('Lucía');
    await service.createProfile('Ana');
    // Es otro perfil propio, no el activo: se rechaza sin importar mayúsculas ni espacios.
    await expect(service.createProfile('  lucía ')).rejects.toThrow('Ya existe');
    expect(service.listProfiles()).toHaveLength(6);
    expect(service.getProfile().name).toBe('Ana');
  });

  it('el nombre de un perfil de ejemplo está permitido y no toca al de ejemplo', async () => {
    const service = createProfileService();
    await service.ready;
    const id = await service.createProfile('dIEGO');
    expect(id).toMatch(/^USR-1\d\d$/);
    expect(service.getProfile().name).toBe('dIEGO');
    expect(service.listProfiles()).toHaveLength(5);
    await service.selectProfile('USR-002');
    expect(service.getProfile().name).toBe('Diego');
    expect(service.getProfile().explicit.allergies).toEqual(['mani']);
  });

  it('repetir el nombre del perfil propio activo lo reutiliza sin crear otro', async () => {
    const service = createProfileService();
    await service.ready;
    const id = await service.createProfile('Lucía');
    expect(await service.createProfile('  lucía ')).toBe(id);
    expect(service.listProfiles()).toHaveLength(5);
    expect(service.getProfile().id).toBe(id);
    // Otro nombre sí crea un perfil nuevo.
    expect(await service.createProfile('Ana')).not.toBe(id);
    expect(service.listProfiles()).toHaveLength(6);
  });

  it('con un perfil de ejemplo activo, su nombre no se reutiliza: se crea uno propio', async () => {
    const service = createProfileService();
    await service.ready;
    await service.selectProfile('USR-002');
    expect(await service.createProfile('Diego')).not.toBe('USR-002');
    expect(service.listProfiles()).toHaveLength(5);
  });

  it('funciona en memoria sin IndexedDB', async () => {
    globalThis.indexedDB = undefined as unknown as IDBFactory;
    const service = createProfileService();
    await service.ready;
    const id = await service.createProfile('Lucía');
    expect(service.getProfile().id).toBe(id);
  });

  it('reset vuelve a los perfiles de prueba y deja un perfil actual válido', async () => {
    const service = createProfileService();
    await service.ready;
    const id = await service.createProfile('Lucía');
    await service.reset();
    expect(service.listProfiles().some((p) => p.id === id)).toBe(false);
    expect(service.getProfile().id).toBe('USR-002');

    const next = createProfileService();
    await next.ready;
    expect(next.getProfile().id).toBe('USR-002');
    expect(next.listProfiles().some((p) => p.id === id)).toBe(false);
  });
});

describe('comandos del perfil', () => {
  it('"tengo papa, pollo y ají amarillo" agrega a la despensa y lo avisa (CA-03.1)', async () => {
    const service = createProfileService();
    await service.ready;
    const notices: string[] = [];
    service.onNotice((m) => notices.push(m));
    commandBus.emit({ type: 'addPantry', items: ['papa', 'pollo', 'ají amarillo'] }, 'voice');
    await vi.waitFor(() => expect(notices).toHaveLength(1));
    expect(service.getProfile().pantry).toEqual(expect.arrayContaining(['papa', 'pollo']));
    expect(notices[0]).toBe('Agregué papa, pollo y ají amarillo a tu despensa.');
  });

  it('"estoy nervioso" registra la emoción (CA-24.3)', async () => {
    const service = createProfileService();
    await service.ready;
    commandBus.emit({ type: 'feeling', feeling: 'nervous' }, 'voice');
    await vi.waitFor(() =>
      expect(service.getProfile().emotional.lastFeeling?.feeling).toBe('nervous'),
    );
  });
});
