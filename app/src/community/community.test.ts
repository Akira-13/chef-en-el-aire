import { beforeEach, describe, expect, it } from 'vitest';
import type { CommunityPost, RecipeChange } from '@chef/shared';
import { toCommunityChanges } from './changes';
import { feedItems, newForeignItems, visibleDelayMs } from './feedDiff';
import { describePost, formatDate, suggestAlias } from './format';
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

describe('cambios publicados', () => {
  const changes: RecipeChange[] = [
    {
      kind: 'ingredient',
      target: 'ING-003',
      before: 'maní',
      after: 'pecanas',
      reason: 'Alergia al maní',
    },
    { kind: 'step', target: '2', before: 'Licúa con maní', after: 'Licúa con pecanas', reason: '' },
  ];

  it('sin "Mostrar motivos" solo viaja el antes y el después (CA-27.2)', () => {
    const published = toCommunityChanges(changes, false);
    expect(published).toEqual([
      { kind: 'ingredient', before: 'maní', after: 'pecanas' },
      { kind: 'step', before: 'Licúa con maní', after: 'Licúa con pecanas' },
    ]);
    expect(JSON.stringify(published)).not.toContain('Alergia');
  });

  it('con "Mostrar motivos" incluye los motivos que existen (RF-34)', () => {
    const published = toCommunityChanges(changes, true);
    expect(published[0]).toHaveProperty('reason', 'Alergia al maní');
    expect(published[1]).not.toHaveProperty('reason');
  });
});

describe('medición de lo ajeno (RNF-09)', () => {
  const post = (id: string, alias: string, comments: CommunityPost['comments'] = []) =>
    ({
      id,
      kind: 'recipe',
      alias,
      recipeId: 'REC-001',
      recipeName: 'Ají de gallina',
      createdAt: '2026-11-21T10:00:00.000Z',
      applause: 0,
      comments,
    }) as CommunityPost;
  const comment = (id: string, alias: string) => ({
    id,
    alias,
    text: 'Rico',
    createdAt: '2026-11-21T10:00:02.000Z',
  });

  it('solo cuenta publicaciones y comentarios ajenos que no se habían visto (CA-28.2)', () => {
    const posts = [
      post('PUB-2', 'Otra', [comment('COM-2', 'Yo'), comment('COM-3', 'Otra')]),
      post('PUB-1', 'Otra', [comment('COM-1', 'Otra')]),
    ];
    const seen = new Set(['PUB-1', 'COM-1']);
    const isOwn = (item: { alias: string }) => item.alias === 'Yo';
    expect(newForeignItems(posts, seen, isOwn).map((i) => i.id)).toEqual(['PUB-2', 'COM-3']);
    expect(feedItems(posts)).toHaveLength(5);
  });

  it('el retraso usa la hora del servidor y nunca es negativo (CA-28.2)', () => {
    const now = Date.parse('2026-11-21T10:00:05.000Z');
    // El teléfono va 2 s atrasado respecto del servidor.
    expect(visibleDelayMs('2026-11-21T10:00:04.000Z', 2000, now)).toBe(3000);
    expect(visibleDelayMs('2026-11-21T10:00:09.000Z', 0, now)).toBe(0);
    expect(visibleDelayMs('no es fecha', 0, now)).toBe(0);
  });
});

describe('textos de la Comunidad', () => {
  it('muestra las fechas como dd/mm/aaaa (CA-27.3)', () => {
    expect(formatDate('2026-03-05T15:00:00')).toBe('05/03/2026');
    expect(formatDate('basura')).toBe('');
  });

  it('"dónde estoy" lee la publicación y sus últimos 3 comentarios (RF-36)', () => {
    const post = {
      id: 'PUB-1',
      kind: 'achievement',
      alias: 'Sazón 1234',
      recipeId: 'REC-001',
      recipeName: 'Ají de gallina',
      createdAt: '2026-11-21T10:00:00.000Z',
      rating: 'up',
      applause: 1,
      comments: ['uno', 'dos', 'tres', 'cuatro'].map((text, i) => ({
        id: `COM-${i}`,
        alias: 'Otra',
        text,
        createdAt: '2026-11-21T10:00:00.000Z',
      })),
    } as CommunityPost;
    const text = describePost(post, 2, 5);
    expect(text).toContain('Publicación 2 de 5: Ají de gallina, plato terminado de Sazón 1234.');
    expect(text).toContain('Le gustó.');
    expect(text).toContain('1 aplauso.');
    expect(text).not.toContain('uno');
    expect(text).toContain('Otra dijo: cuatro');
  });

  it('el alias sugerido es válido y no usa el nombre (RF-33)', () => {
    const alias = suggestAlias(() => 0.5);
    expect(alias).toBe('Sazón 5500');
    expect(validateAlias(alias, 'Rosa').ok).toBe(true);
  });
});
