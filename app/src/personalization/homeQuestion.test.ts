import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import { toProfile, toRecipes, type RawProfileBook, type RawRecipeBook } from '@chef/shared';
import { answerHomeQuestion, isPantryQuestion, suggestRecipes } from './index';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const profile = (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile)[1]!;

describe('preguntas por voz en Inicio', () => {
  it.each([
    'pregunta, ¿qué puedo cocinar con lo que tengo?',
    'Qué cocino hoy',
    'que puedo preparar',
    'recomiéndame algo',
    'que puedo cocinar',
    'qué se puede cocinar',
    'qué receta puedo hacer',
    'dame ideas para comer',
  ])('reconoce "%s" como pregunta por la despensa', (question) => {
    expect(isPantryQuestion(question)).toBe(true);
  });

  it('responde con las recetas sugeridas que usan la despensa', () => {
    const withPantry = { ...profile, pantry: ['arroz', 'huevo', 'cebolla'] };
    const suggested = suggestRecipes(recipes, withPantry).recipes;
    const answer = answerHomeQuestion('qué puedo cocinar con lo que tengo', suggested, withPantry);
    expect(answer.text).toMatch(/^Con lo que tienes puedes cocinar /);
    expect(answer.text).toContain(suggested[0]!.name);
    expect(answer.text).toMatch(/usa \d+ de sus \d+ ingredientes/);
  });

  it('con la despensa vacía explica cómo llenarla', () => {
    const empty = { ...profile, pantry: [] };
    const answer = answerHomeQuestion('qué puedo cocinar', recipes.slice(0, 3), empty);
    expect(answer.text).toMatch(/despensa está vacía/);
  });

  it('otra pregunta no queda en silencio: dice qué se puede pedir aquí', () => {
    const answer = answerHomeQuestion('cuántas calorías tiene el arroz', recipes, profile);
    expect(answer.text).toMatch(/^Escuché «cuántas calorías tiene el arroz»\. Aquí puedo buscar/);
  });

  it.each(['cuántas calorías tiene el arroz', 'cómo está el clima', 'qué hora es'])(
    'no confunde "%s" con pedir una sugerencia',
    (question) => {
      expect(isPantryQuestion(question)).toBe(false);
    },
  );
});
