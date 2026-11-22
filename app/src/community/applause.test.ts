// Aviso de aplausos nuevos en lo propio al entrar a la Comunidad (CA-29.2).

import { beforeEach, describe, expect, it } from 'vitest';
import type { CommunityPost } from '@chef/shared';
import { applauseNotice, markApplauseSeen, newApplause } from './applause';
import {
  COMMUNITY_STORAGE_KEYS,
  clearCommunityData,
  getSeenApplause,
  setSeenApplause,
} from './storage';

function post(id: string, applause: number, recipeName = `Plato ${id}`): CommunityPost {
  return {
    id,
    kind: 'achievement',
    alias: 'Yo',
    recipeId: 'REC-001',
    recipeName,
    createdAt: '2026-11-20T18:00:00.000Z',
    applause,
    comments: [],
  };
}

const own = new Set(['A', 'B']);
const none = new Set<string>();

beforeEach(() => localStorage.clear());

describe('aplausos nuevos en lo que publiqué', () => {
  it('lo propio sin visitas previas cuenta todos sus aplausos (CA-29.2)', () => {
    expect(newApplause([post('A', 3, 'Ají de gallina')], own, none, {})).toEqual([
      { postId: 'A', recipeName: 'Ají de gallina', count: 3 },
    ]);
  });

  it('solo cuenta lo que llegó después de la última vez (CA-29.2)', () => {
    const items = newApplause([post('A', 5), post('B', 2)], own, none, { A: 3, B: 2 });
    expect(items).toEqual([{ postId: 'A', recipeName: 'Plato A', count: 2 }]);
  });

  it('las publicaciones de otras personas no se avisan (CA-29.2)', () => {
    expect(newApplause([post('Z', 9)], own, none, {})).toEqual([]);
  });

  it('mi propio aplauso a mi publicación no cuenta (CA-29.2)', () => {
    expect(newApplause([post('A', 1)], own, new Set(['A']), {})).toEqual([]);
    expect(newApplause([post('A', 2)], own, new Set(['A']), {})).toEqual([
      { postId: 'A', recipeName: 'Plato A', count: 1 },
    ]);
  });

  it('si el conteo baja no avisa nada y se guarda el nuevo valor (CA-29.2)', () => {
    expect(newApplause([post('A', 1)], own, none, { A: 4 })).toEqual([]);
    expect(markApplauseSeen([post('A', 1)], own, none)).toEqual({ A: 1 });
  });

  it('lo visto solo guarda las publicaciones propias que siguen existiendo (CA-29.2)', () => {
    expect(markApplauseSeen([post('A', 2), post('Z', 7)], own, none)).toEqual({ A: 2 });
  });
});

describe('frase del aviso', () => {
  it('una publicación dice cuál y cuántos aplausos (CA-29.2)', () => {
    expect(applauseNotice([{ postId: 'A', recipeName: 'Ají de gallina', count: 1 }])).toBe(
      'Tu publicación «Ají de gallina» recibió 1 aplauso nuevo.',
    );
    expect(applauseNotice([{ postId: 'A', recipeName: 'Ají de gallina', count: 3 }])).toBe(
      'Tu publicación «Ají de gallina» recibió 3 aplausos nuevos.',
    );
  });

  it('varias publicaciones suman los aplausos (CA-29.2)', () => {
    expect(
      applauseNotice([
        { postId: 'A', recipeName: 'Uno', count: 1 },
        { postId: 'B', recipeName: 'Dos', count: 2 },
      ]),
    ).toBe('Tus publicaciones recibieron 3 aplausos nuevos.');
  });

  it('sin aplausos nuevos no hay aviso (CA-29.2)', () => {
    expect(applauseNotice([])).toBeUndefined();
  });
});

describe('aplausos vistos en el dispositivo', () => {
  it('se guardan y se leen (CA-29.2)', () => {
    setSeenApplause({ A: 2 });
    expect(getSeenApplause()).toEqual({ A: 2 });
  });

  it('un dato dañado se toma como vacío (CA-29.2)', () => {
    localStorage.setItem(COMMUNITY_STORAGE_KEYS.seenApplause, '{no es json');
    expect(getSeenApplause()).toEqual({});
    localStorage.setItem(COMMUNITY_STORAGE_KEYS.seenApplause, '[1,2]');
    expect(getSeenApplause()).toEqual({});
    localStorage.setItem(COMMUNITY_STORAGE_KEYS.seenApplause, '{"A":2,"B":"x"}');
    expect(getSeenApplause()).toEqual({ A: 2 });
  });

  it('borrar mis datos también los borra (CA-25.3)', () => {
    setSeenApplause({ A: 2 });
    clearCommunityData();
    expect(getSeenApplause()).toEqual({});
  });
});
