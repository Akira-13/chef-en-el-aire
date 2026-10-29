// Contrato HTTP entre la interfaz y el Gateway LLM. La interfaz nunca habla con un proveedor
// de LLM directamente (RF-09): solo usa estas rutas y estos tipos.

import type { AllergenCategory, Recipe } from './types/recipe';
import type { DinerRestriction, SkillLevel } from './types/profile';
import type { Feeling } from './commands';

export const ASSISTANT_ROUTES = {
  adapt: '/api/assistant/adapt',
  ask: '/api/assistant/ask',
  explain: '/api/assistant/explain',
} as const;

/** Nombres de proveedor tal como aparecen en la configuración del servidor. */
export type LLMProviderId = 'remoto' | 'ollama';

export const ASSISTANT_UNAVAILABLE_MESSAGE =
  'El asistente no está disponible, sigues con la receta original.';

// Respuesta común cuando ningún proveedor contesta a tiempo (RF-10, CA-08.3).
export interface AssistantUnavailable {
  status: 'unavailable';
  message: string;
}

export interface DietaryConstraints {
  allergies: AllergenCategory[];
  dinerRestrictions: DinerRestriction[];
  diet: string;
}

export interface AdaptRequest {
  recipeId: string;
  /** Porciones deseadas; si falta, se conservan las de la receta. */
  servings?: number;
  constraints: DietaryConstraints;
  pantry: string[];
  skillLevel: SkillLevel;
  /** Pedido libre del usuario, por ejemplo "sin huevo". */
  note?: string;
}

export interface RecipeChange {
  kind: 'ingredient' | 'step' | 'servings';
  /** Id del ingrediente ("ING-006") o número de paso, según `kind`. */
  target?: string;
  before: string;
  after: string;
  /** Motivo que se muestra en la vista antes/después (CA-05.1). */
  reason: string;
}

export interface AllergenFinding {
  ingredientId: string;
  ingredientName: string;
  allergen: AllergenCategory;
  /** Si el alérgeno viene del propio perfil o de un comensal. */
  source: 'profile' | 'diner';
  diner?: string;
}

interface AdaptResult {
  original: Recipe;
  adapted: Recipe;
  changes: RecipeChange[];
  provider: LLMProviderId;
  latencyMs: number;
}

// `blocked`: el validador local encontró un alérgeno; la interfaz exige confirmación
// explícita antes de usar la receta (RF-07, CA-06.2).
export type AdaptResponse =
  | (AdaptResult & { status: 'ok' })
  | (AdaptResult & { status: 'blocked'; findings: AllergenFinding[] })
  | AssistantUnavailable;

export interface AskRequest {
  recipeId: string;
  stepNumber: number;
  question: string;
  skillLevel: SkillLevel;
  tone?: string;
  feeling?: Feeling;
}

export type AskResponse =
  | {
      status: 'ok';
      /** Respuesta breve, de 2 frases como máximo (CA-07.1). */
      answer: string;
      moreDetail?: string;
      provider: LLMProviderId;
      latencyMs: number;
    }
  | AssistantUnavailable;

export interface ExplainRequest {
  recipeId: string;
  stepNumber: number;
  skillLevel: SkillLevel;
}

export type ExplainResponse =
  | {
      status: 'ok';
      explanation: string;
      readyCue: string;
      /** `assistant` cuando la señal no estaba en los datos y la generó el LLM (CA-10.2). */
      readyCueSource: 'recipe' | 'assistant';
      provider: LLMProviderId | null;
      latencyMs: number;
    }
  | AssistantUnavailable;
