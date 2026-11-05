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
import { applyUsageEvent, BRIEF_READING_NOTICE, createLearningSession } from './learning';

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

  it('registra la emoción declarada (CA-24.3)', () => {
    const { profile } = run(carmen, [{ type: 'feelingDeclared', feeling: 'nervous' }]);
    expect(profile.emotional.lastFeeling).toEqual({ feeling: 'nervous', date: DATE });
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
