// Personalización a partir del perfil: sugerencias (RF-01), búsqueda (RF-02), despensa (RF-03)
// y sustituciones propuestas (CA-23.1, CA-24.2). Todo es puro y barato: se recalcula en cada
// render de las pantallas.

export { normalizeText, phrasesMatch } from './text';
export {
  addToPantry,
  inPantry,
  pantryMatches,
  pantryStatus,
  type IngredientStatus,
} from './pantry';
export {
  SUGGESTION_COUNT,
  fitsDiet,
  suggestRecipes,
  type SuggestOptions,
  type SuggestionResult,
} from './suggest';
export { findSimilarRecipes, searchRecipes } from './search';
export {
  applySubstitution,
  hasBlockedAllergens,
  proposeSubstitutions,
  rankSubstitutes,
  substituteFor,
  type SubstitutionProposal,
} from './substitutions';
