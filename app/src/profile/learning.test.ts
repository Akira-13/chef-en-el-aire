import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import {
  toProfile,
  toRecipes,
  type Profile,
  type RawProfileBook,
  type RawRecipeBook,
} from '@chef/shared';
import type { UsageEvent } from '../core/contracts';
import { proposeSubstitutions, substituteFor } from '../personalization';
import { describeLearned, forgetLearned, learnedKey } from './learned';
import { currentFeeling } from './feeling';
import {
  applyUsageEvent,
  BRIEF_READING_NOTICE,
  createLearningSession,
  INFERRED_FEELING_NOTICE,
} from './learning';

const profiles = (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile);
const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const carmen = profiles.find((p) => p.name === 'Carmen')!;
const rosa = profiles.find((p) => p.name === 'Rosa')!;
const DATE = '2026-10-05';

function run(profile: Profile, events: UsageEvent[]) {
  const session = createLearningSession();
  const notices: string[] = [];
  let current = profile;
  for (const event of events) {
    const result = applyUsageEvent(current, event, DATE, session);
    current = result.profile;
    if (result.notice) notices.push(result.notice);
  }
  return { profile: current, notices };
}

const skip = (recipeId: string, stepNumber = 1): UsageEvent => ({
  type: 'readingSkipped',
  recipeId,
  stepNumber,
});

describe('aprendizaje con el uso', () => {
  it('tras saltar la lectura en 3 recetas seguidas lee solo lo breve y lo avisa (CA-24.1)', () => {
    expect(carmen.accessibility.verbosity).toBe('detallada');
    const { profile, notices } = run(carmen, [
      skip('REC-003'),
      skip('REC-003', 2),
      skip('REC-006'),
      skip('REC-007'),
    ]);
    expect(profile.learned.skipsFullReading).toBe(true);
    expect(profile.accessibility.verbosity).toBe('breve');
    expect(notices).toEqual([BRIEF_READING_NOTICE]);
  });

  it('una receta terminada sin saltar la lectura corta la racha (CA-24.1)', () => {
    const { profile, notices } = run(carmen, [
      skip('REC-003'),
      skip('REC-006'),
      { type: 'recipeCompleted', recipeId: 'REC-007', substitutions: [] },
      skip('REC-004'),
    ]);
    expect(profile.learned.skipsFullReading).toBeFalsy();
    expect(profile.accessibility.verbosity).toBe('detallada');
    expect(notices).toEqual([]);
  });

  it('la sustitución aceptada se guarda sin duplicar y se propone primero (CA-24.2)', () => {
    const accepted: UsageEvent = {
      type: 'substitutionAccepted',
      recipeId: 'REC-007',
      ingredientId: 'ING-042',
      original: 'leche evaporada',
      substitute: 'bebida de coco',
    };
    const { profile } = run(carmen, [accepted, accepted]);
    expect(profile.learned.acceptedSubstitutions).toEqual([
      { original: 'leche evaporada', substitute: 'bebida de coco' },
    ]);
    // En otra receta con leche evaporada, lo aceptado va antes que el sustituto del recetario.
    const leche = recipes.find((r) => r.id === 'REC-001')!.ingredients[5]!;
    expect(leche.name).toBe('leche evaporada');
    expect(substituteFor(leche, profile)?.name).toBe('bebida de coco');
  });

  it('la sustitución rechazada no se vuelve a proponer primero (CA-24.2)', () => {
    const { profile } = run(rosa, [
      {
        type: 'substitutionRejected',
        recipeId: 'REC-001',
        ingredientId: 'ING-006',
        original: 'leche evaporada',
        substitute: 'caldo de pollo + 2 cda de maicena',
      },
    ]);
    expect(profile.learned.acceptedSubstitutions).toHaveLength(0);
    expect(profile.learned.rejectedSubstitutions).toHaveLength(1);
    const proposals = proposeSubstitutions(
      recipes.find((r) => r.id === 'REC-001')!,
      profile,
    );
    expect(proposals.find((p) => p.ingredientId === 'ING-006')).toBeUndefined();
  });

  it('un paso repetido 3 veces queda como difícil (CA-24.3)', () => {
    const repeat: UsageEvent = { type: 'stepRepeated', recipeId: 'REC-001', stepNumber: 4 };
    expect(run(carmen, [repeat, repeat]).profile.learned.difficultSteps ?? []).toHaveLength(0);
    const { profile } = run(carmen, [repeat, repeat, repeat, repeat]);
    expect(profile.learned.difficultSteps).toEqual([{ recipeId: 'REC-001', stepNumber: 4 }]);
  });

  it('registra la emoción declarada con su origen y hora (CA-24.3)', () => {
    const { profile } = run(carmen, [{ type: 'feelingDeclared', feeling: 'nervous' }]);
    expect(profile.emotional.lastFeeling).toEqual({
      feeling: 'nervous',
      date: DATE,
      source: 'declared',
      at: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(profile.emotional.lastFeeling!.at!))).toBe(false);
  });

  it('lo explícito nunca se sobrescribe', () => {
    const { profile } = run(rosa, [
      skip('REC-001'),
      skip('REC-003'),
      skip('REC-007'),
      { type: 'feelingDeclared', feeling: 'tired' },
      {
        type: 'substitutionAccepted',
        recipeId: 'REC-001',
        ingredientId: 'ING-008',
        original: 'queso parmesano rallado',
        substitute: 'levadura nutricional',
      },
    ]);
    expect(profile.explicit).toBe(rosa.explicit);
  });

  it('guarda el valor de cada calificación en el historial (CA-26.1)', () => {
    const { profile } = run(carmen, [
      { type: 'recipeCompleted', recipeId: 'REC-004', substitutions: [] },
      { type: 'recipeRated', recipeId: 'REC-004', rating: 5 },
    ]);
    expect(profile.history.at(-1)).toMatchObject({ recipeId: 'REC-004', rating: 5, date: DATE });
  });
});

describe('lo que aprendí de ti', () => {
  it('lista cada dato aprendido con su origen (CA-25.1)', () => {
    const { profile } = run(carmen, [
      {
        type: 'substitutionAccepted',
        recipeId: 'REC-001',
        ingredientId: 'ING-006',
        original: 'leche evaporada',
        substitute: 'caldo de pollo + 2 cda de maicena',
      },
    ]);
    const items = describeLearned(profile);
    const substitution = items.find((i) => i.key.startsWith('acceptedSubstitutions:'));
    expect(substitution?.origin).toBe('aceptaste esta sustitución el 5/10');
    expect(items.map((i) => i.label)).toContain('Te gusta: sopas');
  });

  it('un dato borrado desaparece y no vuelve a usarse (CA-25.2)', () => {
    const key = learnedKey.accepted(rosa.learned.acceptedSubstitutions[0]!);
    const profile = forgetLearned(rosa, key);
    expect(describeLearned(profile).some((i) => i.key === key)).toBe(false);
    expect(profile.learned.acceptedSubstitutions).toHaveLength(0);
    expect(profile.explicit).toBe(rosa.explicit);
    expect(profile.accessibility).toBe(rosa.accessibility);
  });

  it('borrar un gusto lo quita de las sugerencias', () => {
    const profile = forgetLearned(carmen, learnedKey.like('sopas'));
    expect(profile.learned.likes).toEqual(['arroz con pollo']);
  });
});

describe('emoción inferida', () => {
  const START = new Date('2026-11-16T15:00:00.000Z');
  const repeat: UsageEvent = { type: 'stepRepeated', recipeId: 'REC-001', stepNumber: 4 };
  const failed: UsageEvent = { type: 'commandFailed', channel: 'voice' };
  const declared: UsageEvent = { type: 'feelingDeclared', feeling: 'nervous' };

  /** Aplica cada evento a los `seconds` indicados desde START. */
  function runAt(profile: Profile, events: [UsageEvent, number][]) {
    const session = createLearningSession();
    const notices: string[] = [];
    let current = profile;
    for (const [event, seconds] of events) {
      const now = new Date(START.getTime() + seconds * 1000);
      const result = applyUsageEvent(current, event, DATE, session, now);
      current = result.profile;
      if (result.notice) notices.push(result.notice);
    }
    return { profile: current, notices };
  }

  it('repetir 3 veces un paso infiere confusión y lo avisa (CA-24.3)', () => {
    const { profile, notices } = runAt(carmen, [
      [repeat, 0],
      [repeat, 10],
      [repeat, 20],
      [repeat, 30],
    ]);
    expect(profile.emotional.lastFeeling).toEqual({
      feeling: 'confused',
      date: DATE,
      source: 'inferred',
      at: '2026-11-16T15:00:20.000Z',
    });
    expect(notices).toEqual([INFERRED_FEELING_NOTICE]);
    expect(profile.learned.difficultSteps).toEqual([{ recipeId: 'REC-001', stepNumber: 4 }]);
    expect(profile.learned.origins?.find((o) => o.key === learnedKey.lastFeeling())).toEqual({
      key: 'lastFeeling',
      event: 'stepRepeated',
      date: DATE,
      detail: 'repetiste el paso 4 tres veces',
    });
  });

  it('también infiere si el paso ya era difícil de antes (CA-24.3)', () => {
    const known: Profile = {
      ...carmen,
      learned: { ...carmen.learned, difficultSteps: [{ recipeId: 'REC-001', stepNumber: 4 }] },
    };
    const { profile, notices } = runAt(known, [
      [repeat, 0],
      [repeat, 10],
      [repeat, 20],
    ]);
    expect(profile.emotional.lastFeeling?.source).toBe('inferred');
    expect(notices).toEqual([INFERRED_FEELING_NOTICE]);
    expect(profile.learned.difficultSteps).toHaveLength(1);
  });

  it('2 órdenes no entendidas en menos de 60 s infieren confusión (RF-42)', () => {
    const { profile, notices } = runAt(carmen, [
      [failed, 0],
      [failed, 59],
    ]);
    expect(profile.emotional.lastFeeling).toMatchObject({
      feeling: 'confused',
      source: 'inferred',
    });
    expect(notices).toEqual([INFERRED_FEELING_NOTICE]);
    expect(profile.learned.origins?.at(-1)).toMatchObject({
      event: 'commandFailed',
      detail: 'no te entendí 2 veces seguidas en menos de un minuto',
    });
  });

  it('2 órdenes no entendidas separadas por 60 s o más no infieren nada (RF-42)', () => {
    const { profile, notices } = runAt(carmen, [
      [failed, 0],
      [failed, 60],
      [failed, 150],
    ]);
    expect(profile.emotional.lastFeeling).toBeUndefined();
    expect(notices).toEqual([]);
  });

  it('una emoción declarada hace menos de 30 min no se pisa (RF-42)', () => {
    const { profile, notices } = runAt(carmen, [
      [declared, 0],
      [repeat, 60],
      [repeat, 70],
      [repeat, 80],
      [failed, 90],
      [failed, 100],
    ]);
    expect(profile.emotional.lastFeeling).toMatchObject({ feeling: 'nervous', source: 'declared' });
    expect(notices).toEqual([]);
    // El paso difícil se registra igual (CA-24.3).
    expect(profile.learned.difficultSteps).toEqual([{ recipeId: 'REC-001', stepNumber: 4 }]);
  });

  it('una emoción declarada hace 30 min o más ya no impide inferir (RF-42)', () => {
    const { profile, notices } = runAt(carmen, [
      [declared, 0],
      [failed, 30 * 60],
      [failed, 30 * 60 + 5],
    ]);
    expect(profile.emotional.lastFeeling?.source).toBe('inferred');
    expect(notices).toEqual([INFERRED_FEELING_NOTICE]);
  });

  it('una emoción guardada sin hora no está vigente y se puede inferir encima (RF-42)', () => {
    const old: Profile = {
      ...carmen,
      emotional: { ...carmen.emotional, lastFeeling: { feeling: 'happy', date: '2026-10-05' } },
    };
    expect(currentFeeling(old, START)).toBeUndefined();
    const { profile } = runAt(old, [
      [failed, 0],
      [failed, 1],
    ]);
    expect(profile.emotional.lastFeeling?.source).toBe('inferred');
  });

  it('no repite el aviso mientras la emoción inferida sigue vigente (RF-42)', () => {
    const { notices } = runAt(carmen, [
      [failed, 0],
      [failed, 5],
      [failed, 10],
      [failed, 15],
      [repeat, 20],
      [repeat, 25],
      [repeat, 30],
    ]);
    expect(notices).toEqual([INFERRED_FEELING_NOTICE]);
  });

  it('la emoción vigente dura 30 minutos (CA-33.2)', () => {
    const { profile } = runAt(carmen, [[declared, 0]]);
    const at = (minutes: number) => new Date(START.getTime() + minutes * 60 * 1000);
    expect(currentFeeling(profile, at(29))?.feeling).toBe('nervous');
    expect(currentFeeling(profile, at(30))).toBeUndefined();
  });

  it('"Lo que aprendí de ti" dice que la inferí y por qué, y se puede borrar (CA-25.2)', () => {
    const { profile } = runAt(carmen, [
      [repeat, 0],
      [repeat, 10],
      [repeat, 20],
    ]);
    const item = describeLearned(profile).find((i) => i.key === learnedKey.lastFeeling());
    expect(item?.label).toBe('Lo inferí: te noté con dudas');
    expect(item?.origin).toBe('repetiste el paso 4 tres veces el 5/10');

    const forgotten = forgetLearned(profile, learnedKey.lastFeeling());
    expect(forgotten.emotional.lastFeeling).toBeUndefined();
    expect(forgotten.learned.origins?.some((o) => o.key === learnedKey.lastFeeling())).toBe(false);
    expect(describeLearned(forgotten).some((i) => i.key === learnedKey.lastFeeling())).toBe(false);
  });

  it('la declarada se sigue mostrando como dicha por la persona (CA-24.3)', () => {
    const { profile } = runAt(carmen, [[declared, 0]]);
    const item = describeLearned(profile).find((i) => i.key === learnedKey.lastFeeling());
    expect(item?.label).toBe('La última vez dijiste que estabas nervioso o nerviosa');
  });
});
