// Tipos de receta usados en todo el sistema. Los valores de dominio (categorías de
// alérgenos, dificultad, unidades) se conservan tal como vienen en datos/recetas.json (RF-04).

export const ALLERGEN_CATEGORIES = [
  'frutos_secos',
  'gluten',
  'huevo',
  'leche',
  'mani',
  'mariscos',
  'pescado',
  'soya',
] as const;

export type AllergenCategory = (typeof ALLERGEN_CATEGORIES)[number];

// Texto para mostrar o leer cada categoría en la interfaz.
export const ALLERGEN_LABELS: Record<AllergenCategory, string> = {
  frutos_secos: 'frutos secos',
  gluten: 'gluten',
  huevo: 'huevo',
  leche: 'leche',
  mani: 'maní',
  mariscos: 'mariscos',
  pescado: 'pescado',
  soya: 'soya',
};

export type Difficulty = 'basico' | 'intermedio' | 'avanzado';

// Motivo de un sustituto: un alérgeno o una preferencia (despensa, gusto, etc.).
export type SubstituteReason = AllergenCategory | 'despensa' | 'gusto' | 'picante' | 'vegetariano';

export interface Substitute {
  name: string;
  quantity: number;
  unit: string;
  reason: SubstituteReason;
}

export interface Ingredient {
  /** Identificador único en todo el recetario, por ejemplo "ING-006". */
  id: string;
  name: string;
  quantity: number;
  /** Unidad casera: cda, cdta, taza, unidad, g, ml, etc. */
  unit: string;
  allergens: AllergenCategory[];
  substitutes: Substitute[];
}

export interface Step {
  /** Número de paso, empieza en 1. */
  number: number;
  text: string;
  /** Versión breve que se lee en modo de verbosidad "breve" (CA-13.3). */
  shortText: string;
  timerSeconds: number | null;
  timerName?: string;
  /** Señal concreta de "cuándo está listo" (RF-13). */
  readyCue?: string;
  warning?: string;
}

export interface Recipe {
  /** Identificador, por ejemplo "REC-001". */
  id: string;
  name: string;
  description: string;
  servings: number;
  difficulty: Difficulty;
  totalMinutes: number;
  tags: string[];
  allergens: AllergenCategory[];
  ingredients: Ingredient[];
  steps: Step[];
  /** Mensaje de cierre para la celebración (RF-40). */
  celebration: string;
}
