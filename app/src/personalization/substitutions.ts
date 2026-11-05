// Sustituciones según el perfil (CA-03.3, CA-23.1, CA-24.2). Primero lo que el usuario ya
// aceptó, luego el sustituto del recetario que responde a una alergia, a un comensal o a la
// dieta; lo rechazado va al final. Nunca se propone un reemplazo con un alérgeno del perfil.

import {
  findAllergens,
  findAllergensInText,
  type AcceptedSubstitution,
  type AllergenCategory,
  type DietaryConstraints,
  type Ingredient,
  type Profile,
  type Recipe,
  type Substitute,
} from '@chef/shared';
import { containsWords, normalizeText, phrasesMatch, tokens } from './text';

export function constraintsOf(profile: Profile): DietaryConstraints {
  return {
    allergies: profile.explicit.allergies,
    dinerRestrictions: profile.explicit.dinerRestrictions,
    diet: profile.explicit.diet,
  };
}

/** Alérgenos del perfil y de sus comensales. */
export function blockedAllergens(profile: Profile): Set<AllergenCategory> {
  return new Set([
    ...profile.explicit.allergies,
    ...profile.explicit.dinerRestrictions.map((r) => r.restriction),
  ]);
}

export const isVegetarianDiet = (diet: string) => /vegetarian|vegan/i.test(diet);

// Palabras que delatan carne, ave o pescado en el nombre de un ingrediente.
const MEAT_WORDS = [
  'carne',
  'lomo',
  'pollo',
  'gallina',
  'pechuga',
  'pescado',
  'filete',
  'res',
  'cerdo',
  'chancho',
  'atun',
  'jamon',
  'tocino',
  'chorizo',
  'marisco',
  'camaron',
  'langostino',
  'pavo',
  'cordero',
  'higado',
];

export function isMeatIngredient(name: string): boolean {
  return tokens(name).some((word) => MEAT_WORDS.includes(word));
}

/** La receta tiene alérgenos del perfil o de sus comensales (RF-07). */
export function hasBlockedAllergens(recipe: Recipe, profile: Profile): boolean {
  return findAllergens(recipe, constraintsOf(profile)).length > 0;
}

function isSafeName(name: string, profile: Profile): boolean {
  const blocked = blockedAllergens(profile);
  if (findAllergensInText(name, { ingredient: true }).some((m) => blocked.has(m.allergen))) {
    return false;
  }
  return !(isVegetarianDiet(profile.explicit.diet) && isMeatIngredient(name));
}

const sameName = (a: string, b: string) => normalizeText(a) === normalizeText(b);

function isListed(list: AcceptedSubstitution[] | undefined, original: string, name: string) {
  return (list ?? []).some(
    (s) => phrasesMatch(s.original, original) && sameName(s.substitute, name),
  );
}

/** El ingrediente choca con una alergia, un comensal o la dieta del perfil. */
export function needsSubstitution(ingredient: Ingredient, profile: Profile): boolean {
  if (!isSafeName(ingredient.name, profile)) return true;
  const blocked = blockedAllergens(profile);
  return ingredient.allergens.some((a) => blocked.has(a));
}

/** Sustitutos posibles para el ingrediente, del más recomendado al menos. */
export function rankSubstitutes(ingredient: Ingredient, profile: Profile): Substitute[] {
  const blocked = blockedAllergens(profile);
  const vegetarian = isVegetarianDiet(profile.explicit.diet);
  const fallbackReason = ingredient.substitutes[0]?.reason ?? 'gusto';

  // Sustituciones aceptadas antes para este ingrediente (CA-24.2).
  const accepted = profile.learned.acceptedSubstitutions
    .filter(
      (s) =>
        containsWords(ingredient.name, s.original) || phrasesMatch(s.original, ingredient.name),
    )
    .map(
      (s): Substitute =>
        ingredient.substitutes.find((sub) => sameName(sub.name, s.substitute)) ?? {
          name: s.substitute,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          reason: fallbackReason,
        },
    );

  const relevance = (sub: Substitute) =>
    (blocked as Set<string>).has(sub.reason) || (vegetarian && sub.reason === 'vegetariano')
      ? 0
      : 1;
  const fromRecipe = [...ingredient.substitutes].sort((a, b) => relevance(a) - relevance(b));

  const seen = new Set<string>();
  const candidates = [...accepted, ...fromRecipe].filter((sub) => {
    const key = normalizeText(sub.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return isSafeName(sub.name, profile);
  });

  // Lo rechazado no se propone primero (CA-24.2).
  const rejected = (sub: Substitute) =>
    isListed(profile.learned.rejectedSubstitutions, ingredient.name, sub.name) ? 1 : 0;
  return candidates.sort((a, b) => rejected(a) - rejected(b));
}

/** Mejor sustituto para el ingrediente según el perfil, o `undefined` si no hay (CA-03.3). */
export function substituteFor(ingredient: Ingredient, profile: Profile): Substitute | undefined {
  return rankSubstitutes(ingredient, profile)[0];
}

export interface SubstitutionProposal {
  ingredientId: string;
  original: string;
  substitute: Substitute;
  /** Por qué se propone, por ejemplo "esposo: intolerancia a la lactosa". */
  reason: string;
}

function reasonFor(ingredient: Ingredient, profile: Profile): string {
  const allergens = new Set<AllergenCategory>(ingredient.allergens);
  for (const match of findAllergensInText(ingredient.name, { ingredient: true })) {
    allergens.add(match.allergen);
  }
  const diner = profile.explicit.dinerRestrictions.find((r) => allergens.has(r.restriction));
  if (profile.explicit.allergies.some((a) => allergens.has(a))) return 'tu alergia';
  if (diner) return `${diner.diner}: ${diner.reason}`;
  return 'dieta vegetariana';
}

/**
 * Sustituciones que se proponen sin pedirlas para la receta abierta: una por ingrediente que
 * choca con el perfil y tiene un reemplazo seguro (CA-23.1). Se omiten las ya rechazadas.
 */
export function proposeSubstitutions(recipe: Recipe, profile: Profile): SubstitutionProposal[] {
  const proposals: SubstitutionProposal[] = [];
  for (const ingredient of recipe.ingredients) {
    if (!needsSubstitution(ingredient, profile)) continue;
    const substitute = substituteFor(ingredient, profile);
    if (!substitute) continue;
    if (isListed(profile.learned.rejectedSubstitutions, ingredient.name, substitute.name)) continue;
    proposals.push({
      ingredientId: ingredient.id,
      original: ingredient.name,
      substitute,
      reason: reasonFor(ingredient, profile),
    });
  }
  return proposals;
}

const OMIT = 'omitir';
const STEP_FIELDS = ['text', 'shortText', 'warning', 'readyCue'] as const;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Los pasos nombran el ingrediente completo o de forma corta ("la leche" por "leche
// evaporada"): se reemplazan ambos, con su artículo y en plural simple.
function mentionPattern(phrases: string[]): RegExp {
  const alternatives = [...new Set(phrases)]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:(?:el|la|los|las|un|una|unos|unas)\\s+)?(?:${alternatives})(?:e?s)?(?![\\p{L}\\p{N}])`,
    'giu',
  );
}

/**
 * Receta con el ingrediente reemplazado (o quitado si el sustituto es "omitir"). Los pasos
 * que lo nombran pasan a nombrar el sustituto; el resto de la receta no cambia.
 */
export function applySubstitution(
  recipe: Recipe,
  ingredientId: string,
  substitute: Substitute,
): Recipe {
  const ingredient = recipe.ingredients.find((i) => i.id === ingredientId);
  if (!ingredient) return recipe;
  const omit = substitute.quantity <= 0 || normalizeText(substitute.name) === OMIT;

  const ingredients = omit
    ? recipe.ingredients.filter((i) => i.id !== ingredientId)
    : recipe.ingredients.map((i) =>
        i.id === ingredientId
          ? {
              ...i,
              name: substitute.name,
              quantity: substitute.quantity,
              unit: substitute.unit,
              allergens: [],
              substitutes: [],
            }
          : i,
      );

  const terms = findAllergensInText(ingredient.name, { ingredient: true }).map((m) => m.term);
  const pattern = mentionPattern([ingredient.name, ...terms]);
  const rewrite = (text: string) =>
    text.replace(pattern, (match) =>
      /^\p{Lu}/u.test(match)
        ? substitute.name.charAt(0).toUpperCase() + substitute.name.slice(1)
        : substitute.name,
    );
  const steps = omit
    ? recipe.steps
    : recipe.steps.map((step) => {
        const next = { ...step };
        for (const field of STEP_FIELDS) {
          const value = step[field];
          if (value !== undefined) next[field] = rewrite(value);
        }
        return next;
      });

  // Los alérgenos de la receta quedan solo los que siguen declarados en sus ingredientes.
  const remaining = new Set(ingredients.flatMap((i) => i.allergens));
  return {
    ...recipe,
    ingredients,
    steps,
    allergens: recipe.allergens.filter((a) => remaining.has(a)),
  };
}
