// Búsqueda de recetas por nombre, ingrediente o etiqueta, sin tildes y en singular o plural
// (RF-02, CA-02.1, CA-02.2), y recetas parecidas cuando no hay resultados (CA-02.3).

import type { Profile, Recipe } from '@chef/shared';
import { hasBlockedAllergens } from './substitutions';
import { normalizeText, tokens } from './text';

// Palabras de relleno de una búsqueda dictada: "busca recetas con quinua" → "quinua".
const FILLER = new Set([
  'busca',
  'buscar',
  'quiero',
  'receta',
  'algo',
  'con',
  'de',
  'del',
  'el',
  'la',
  'lo',
  'un',
  'una',
  'y',
  'para',
  'que',
  'tenga',
]);

function searchWords(query: string): string[] {
  return tokens(query).filter((word) => !FILLER.has(word));
}

function fieldsOf(recipe: Recipe): string[][] {
  return [recipe.name, ...recipe.tags, ...recipe.ingredients.map((i) => i.name)].map(tokens);
}

// RF-02: búsqueda por nombre, ingrediente o etiqueta. Cada palabra de la consulta tiene que
// aparecer en algún campo; primero las recetas cuyo nombre la contiene.
export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
  const q = normalizeText(query);
  if (!q) return [];
  const words = searchWords(query);
  if (words.length === 0) return [];

  const matches = (recipe: Recipe) => {
    const fields = fieldsOf(recipe);
    return words.every((word) =>
      fields.some((field) => field.some((w) => w === word || w.startsWith(word))),
    );
  };
  const inName = (recipe: Recipe) => (normalizeText(recipe.name).includes(q) ? 0 : 1);
  return recipes.filter(matches).sort((a, b) => inName(a) - inName(b));
}

// Distancia de edición, para tolerar errores de dictado o de escritura ("kinua" → "quinua").
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length]!;
}

function similarity(word: string, candidate: string): number {
  if (word === candidate) return 3;
  const prefix = Math.min(word.length, candidate.length, 4);
  if (prefix >= 3 && word.slice(0, prefix) === candidate.slice(0, prefix)) return 2;
  if (word.length >= 4 && editDistance(word, candidate) <= (word.length >= 5 ? 2 : 1)) return 2;
  return 0;
}

/**
 * Recetas parecidas a una búsqueda sin resultados (CA-02.3): por palabras que se escriben
 * parecido en el nombre, las etiquetas o los ingredientes. Con perfil, solo las seguras.
 */
export function findSimilarRecipes(
  recipes: Recipe[],
  query: string,
  profile?: Profile,
  limit = 3,
): Recipe[] {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const scored = recipes
    .filter((recipe) => !profile || !hasBlockedAllergens(recipe, profile))
    .map((recipe) => {
      const recipeWords = fieldsOf(recipe).flat();
      const score = words.reduce(
        (sum, word) => sum + Math.max(0, ...recipeWords.map((w) => similarity(word, w))),
        0,
      );
      return { recipe, score };
    })
    .filter((s) => s.score > 0);
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.recipe);
}
