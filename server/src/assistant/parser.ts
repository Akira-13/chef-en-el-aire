// Interpreta la respuesta del LLM: quita el formato Markdown, valida con zod y convierte al
// tipo Recipe con la misma función que usa el recetario (CA-04.3). Si algo no valida, lanza un
// error y el selector lo cuenta como falla del proveedor para probar el alterno.

import { toRecipe, type Recipe, type RecipeChange } from '@chef/shared';
import { adaptationSchema, answerSchema, explanationSchema, toRecipeChange } from './schemas';

export interface ParsedAdaptation {
  recipe: Recipe;
  changes: RecipeChange[];
}

export interface ParsedAnswer {
  answer: string;
  moreDetail?: string;
}

export interface ParsedExplanation {
  explanation: string;
  readyCue: string;
}

export class AdaptationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdaptationParseError';
  }
}

// Devuelve el objeto JSON que hay en el texto: dentro de una cerca ```json, o el que va desde
// la primera llave hasta la última si el modelo agregó texto alrededor.
function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(extractJson(text));
  } catch {
    throw new AdaptationParseError('La respuesta del modelo no es JSON');
  }
}

function validate<T>(
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false; error: Error };
  },
  text: string,
): T {
  const parsed = schema.safeParse(parseJson(text));
  if (!parsed.success) {
    throw new AdaptationParseError(
      `La respuesta del modelo no cumple el esquema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function parseAdaptation(text: string): ParsedAdaptation {
  const data = validate(adaptationSchema, text);
  return {
    recipe: toRecipe(data.receta),
    changes: data.cambios.map(toRecipeChange),
  };
}

// El fin de frase es un signo seguido de espacio, así "1.5 tazas" no se parte.
function limitSentences(text: string, max: number): string {
  return text
    .split(/(?<=[.!?…])\s+/)
    .slice(0, max)
    .join(' ');
}

/** Respuesta de /ask; recorta a `maxSentences` frases porque el modelo no siempre obedece (CA-07.1). */
export function parseAnswer(text: string, maxSentences: number): ParsedAnswer {
  const data = validate(answerSchema, text);
  return {
    answer: limitSentences(data.respuesta, maxSentences),
    moreDetail: data.mas_detalle,
  };
}

export function parseExplanation(text: string): ParsedExplanation {
  const data = validate(explanationSchema, text);
  return { explanation: data.explicacion, readyCue: data.pista_listo };
}
