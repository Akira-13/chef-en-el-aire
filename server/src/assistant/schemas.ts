// Esquemas zod de la respuesta del LLM: la receta con la misma estructura de datos/recetas.json
// (CA-04.3) y la lista de cambios. Viven en el servidor porque solo el Gateway interpreta
// texto del modelo. Son tolerantes con detalles menores (números como texto, categorías de
// alérgeno desconocidas) y estrictos con la estructura.

import { z } from 'zod';
import {
  ALLERGEN_CATEGORIES,
  type AllergenCategory,
  type RecipeChange,
  type SubstituteReason,
} from '@chef/shared';

const ALLERGENS: readonly string[] = ALLERGEN_CATEGORIES;
const SUBSTITUTE_REASONS: readonly string[] = [
  ...ALLERGEN_CATEGORIES,
  'despensa',
  'gusto',
  'picante',
  'vegetariano',
];

// Los alérgenos que declara el modelo no se usan para decidir nada (el validador revisa los
// nombres), así que una categoría desconocida se descarta en vez de invalidar la receta.
const allergenList = z
  .array(z.string())
  .default([])
  .transform((items) => items.filter((a): a is AllergenCategory => ALLERGENS.includes(a)));

const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined);

const substituteSchema = z.object({
  nombre: z.string(),
  cantidad: z.coerce.number(),
  unidad: z.string(),
  motivo: z
    .string()
    .transform((m): SubstituteReason =>
      SUBSTITUTE_REASONS.includes(m) ? (m as SubstituteReason) : 'gusto',
    ),
});

const ingredientSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  cantidad: z.coerce.number(),
  unidad: z.string(),
  alergenos: allergenList,
  sustitutos: z.array(substituteSchema).default([]),
});

const stepSchema = z.object({
  n: z.coerce.number().int(),
  texto: z.string().min(1),
  texto_corto: z.string().default(''),
  temporizador_seg: z.coerce
    .number()
    .nullish()
    .transform((value) => value ?? null),
  nombre_temporizador: optionalText,
  pista_listo: optionalText,
  advertencia: optionalText,
});

export const rawRecipeSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  descripcion: z.string().default(''),
  porciones: z.coerce.number().positive(),
  dificultad: z.enum(['basico', 'intermedio', 'avanzado']),
  tiempo_total_min: z.coerce.number(),
  etiquetas: z.array(z.string()).default([]),
  alergenos: allergenList,
  ingredientes: z.array(ingredientSchema).min(1),
  pasos: z.array(stepSchema).min(1),
  celebracion: z.string().default(''),
});

const CHANGE_KINDS: Record<string, RecipeChange['kind']> = {
  ingrediente: 'ingredient',
  paso: 'step',
  porciones: 'servings',
  ingredient: 'ingredient',
  step: 'step',
  servings: 'servings',
};

export const changeSchema = z.object({
  // El modelo a veces devuelve null o un valor inesperado; se acepta y se trata como
  // ingrediente porque el validador de alérgenos siempre revisa la receta resultante.
  tipo: z
    .unknown()
    .optional()
    .transform((value) => (typeof value === 'string' ? value : '')),
  objetivo: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((value) => (value == null ? undefined : String(value))),
  antes: z.coerce.string().default(''),
  despues: z.coerce.string().default(''),
  motivo: z.string(),
});

export const adaptationSchema = z.object({
  receta: rawRecipeSchema,
  cambios: z.array(changeSchema).default([]),
});

export function toRecipeChange(change: z.output<typeof changeSchema>): RecipeChange {
  return {
    kind: CHANGE_KINDS[change.tipo] ?? 'ingredient',
    ...(change.objetivo !== undefined && { target: change.objetivo }),
    before: change.antes,
    after: change.despues,
    reason: change.motivo,
  };
}
