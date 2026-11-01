// Validación local de alérgenos, independiente del LLM (RF-07, RNF-06).
// Una receta que viene del LLM puede traer ingredientes renombrados o nuevos sin alérgenos
// declarados, así que además de lo declarado se reconoce el alérgeno por el nombre del
// ingrediente y por el texto de los pasos. Nunca se confía en los metadatos del modelo.

import type { AllergenFinding, DietaryConstraints } from '../assistant';
import { ALLERGEN_CATEGORIES, type AllergenCategory, type Recipe } from '../types/recipe';
import { ALLERGEN_EXCEPTIONS, ALLERGEN_TERMS, INGREDIENT_ONLY_TERMS } from './terms';

export interface TextMatch {
  allergen: AllergenCategory;
  /** Término del diccionario que coincidió, tal como se muestra al usuario. */
  term: string;
}

// Minúsculas, sin tildes y solo letras y dígitos separados por un espacio; el texto queda
// rodeado de espacios para que la coincidencia sea siempre por palabra completa ("pan" no
// detecta "pana").
function normalize(text: string): string {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return ` ${words} `;
}

// La última palabra admite plural simple: "maní" → "manís" o "maníes", "tallarín" → "tallarines".
function wordPattern(phrase: string): RegExp {
  return new RegExp(`(?<= )${normalize(phrase).trim()}(?:e?s)?(?= )`);
}

interface CompiledTerm {
  term: string;
  pattern: RegExp;
}

function compile(terms: string[]): CompiledTerm[] {
  return terms.map((term) => ({ term, pattern: wordPattern(term) }));
}

const TERMS = Object.fromEntries(
  ALLERGEN_CATEGORIES.map((c) => [c, compile(ALLERGEN_TERMS[c])]),
) as Record<AllergenCategory, CompiledTerm[]>;

const INGREDIENT_ONLY = Object.fromEntries(
  ALLERGEN_CATEGORIES.map((c) => [c, compile(INGREDIENT_ONLY_TERMS[c] ?? [])]),
) as Record<AllergenCategory, CompiledTerm[]>;

const EXCEPTIONS = ALLERGEN_EXCEPTIONS.map((e) => ({
  allergens: e.allergens,
  pattern: new RegExp(wordPattern(e.phrase).source, 'g'),
}));

/**
 * Alérgenos que menciona un texto libre. Con `ingredient: true` se aplican también los
 * términos ambiguos que solo valen en el nombre de un ingrediente.
 */
export function findAllergensInText(
  text: string,
  options: { ingredient?: boolean } = {},
): TextMatch[] {
  const normalized = normalize(text);
  const matches: TextMatch[] = [];
  for (const allergen of ALLERGEN_CATEGORIES) {
    // Se quitan las frases de excepción de esta categoría antes de buscar sus términos.
    let scoped = normalized;
    for (const exception of EXCEPTIONS) {
      if (exception.allergens.includes(allergen)) scoped = scoped.replace(exception.pattern, ' ');
    }
    const candidates = options.ingredient
      ? [...TERMS[allergen], ...INGREDIENT_ONLY[allergen]]
      : TERMS[allergen];
    const hit = candidates.find(({ pattern }) => pattern.test(scoped));
    if (hit) matches.push({ allergen, term: hit.term });
  }
  return matches;
}

interface Watcher {
  allergen: AllergenCategory;
  source: 'profile' | 'diner';
  diner?: string;
}

// Cada alergia del perfil y cada restricción de un comensal, con su origen (RF-07).
function watchersOf(constraints: DietaryConstraints): Watcher[] {
  return [
    ...constraints.allergies.map((allergen): Watcher => ({ allergen, source: 'profile' })),
    ...constraints.dinerRestrictions.map((r): Watcher => ({
      allergen: r.restriction,
      source: 'diner',
      diner: r.diner,
    })),
  ];
}

const watcherKey = (w: Watcher) => `${w.allergen}|${w.source}|${w.diner ?? ''}`;

export function findAllergens(recipe: Recipe, constraints: DietaryConstraints): AllergenFinding[] {
  const watchers = watchersOf(constraints);
  const findings: AllergenFinding[] = [];
  const seen = new Set<string>();
  const add = (id: string, name: string, w: Watcher) => {
    const key = `${id}|${watcherKey(w)}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      ingredientId: id,
      ingredientName: name,
      allergen: w.allergen,
      source: w.source,
      ...(w.diner !== undefined && { diner: w.diner }),
    });
  };

  // Ingredientes: lo declarado más lo que dice el nombre.
  const inIngredients = new Set<string>();
  for (const ingredient of recipe.ingredients) {
    const present = new Set<AllergenCategory>(ingredient.allergens);
    for (const match of findAllergensInText(ingredient.name, { ingredient: true })) {
      present.add(match.allergen);
    }
    for (const w of watchers) {
      if (!present.has(w.allergen)) continue;
      add(ingredient.id, ingredient.name, w);
      inIngredients.add(watcherKey(w));
    }
  }

  // Pasos: atrapan un alérgeno que el texto agrega sin listarlo como ingrediente. Si ya se
  // halló en un ingrediente, la receta queda advertida y no se repite por paso.
  for (const step of recipe.steps) {
    const text = [step.text, step.shortText, step.warning, step.readyCue]
      .filter(Boolean)
      .join('. ');
    const matches = findAllergensInText(text);
    for (const w of watchers) {
      if (inIngredients.has(watcherKey(w))) continue;
      const match = matches.find((m) => m.allergen === w.allergen);
      if (match) add(`step-${step.number}`, match.term, w);
    }
  }

  return findings;
}
