import { beforeEach, describe, expect, it } from 'vitest';
import { ALIAS_MAX_LENGTH, validateAlias } from './alias';
import { getDeviceKey, newClientId } from './device';
import { COMMUNITY_STORAGE_KEYS, addOwnPostId, clearCommunityData, getOwnPostIds } from './storage';

beforeEach(() => localStorage.clear());

describe('alias de la Comunidad', () => {
  it('recorta los espacios y acepta hasta 30 caracteres (RF-33)', () => {
    expect(validateAlias('  La  Sazón de Lima ', 'Diego')).toEqual({
      ok: true,
      alias: 'La Sazón de Lima',
    });
    expect(validateAlias('a'.repeat(ALIAS_MAX_LENGTH), 'Diego').ok).toBe(true);
    expect(validateAlias('a'.repeat(ALIAS_MAX_LENGTH + 1), 'Diego').ok).toBe(false);
  });

  it('no acepta un alias vacío (RF-33)', () => {
    expect(validateAlias('   ', 'Diego')).toEqual({ ok: false, error: 'Escribe un alias.' });
  });

  it('no acepta el nombre real, aunque cambien mayúsculas o tildes (RF-33)', () => {
    expect(validateAlias('diego', 'Diego').ok).toBe(false);
    expect(validateAlias('Chef Diego', 'Diego').ok).toBe(false);
    expect(validateAlias('Ramon', 'Ramón').ok).toBe(false);
    expect(validateAlias('Diegol', 'Diego').ok).toBe(true);
  });
});

describe('datos de la Comunidad en el dispositivo', () => {
  it('la clave del dispositivo se genera una vez y es estable (RNF-11)', () => {
    const key = getDeviceKey();
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDeviceKey()).toBe(key);
    expect(localStorage.getItem(COMMUNITY_STORAGE_KEYS.deviceKey)).toBe(key);
  });

  it('cada id de cliente es distinto (RNF-09)', () => {
    expect(newClientId()).not.toBe(newClientId());
  });

  it('recuerda las publicaciones propias sin repetirlas', () => {
    addOwnPostId('p1');
    addOwnPostId('p2');
    addOwnPostId('p1');
    expect(getOwnPostIds()).toEqual(['p1', 'p2']);
  });

  it('ignora una lista de propias dañada', () => {
    localStorage.setItem(COMMUNITY_STORAGE_KEYS.ownPosts, '{no es json');
    expect(getOwnPostIds()).toEqual([]);
  });

  it('borrar elimina la clave, las propias y la cola, y la próxima clave es otra (CA-25.3)', () => {
    const key = getDeviceKey();
    addOwnPostId('p1');
    localStorage.setItem(COMMUNITY_STORAGE_KEYS.queue, '[]');
    localStorage.setItem('chef.timers', 'otro dato');

    clearCommunityData();

    for (const storageKey of Object.values(COMMUNITY_STORAGE_KEYS)) {
      expect(localStorage.getItem(storageKey)).toBeNull();
    }
    expect(localStorage.getItem('chef.timers')).toBe('otro dato');
    expect(getDeviceKey()).not.toBe(key);
  });
});
