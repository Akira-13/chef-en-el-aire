// Sugerencias al abrir la app (RF-01, CA-01.1–01.3). Los alérgenos del perfil y de los
// comensales, la dieta y lo que no le gusta son filtros duros; el tiempo y la dificultad se
// relajan, en ese orden, si no alcanzan tres recetas, y se explica cuál se relajó.

import type { Difficulty, Profile, Recipe, SkillLevel } from '@chef/shared';
import { pantryMatches } from './pantry';
import { hasBlockedAllergens, isMeatIngredient, isVegetarianDiet } from './substitutions';
import { phrasesMatch } from './text';

export const SUGGESTION_COUNT = 3;

export interface SuggestionResult {
  recipes: Recipe[];
  /** Explicación cuando hubo que relajar un filtro (CA-01.3). */
  message?: string;
}

export interface SuggestOptions {
  /** Minutos disponibles: solo recetas con `totalMinutes` menor o igual. */
  availableMinutes?: number;
}

const DIFFICULTY_RANK: Record<Difficulty, number> = { basico: 0, intermedio: 1, avanzado: 2 };

// Un novato ve hasta "intermedio"; los demás, todas.
const MAX_DIFFICULTY: Record<SkillLevel, Difficulty> = {
  novato: 'intermedio',
  intermedio: 'avanzado',
  avanzado: 'avanzado',
};

const MEAT_TAGS = ['carne', 'pollo', 'pescado'];

/** Con dieta vegetariana, la receta sirve si cada ingrediente con carne tiene sustituto vegetariano. */
export function fitsDiet(recipe: Recipe, profile: Profile): boolean {
  if (!isVegetarianDiet(profile.explicit.diet)) return true;
  const meat = recipe.ingredients.filter((i) => isMeatIngredient(i.name));
  if (meat.length === 0) return !recipe.tags.some((tag) => MEAT_TAGS.includes(tag));
  return meat.every((i) => i.substitutes.some((s) => s.reason === 'vegetariano'));
}

function recipeTexts(recipe: Recipe): string[] {
  return [recipe.name, ...recipe.tags, ...recipe.ingredients.map((i) => i.name)];
}

function mentionsAny(recipe: Recipe, phrases: readonly string[]): number {
  const texts = recipeTexts(recipe);
  return phrases.filter((phrase) => texts.some((text) => phrasesMatch(phrase, text))).length;
}

function bestRating(recipe: Recipe, profile: Profile): number {
  return Math.max(
    0,
    ...profile.history.filter((h) => h.recipeId === recipe.id).map((h) => h.rating ?? 0),
  );
}

const fitsLevel = (recipe: Recipe, profile: Profile) =>
  DIFFICULTY_RANK[recipe.difficulty] <= DIFFICULTY_RANK[MAX_DIFFICULTY[profile.skillLevel]];

// RF-01: tres recetas sugeridas al abrir la app.
export function suggestRecipes(
  recipes: Recipe[],
  profile: Profile,
  options: SuggestOptions = {},
): SuggestionResult {
  const { availableMinutes } = options;
  const fitsTime = (recipe: Recipe) =>
    availableMinutes === undefined || recipe.totalMinutes <= availableMinutes;

  // Filtros que nunca se relajan.
  const allowed = recipes.filter(
    (recipe) =>
      !hasBlockedAllergens(recipe, profile) &&
      fitsDiet(recipe, profile) &&
      mentionsAny(recipe, profile.learned.dislikes) === 0,
  );

  // CA-01.2: más ingredientes en la despensa, luego gustos, luego mejor valoración.
  const score = new Map(
    allowed.map((recipe) => [
      recipe.id,
      [
        pantryMatches(recipe, profile),
        mentionsAny(recipe, profile.learned.likes),
        bestRating(recipe, profile),
      ],
    ]),
  );
  const byScore = (a: Recipe, b: Recipe) => {
    const sa = score.get(a.id)!;
    const sb = score.get(b.id)!;
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i]! - sa[i]!;
    return 0;
  };

  // CA-01.3: si no alcanzan, se relaja primero el tiempo y después la dificultad.
  const strict = allowed.filter((r) => fitsTime(r) && fitsLevel(r, profile)).sort(byScore);
  const anyTime = allowed.filter((r) => !fitsTime(r) && fitsLevel(r, profile)).sort(byScore);
  const anyLevel = allowed.filter((r) => !fitsLevel(r, profile)).sort(byScore);
  const result = [...strict, ...anyTime, ...anyLevel].slice(0, SUGGESTION_COUNT);

  const relaxed = [
    result.some((r) => !fitsTime(r)) && `el tiempo (más de ${availableMinutes} minutos)`,
    result.some((r) => !fitsLevel(r, profile)) && 'la dificultad',
  ].filter(Boolean);
  const message =
    result.length < SUGGESTION_COUNT
      ? `Solo encontré ${result.length} ${result.length === 1 ? 'receta segura' : 'recetas seguras'} para tu perfil.`
      : relaxed.length
        ? `No había ${SUGGESTION_COUNT} recetas que cumplieran todo: relajé ${relaxed.join(' y ')}, nunca tus alergias.`
        : undefined;
  return { recipes: result, ...(message && { message }) };
}
