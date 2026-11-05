import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { metrics } from '../core/metrics';
import { createProfileService } from './index';

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

  it('exporta el perfil en el formato de datos/perfiles.json (RNF-11)', async () => {
    const service = createProfileService();
    await service.ready;
    const raw = service.exportRaw();
    expect(raw.nombre).toBe('Diego');
    expect(raw.explicito.alergias).toEqual(['mani']);
  });
});
