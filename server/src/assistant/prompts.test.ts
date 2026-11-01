import { describe, expect, it } from 'vitest';
import type { AdaptRequest } from '@chef/shared';
import { getRecipe } from '../data/recipes';
import {
  buildAdaptPrompt,
  buildAskPrompt,
  buildExplainPrompt,
  type AskInput,
  type ExplainInput,
} from './prompts';

const recipe = getRecipe('REC-008')!;

const request: AdaptRequest = {
  recipeId: 'REC-008',
  servings: 2,
  constraints: {
    allergies: ['mani'],
    dinerRestrictions: [{ diner: 'esposo', restriction: 'leche', reason: 'lactosa' }],
    diet: 'vegetariana',
  },
  pantry: ['arroz', 'zapallo'],
  skillLevel: 'novato',
  note: 'sin huevo',
};

describe('buildAdaptPrompt', () => {
  const { system, user } = buildAdaptPrompt(recipe, request);

  it('incluye la receta en el formato de los datos (CA-04.3)', () => {
    expect(user).toContain('"ingredientes"');
    expect(user).toContain('ING-050');
    expect(user).toContain('Ocopa arequipeña');
  });

  it('incluye alergias, comensales, dieta, despensa, nivel y pedido (RF-05)', () => {
    expect(user).toContain('mani');
    expect(user).toContain('esposo');
    expect(user).toContain('leche');
    expect(user).toContain('vegetariana');
    expect(user).toContain('zapallo');
    expect(user).toContain('novato');
    expect(user).toContain('sin huevo');
    expect(user).toContain('2');
  });

  it('exige solo JSON con receta y cambios (CA-04.3)', () => {
    expect(system).toContain('SOLO');
    expect(system).toContain('JSON');
    expect(system).toContain('"receta"');
    expect(system).toContain('"cambios"');
    expect(system).toContain('"tipo"');
    expect(system).toContain('"motivo"');
  });

  it('pide conservar los id y no agregar alérgenos (RF-07)', () => {
    expect(system).toMatch(/conserva.*id/i);
    expect(system).toMatch(/nunca.*alérgenos/i);
    expect(system).toMatch(/unidades caseras/i);
  });

  it('pide que nombre y descripción no mencionen alérgenos ni ingredientes quitados (RNF-06)', () => {
    expect(system).toMatch(/"nombre" y "descripcion"/);
    expect(system).toMatch(/no mencionen.*ingredientes.*alérgeno/is);
  });

  it('no inventa restricciones cuando no hay (RF-05)', () => {
    const { user: plain } = buildAdaptPrompt(recipe, {
      ...request,
      constraints: { allergies: [], dinerRestrictions: [], diet: 'omnivora' },
      pantry: [],
      note: undefined,
    });
    expect(plain).toContain('ninguna');
  });
});

const step = recipe.steps[3]!;

const askRequest: AskInput = {
  recipeId: 'REC-008',
  stepNumber: step.number,
  question: '¿Cuánto debo dejar hervir las papas?',
  skillLevel: 'novato',
};

const constraints = {
  allergies: ['mani' as const],
  dinerRestrictions: [{ diner: 'esposo', restriction: 'leche' as const, reason: 'lactosa' }],
  diet: 'omnivora',
};

describe('buildAskPrompt', () => {
  it('incluye la receta, el paso actual y la pregunta (CA-07.1)', () => {
    const { user } = buildAskPrompt(recipe, step, askRequest);
    expect(user).toContain('Ocopa arequipeña');
    expect(user).toContain(`Paso ${step.number}`);
    expect(user).toContain(step.text);
    expect(user).toContain('¿Cuánto debo dejar hervir las papas?');
  });

  it('pide un JSON con respuesta y mas_detalle, de 2 frases como máximo (CA-07.1)', () => {
    const { system } = buildAskPrompt(recipe, step, askRequest);
    expect(system).toContain('SOLO');
    expect(system).toContain('"respuesta"');
    expect(system).toContain('"mas_detalle"');
    expect(system).toMatch(/2 frases/);
  });

  it('para un novato usa un tono tranquilizador y explicativo (RF-41, CA-33.1)', () => {
    const { system } = buildAskPrompt(recipe, step, { ...askRequest, skillLevel: 'novato' });
    expect(system).toMatch(/tranquilizador/i);
    expect(system).toMatch(/explica/i);
    expect(system).not.toMatch(/UNA sola frase/);
  });

  it('para un avanzado responde en una sola frase, directa (RF-41, CA-33.1)', () => {
    const { system } = buildAskPrompt(recipe, step, { ...askRequest, skillLevel: 'avanzado' });
    expect(system).toMatch(/UNA sola frase/);
    expect(system).toMatch(/directa/i);
    expect(system).not.toMatch(/tranquilizador/i);
  });

  it('incluye el tono del perfil y el sentimiento declarado (RF-41, RF-42)', () => {
    const { user } = buildAskPrompt(recipe, step, {
      ...askRequest,
      tone: 'cordial y directo',
      feeling: 'nervous',
    });
    expect(user).toContain('cordial y directo');
    expect(user).toMatch(/nervios/i);
  });

  it('prohíbe sugerir alérgenos del usuario y de sus comensales (RF-07)', () => {
    const { system, user } = buildAskPrompt(recipe, step, { ...askRequest, constraints });
    expect(system).toMatch(/nunca.*(sugieras|recomiendes).*alérgenos/is);
    expect(user).toContain('maní');
    expect(user).toContain('esposo');
    expect(user).toContain('leche');
  });
});

describe('buildExplainPrompt', () => {
  const explainRequest: ExplainInput = {
    recipeId: 'REC-008',
    stepNumber: step.number,
    skillLevel: 'novato',
  };

  it('pide explicación y pista_listo en JSON para el paso (CA-10.2)', () => {
    const { system, user } = buildExplainPrompt(recipe, step, explainRequest);
    expect(system).toContain('"explicacion"');
    expect(system).toContain('"pista_listo"');
    expect(user).toContain(step.text);
  });

  it('ajusta el tono al nivel: novato explicativo, avanzado breve (RF-41, CA-33.1)', () => {
    const novice = buildExplainPrompt(recipe, step, explainRequest).system;
    const advanced = buildExplainPrompt(recipe, step, {
      ...explainRequest,
      skillLevel: 'avanzado',
    }).system;
    expect(novice).toMatch(/tranquilizador/i);
    expect(advanced).toMatch(/UNA sola frase/);
  });

  it('incluye las restricciones para no sugerir alérgenos (RF-07)', () => {
    const { user } = buildExplainPrompt(recipe, step, { ...explainRequest, constraints });
    expect(user).toContain('maní');
  });
});
