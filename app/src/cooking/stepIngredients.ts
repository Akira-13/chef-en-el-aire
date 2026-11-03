// Los datos no vinculan los ingredientes con los pasos: se deducen buscando en el texto del paso
// las palabras que identifican a cada ingrediente (CA-09.1).

import type { Ingredient, Step } from '@chef/shared';
import { normalizeText } from '../personalization';

// Palabras del nombre que dicen cómo viene el ingrediente, no qué es. Sin esto, "pan de molde"
// aparecería en cualquier paso que hable de un molde.
const DESCRIPTORS = new Set(
  `de del en con sin y la el los las al para pasta hojas jugo filete pimienta
   amarillo amarilla rojo roja tinto blanco blanca fino fina maduro madura fresco fresca
   picado picada molido molida rallado rallada duro dura sancochado sancochada tostado tostada
   deshilachado deshilachada lavado lavada desgranado desgranada cocido cocida vegetal
   evaporada condensada dia anterior gajo cubo tira bastone pluma rama molde soda olor vena
   china limo mirasol parmesano`
    .split(/\s+/)
    .filter(Boolean),
);

function words(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map((word) => word.replace(/s$/, ''));
}

function keywords(ingredient: Ingredient): string[] {
  return words(ingredient.name).filter((word) => !DESCRIPTORS.has(word));
}

export function stepIngredients(step: Step, ingredients: Ingredient[]): Ingredient[] {
  const text = new Set(words(step.text));
  return ingredients.filter((ingredient) => keywords(ingredient).some((word) => text.has(word)));
}
