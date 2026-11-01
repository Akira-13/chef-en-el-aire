import { describe, expect, it } from 'vitest';
import { toRawRecipe } from '@chef/shared';
import { getRecipe } from '../data/recipes';
import { AdaptationParseError, parseAdaptation, parseAnswer, parseExplanation } from './parser';

const original = getRecipe('REC-008')!;

function validResponse() {
  const raw = toRawRecipe(original);
  return {
    receta: {
      ...raw,
      ingredientes: raw.ingredientes.filter((i) => i.id !== 'ING-050'),
    },
    cambios: [
      {
        tipo: 'ingrediente',
        objetivo: 'ING-050',
        antes: 'maní tostado',
        despues: 'semillas de zapallo tostadas',
        motivo: 'alergia al maní',
      },
    ],
  };
}

describe('parseAdaptation', () => {
  it('convierte un JSON válido a Recipe y cambios en inglés (CA-04.3)', () => {
    const { recipe, changes } = parseAdaptation(JSON.stringify(validResponse()));
    expect(recipe.id).toBe('REC-008');
    expect(recipe.ingredients.some((i) => i.id === 'ING-050')).toBe(false);
    expect(recipe.steps[0]?.number).toBe(1);
    expect(changes).toEqual([
      {
        kind: 'ingredient',
        target: 'ING-050',
        before: 'maní tostado',
        after: 'semillas de zapallo tostadas',
        reason: 'alergia al maní',
      },
    ]);
  });

  it('quita las cercas de código Markdown (CA-04.3)', () => {
    const text = '```json\n' + JSON.stringify(validResponse()) + '\n```';
    expect(parseAdaptation(text).recipe.id).toBe('REC-008');
    expect(
      parseAdaptation('```\n' + JSON.stringify(validResponse()) + '\n```').changes,
    ).toHaveLength(1);
  });

  it('tolera texto alrededor del objeto JSON (CA-04.3)', () => {
    const text = `Aquí tienes la receta:\n${JSON.stringify(validResponse())}\nListo.`;
    expect(parseAdaptation(text).recipe.id).toBe('REC-008');
  });

  it('acepta cambios de paso y de porciones, y objetivos numéricos (CA-04.3)', () => {
    const response = validResponse();
    response.cambios = [
      { tipo: 'paso', objetivo: 3 as unknown as string, antes: 'a', despues: 'b', motivo: 'm' },
      {
        tipo: 'porciones',
        objetivo: undefined as unknown as string,
        antes: '4',
        despues: '2',
        motivo: 'm',
      },
    ];
    const { changes } = parseAdaptation(JSON.stringify(response));
    expect(changes.map((c) => c.kind)).toEqual(['step', 'servings']);
    expect(changes[0]?.target).toBe('3');
    expect(changes[1]?.target).toBeUndefined();
  });

  it('trata un tipo de cambio nulo o ausente como ingrediente (CA-04.3)', () => {
    const response = validResponse();
    const base = response.cambios[0]!;
    response.cambios = [
      { ...base, tipo: null as unknown as string },
      { ...base, tipo: undefined as unknown as string },
    ];
    const { changes } = parseAdaptation(JSON.stringify(response));
    expect(changes.map((c) => c.kind)).toEqual(['ingredient', 'ingredient']);
  });

  it('trata un tipo de cambio desconocido como ingrediente y acepta los nombres en inglés (CA-04.3)', () => {
    const response = validResponse();
    const base = response.cambios[0]!;
    response.cambios = [
      { ...base, tipo: 'sustitucion' },
      { ...base, tipo: 'step' },
      { ...base, tipo: 'servings' },
      { ...base, tipo: 'ingredient' },
    ];
    const { changes } = parseAdaptation(JSON.stringify(response));
    expect(changes.map((c) => c.kind)).toEqual(['ingredient', 'step', 'servings', 'ingredient']);
  });

  it('ignora categorías de alérgeno desconocidas en vez de fallar (CA-04.3)', () => {
    const response = validResponse();
    response.receta.ingredientes[0]!.alergenos = ['sesamo' as never, 'gluten'];
    const { recipe } = parseAdaptation(JSON.stringify(response));
    expect(recipe.ingredients[0]?.allergens).toEqual(['gluten']);
  });

  it('rechaza un texto que no es JSON (CA-04.3)', () => {
    expect(() => parseAdaptation('lo siento, no puedo')).toThrow();
    expect(() => parseAdaptation('{"receta": ')).toThrow();
  });

  it('rechaza una forma inválida (CA-04.3)', () => {
    expect(() => parseAdaptation('{"receta": {"id": "REC-008"}, "cambios": []}')).toThrow();
    expect(() => parseAdaptation('{"cambios": []}')).toThrow();
    const noSteps = validResponse();
    noSteps.receta.pasos = [];
    expect(() => parseAdaptation(JSON.stringify(noSteps))).toThrow();
  });
});

describe('parseAnswer', () => {
  it('lee respuesta y mas_detalle del JSON (CA-07.1)', () => {
    const text = JSON.stringify({ respuesta: 'Unos 15 minutos.', mas_detalle: 'Hasta que...' });
    expect(parseAnswer(text, 2)).toEqual({
      answer: 'Unos 15 minutos.',
      moreDetail: 'Hasta que...',
    });
  });

  it('recorta la respuesta a 2 frases como máximo (CA-07.1)', () => {
    const text = JSON.stringify({ respuesta: 'Uno. Dos. Tres. Cuatro.' });
    expect(parseAnswer(text, 2).answer).toBe('Uno. Dos.');
  });

  it('recorta a una frase cuando el límite es 1 (CA-33.1)', () => {
    const text = JSON.stringify({ respuesta: '¿Listo? Sí, ya. Más.' });
    expect(parseAnswer(text, 1).answer).toBe('¿Listo?');
  });

  it('no parte los decimales como fin de frase (CA-07.1)', () => {
    const text = JSON.stringify({ respuesta: 'Agrega 1.5 tazas de caldo. Mezcla bien. Sirve.' });
    expect(parseAnswer(text, 2).answer).toBe('Agrega 1.5 tazas de caldo. Mezcla bien.');
  });

  it('tolera cercas de código y texto alrededor (CA-07.1)', () => {
    const text = 'Claro:\n```json\n{"respuesta":"Sí.","mas_detalle":null}\n```';
    expect(parseAnswer(text, 2)).toEqual({ answer: 'Sí.', moreDetail: undefined });
  });

  it('lanza si no es JSON o falta la respuesta, para probar el alterno (CA-08.1)', () => {
    expect(() => parseAnswer('no sé', 2)).toThrow(AdaptationParseError);
    expect(() => parseAnswer('{"respuesta":""}', 2)).toThrow(AdaptationParseError);
    expect(() => parseAnswer('{"mas_detalle":"x"}', 2)).toThrow(AdaptationParseError);
  });
});

describe('parseExplanation', () => {
  it('lee explicación y pista_listo (CA-10.2)', () => {
    const text = JSON.stringify({ explicacion: 'Se cocina.', pista_listo: 'Se ve dorado.' });
    expect(parseExplanation(text)).toEqual({
      explanation: 'Se cocina.',
      readyCue: 'Se ve dorado.',
    });
  });

  it('lanza si falta la pista de listo (CA-10.2)', () => {
    expect(() => parseExplanation('{"explicacion":"x"}')).toThrow(AdaptationParseError);
    expect(() => parseExplanation('nada')).toThrow(AdaptationParseError);
  });
});
