// Sustituciones seguras sin LLM (RF-07, RF-10). Usa los `substitutes` del recetario cuyo motivo
// coincide con las alergias y restricciones del pedido, y valida el resultado con el mismo
// `findAllergens` que la ruta de adaptación: nunca se ofrece un reemplazo que el validador marque.

import type { AllergenFinding, DietaryConstraints, RecipeChange } from '../assistant';
import {
  ALLERGEN_LABELS,
  type AllergenCategory,
  type Ingredient,
  type Recipe,
  type Step,
  type Substitute,
  type SubstituteReason,
} from '../types/recipe';
import { findAllergens, findAllergensInText } from './index';
import { neutralizeTitles } from './titles';

export interface SafeSubstitutionResult {
  adapted: Recipe;
  changes: RecipeChange[];
  /** Alérgenos que aún quedan en la receta resultante; si no está vacío, hay que advertir (RF-07). */
  findings: AllergenFinding[];
}

const VEGETARIAN_REASON = 'vegetariano';
const OMIT = 'omitir';

const isOmission = (substitute: Substitute) =>
  substitute.quantity <= 0 || substitute.name.trim().toLowerCase() === OMIT;

const isVegetarianDiet = (diet: string) => /vegetarian|vegan/i.test(diet);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// El reemplazo se prueba solo, sin pasos: el validador mira su nombre, no lo que declare el recetario.
function isSafe(replacement: Ingredient, recipe: Recipe, constraints: DietaryConstraints) {
  return (
    findAllergens({ ...recipe, ingredients: [replacement], steps: [] }, constraints).length === 0
  );
}

function reasonText(reason: SubstituteReason, findings: AllergenFinding[]): string {
  if (reason === VEGETARIAN_REASON) return 'Dieta vegetariana';
  const source = findings.find((f) => f.allergen === reason);
  const owner = source?.source === 'diner' && source.diner ? ` (para ${source.diner})` : '';
  return `Sin ${ALLERGEN_LABELS[reason as AllergenCategory]}${owner}`;
}

// Los pasos nombran el ingrediente de forma corta ("el maní" por "maní tostado"): se reemplaza
// el nombre completo y los términos que lo hicieron coincidir con el alérgeno, sin su artículo.
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

function rewrite(text: string, pattern: RegExp, name: string): string {
  return text.replace(pattern, (match) => {
    const capital = /^\p{Lu}/u.test(match);
    return capital ? name.charAt(0).toUpperCase() + name.slice(1) : name;
  });
}

const STEP_FIELDS = ['text', 'shortText', 'warning', 'readyCue'] as const;

function rewriteStep(step: Step, replacements: Array<{ pattern: RegExp; name: string }>) {
  const next: Step = { ...step };
  for (const field of STEP_FIELDS) {
    const value = step[field];
    if (value === undefined) continue;
    next[field] = replacements.reduce((text, r) => rewrite(text, r.pattern, r.name), value);
  }
  return next;
}

/**
 * Sustituye los ingredientes con alérgenos vigilados (o no vegetarianos, con dieta vegetariana)
 * por el primer sustituto del recetario cuyo motivo coincide y que el validador no marca.
 * `recipe` debe venir en sus porciones originales: las cantidades del sustituto son las del
 * recetario. Devuelve `null` si no hay nada que sustituir.
 */
export function applySafeSubstitutions(
  recipe: Recipe,
  constraints: DietaryConstraints,
): SafeSubstitutionResult | null {
  const initial = findAllergens(recipe, constraints);
  const vegetarian = isVegetarianDiet(constraints.diet);
  const changes: RecipeChange[] = [];
  const replacements: Array<{ pattern: RegExp; name: string }> = [];
  const ingredients: Ingredient[] = [];

  for (const ingredient of recipe.ingredients) {
    const own = initial.filter((f) => f.ingredientId === ingredient.id);
    const reasons = new Set<SubstituteReason>(own.map((f) => f.allergen));
    if (vegetarian) reasons.add(VEGETARIAN_REASON);

    const chosen = ingredient.substitutes
      .filter((s) => reasons.has(s.reason))
      .find((s) =>
        isOmission(s)
          ? true
          : isSafe(
              {
                ...ingredient,
                name: s.name,
                quantity: s.quantity,
                unit: s.unit,
                allergens: [],
                substitutes: [],
              },
              recipe,
              constraints,
            ),
      );
    if (!chosen) {
      ingredients.push(ingredient);
      continue;
    }

    changes.push({
      kind: 'ingredient',
      target: ingredient.id,
      before: ingredient.name,
      after: chosen.name,
      reason: reasonText(chosen.reason, own),
    });
    if (isOmission(chosen)) continue;
    ingredients.push({
      ...ingredient,
      name: chosen.name,
      quantity: chosen.quantity,
      unit: chosen.unit,
      allergens: [],
      substitutes: [],
    });
    const terms = findAllergensInText(ingredient.name, { ingredient: true })
      .filter((m) => reasons.has(m.allergen))
      .map((m) => m.term);
    replacements.push({ pattern: mentionPattern([ingredient.name, ...terms]), name: chosen.name });
  }

  if (changes.length === 0) return null;

  const steps = recipe.steps.map((step) => {
    const next = rewriteStep(step, replacements);
    const field = STEP_FIELDS.find((f) => next[f] !== step[f]);
    if (field) {
      changes.push({
        kind: 'step',
        target: String(step.number),
        before: step[field] ?? '',
        after: next[field] ?? '',
        reason: 'Ajustado a la sustitución',
      });
    }
    return next;
  });

  const remaining = new Set(ingredients.flatMap((i) => i.allergens));
  const adapted = neutralizeTitles(
    {
      ...recipe,
      allergens: recipe.allergens.filter((a) => remaining.has(a)),
      ingredients,
      steps,
    },
    constraints,
  );
  return { adapted, changes, findings: findAllergens(adapted, constraints) };
}
