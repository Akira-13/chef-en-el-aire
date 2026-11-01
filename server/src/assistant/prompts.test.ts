import { describe, expect, it } from 'vitest';
import type { AdaptRequest } from '@chef/shared';
import { getRecipe } from '../data/recipes';
import { buildAdaptPrompt } from './prompts';

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
