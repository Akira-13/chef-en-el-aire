// Interpreta la respuesta del LLM: quita el formato Markdown, valida con zod y convierte al
// tipo Recipe con la misma función que usa el recetario (CA-04.3). Si algo no valida, lanza un
// error y el selector lo cuenta como falla del proveedor para probar el alterno.

import { toRecipe, type Recipe, type RecipeChange } from '@chef/shared';
import { adaptationSchema, toRecipeChange } from './schemas';

export interface ParsedAdaptation {
  recipe: Recipe;
  changes: RecipeChange[];
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

export function parseAdaptation(text: string): ParsedAdaptation {
  let json: unknown;
  try {
    json = JSON.parse(extractJson(text));
  } catch {
    throw new AdaptationParseError('La respuesta del modelo no es JSON');
  }
  const parsed = adaptationSchema.safeParse(json);
  if (!parsed.success) {
    throw new AdaptationParseError(
      `La respuesta del modelo no cumple el esquema: ${parsed.error.message}`,
    );
  }
  return {
    recipe: toRecipe(parsed.data.receta),
    changes: parsed.data.cambios.map(toRecipeChange),
  };
}
