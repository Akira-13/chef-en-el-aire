import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import { toProfile, toRecipes, type RawProfileBook, type RawRecipeBook } from '@chef/shared';
import { planVoiceSubstitution } from './voiceSubstitution';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const ocopa = recipes.find((r) => r.id === 'REC-008')!;
const diego = (rawProfiles as unknown as RawProfileBook).perfiles
  .map(toProfile)
  .find((p) => p.name === 'Diego')!;

describe('sustituir un ingrediente por voz', () => {
  it('propone el sustituto seguro del recetario para el ingrediente nombrado', () => {
    const plan = planVoiceSubstitution(ocopa, diego, 'maní');
    expect(plan).toMatchObject({
      kind: 'propose',
      proposal: { original: 'maní tostado', substitute: { name: 'semillas de girasol tostadas' } },
    });
  });

  it('entiende el nombre dictado sin tildes, en plural o parcial', () => {
    for (const spoken of ['mani', 'manís', 'el maní tostado', 'queso']) {
      expect(planVoiceSubstitution(ocopa, diego, spoken).kind).toBe('propose');
    }
  });

  it('avisa si el ingrediente no está en la receta', () => {
    expect(planVoiceSubstitution(ocopa, diego, 'trufa')).toEqual({
      kind: 'notFound',
      spoken: 'trufa',
    });
  });

  it('avisa si el ingrediente no tiene sustituto en el recetario', () => {
    expect(planVoiceSubstitution(ocopa, diego, 'papa amarilla')).toMatchObject({
      kind: 'noSubstitute',
      ingredient: 'papa amarilla',
    });
  });

  it('respeta el sustituto pedido si el recetario lo conoce', () => {
    const plan = planVoiceSubstitution(ocopa, diego, 'queso por tofu');
    expect(plan).toMatchObject({
      kind: 'propose',
      proposal: { original: 'queso fresco', substitute: { name: 'tofu firme' } },
    });
  });

  it('no inventa un sustituto que el recetario no conoce', () => {
    expect(planVoiceSubstitution(ocopa, diego, 'maní por pecanas')).toMatchObject({
      kind: 'unknownSubstitute',
      ingredient: 'maní tostado',
      requested: 'pecanas',
    });
  });

  it('nunca propone un sustituto con un alérgeno del perfil', () => {
    const plan = planVoiceSubstitution(ocopa, diego, 'queso');
    if (plan.kind === 'propose') {
      expect(plan.proposal.substitute.name).not.toMatch(/man[ií]/i);
    }
  });
});
