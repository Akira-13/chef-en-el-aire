// Sustituir un ingrediente por voz: «chef, sustituye el maní». Solo propone lo que el recetario
// conoce y que el perfil permite; la interfaz pide confirmar antes de cambiar la receta.

import type { Profile, Recipe } from '@chef/shared';
import { phrasesMatch } from './text';
import { needsSubstitution, rankSubstitutes, type SubstitutionProposal } from './substitutions';

export type VoicePlan =
  | { kind: 'propose'; proposal: SubstitutionProposal }
  | { kind: 'notFound'; spoken: string }
  | { kind: 'noSubstitute'; ingredient: string }
  | { kind: 'unknownSubstitute'; ingredient: string; requested: string };

// «el maní por semillas de girasol»: lo segundo es el sustituto que el usuario prefiere.
const WITH_REPLACEMENT = /^(.+?)\s+(?:por|con)\s+(.+)$/;

export function planVoiceSubstitution(recipe: Recipe, profile: Profile, spoken: string): VoicePlan {
  const parts = WITH_REPLACEMENT.exec(spoken.trim());
  const name = (parts?.[1] ?? spoken).trim();
  const requested = parts?.[2]?.trim();

  const matches = recipe.ingredients.filter((ingredient) => phrasesMatch(ingredient.name, name));
  if (matches.length === 0) return { kind: 'notFound', spoken: name };

  // Primero los que chocan con el perfil: si dice «queso» y solo uno lo hace, es ese.
  const candidates = matches
    .map((ingredient) => ({ ingredient, ranked: rankSubstitutes(ingredient, profile) }))
    .filter(({ ranked }) => ranked.length > 0)
    .sort(
      (a, b) =>
        Number(needsSubstitution(b.ingredient, profile)) -
        Number(needsSubstitution(a.ingredient, profile)),
    );
  const first = candidates[0];
  if (!first) return { kind: 'noSubstitute', ingredient: matches[0]!.name };

  const propose = (
    ingredientId: string,
    original: string,
    substitute: SubstitutionProposal['substitute'],
  ): VoicePlan => ({
    kind: 'propose',
    proposal: { ingredientId, original, substitute, reason: 'pedido por voz' },
  });

  if (!requested) {
    return propose(first.ingredient.id, first.ingredient.name, first.ranked[0]!);
  }
  for (const { ingredient, ranked } of candidates) {
    const wanted = ranked.find((sub) => phrasesMatch(sub.name, requested));
    if (wanted) return propose(ingredient.id, ingredient.name, wanted);
  }
  return { kind: 'unknownSubstitute', ingredient: first.ingredient.name, requested };
}
