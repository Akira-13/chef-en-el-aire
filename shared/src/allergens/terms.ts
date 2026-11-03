// Diccionario de términos por categoría de alérgeno para reconocer ingredientes por su nombre
// (RF-07, RNF-06). Se escriben con tilde para mostrarlos; al comparar se normalizan.
// Lo importante es no dejar pasar un alérgeno (cero falsos negativos): un falso positivo solo
// agrega una advertencia, así que ante la duda el término se incluye.

import type { AllergenCategory } from '../types/recipe';

export const ALLERGEN_TERMS: Record<AllergenCategory, string[]> = {
  mani: ['maní', 'cacahuate', 'cacahuete', 'mantequilla de maní'],
  leche: [
    'leche',
    'queso',
    'mantequilla',
    'crema de leche',
    'yogur',
    'yogurt',
    'parmesano',
    'mozzarella',
    'ricotta',
    'requesón',
    'cheddar',
    'manjar',
    'nata',
    'ghee',
    'helado',
    'lácteo',
    'caseína',
    'lactosa',
  ],
  gluten: [
    'harina',
    'pan',
    'panko',
    'fideo',
    'tallarín',
    'espagueti',
    'spaghetti',
    'macarrón',
    'lasaña',
    'ravioles',
    'ñoqui',
    'pasta',
    'galleta',
    'sillao',
    'trigo',
    'cebada',
    'centeno',
    'avena',
    'sémola',
    'cuscús',
    'seitán',
    'hojaldre',
    'cerveza',
    'pizza',
  ],
  huevo: ['huevo', 'yema', 'clara', 'mayonesa', 'merengue', 'albúmina'],
  soya: ['soya', 'soja', 'sillao', 'tofu', 'miso', 'tempeh', 'edamame', 'shoyu', 'tamari'],
  pescado: [
    'pescado',
    'atún',
    'bonito',
    'anchoa',
    'anchoveta',
    'salmón',
    'trucha',
    'corvina',
    'lenguado',
    'merluza',
    'tilapia',
    'bacalao',
    'sardina',
    'jurel',
    'caballa',
    'fumet',
  ],
  mariscos: [
    'marisco',
    'camarón',
    'langostino',
    'concha',
    'calamar',
    'pulpo',
    'choro',
    'mejillón',
    'almeja',
    'cangrejo',
    'langosta',
    'ostra',
    'ostión',
    'molusco',
    'crustáceo',
  ],
  frutos_secos: [
    'nuez',
    'nueces',
    'pecana',
    'almendra',
    'avellana',
    'pistacho',
    'castaña',
    'marañón',
    'anacardo',
    'macadamia',
    'piñón',
    'nuez de Brasil',
  ],
};

// Términos que solo valen en el nombre de un ingrediente: en los pasos son ambiguos
// ("la crema espesa" describe una textura, no un lácteo).
export const INGREDIENT_ONLY_TERMS: Partial<Record<AllergenCategory, string[]>> = {
  leche: ['crema'],
};

// Frases que contienen un término pero no el alérgeno de esas categorías: "leche de coco" no
// es leche, aunque "mantequilla de maní" sigue siendo maní. Se quitan solo para las categorías
// indicadas, así el resto de los alérgenos de la frase se detecta igual.
export interface AllergenException {
  phrase: string;
  allergens: AllergenCategory[];
}

export const ALLERGEN_EXCEPTIONS: AllergenException[] = [
  { phrase: 'leche de coco', allergens: ['leche'] },
  { phrase: 'crema de coco', allergens: ['leche'] },
  { phrase: 'leche de almendra', allergens: ['leche'] },
  { phrase: 'leche de avena', allergens: ['leche'] },
  { phrase: 'leche de arroz', allergens: ['leche'] },
  { phrase: 'leche de soya', allergens: ['leche'] },
  { phrase: 'leche de marañón', allergens: ['leche'] },
  { phrase: 'leche vegetal', allergens: ['leche'] },
  { phrase: 'queso vegano', allergens: ['leche'] },
  { phrase: 'mantequilla de maní', allergens: ['leche'] },
  { phrase: 'mantequilla de almendra', allergens: ['leche'] },
  { phrase: 'mantequilla de cacao', allergens: ['leche'] },
  { phrase: 'pasta de maní', allergens: ['gluten'] },
  { phrase: 'pasta de almendra', allergens: ['gluten'] },
  { phrase: 'pasta de ají', allergens: ['gluten'] },
  { phrase: 'pasta de tomate', allergens: ['gluten'] },
  { phrase: 'pasta de ajo', allergens: ['gluten'] },
  { phrase: 'harina de arroz', allergens: ['gluten'] },
  // El plural va escrito porque la coincidencia solo admite plural en la última palabra.
  { phrase: 'pasta de arroz', allergens: ['gluten'] },
  { phrase: 'pastas de arroz', allergens: ['gluten'] },
  { phrase: 'galleta de arroz', allergens: ['gluten'] },
  { phrase: 'galletas de arroz', allergens: ['gluten'] },
  { phrase: 'fideo de arroz', allergens: ['gluten'] },
  { phrase: 'fideos de arroz', allergens: ['gluten'] },
  { phrase: 'tallarín de arroz', allergens: ['gluten'] },
  { phrase: 'tallarines de arroz', allergens: ['gluten'] },
  { phrase: 'harina de maíz', allergens: ['gluten'] },
  { phrase: 'harina de quinua', allergens: ['gluten'] },
  { phrase: 'nuez moscada', allergens: ['frutos_secos'] },
];

// Cualificadores que, justo después de un término, indican que el producto no lleva ese alérgeno
// ("pan sin gluten", "bebida de avena sin gluten"). Solo exime al término que precede a la
// frase. "sin lactosa" no figura a propósito: la leche sin lactosa conserva la proteína láctea
// y sigue siendo alérgeno.
export const ALLERGEN_FREE_QUALIFIERS: Partial<Record<AllergenCategory, string>> = {
  gluten: 'sin gluten',
};
