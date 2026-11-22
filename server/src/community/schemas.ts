// Validación de lo que llega a la Comunidad (RF-33 a RF-37). El servidor expuesto por el túnel
// recibe datos de cualquier dispositivo, así que todo se valida con zod y los rechazos se
// devuelven en español, sin detalles internos. Una receta mal formada puede romper las pantallas
// de quien la abra, por eso se valida su forma completa con el mismo esquema del recetario.

import { z } from 'zod';
import {
  COMMUNITY_LIMITS,
  toRawRecipe,
  toRecipe,
  type NewCommunityComment,
  type NewCommunityPost,
  type Recipe,
} from '@chef/shared';
import { rawRecipeSchema } from '../assistant/schemas';
import { getRecipe } from '../data/recipes';

const { aliasMaxLength, textMaxLength } = COMMUNITY_LIMITS;
const MAX_CHANGES = 50;
const MAX_RECIPE_NAME = 120;
const MAX_ID = 100;
const INVALID_BODY = 'Los datos enviados no son válidos.';

const alias = z
  .string({ error: 'Falta el alias.' })
  .trim()
  .min(1, 'El alias no puede estar vacío.')
  .max(aliasMaxLength, `El alias admite hasta ${aliasMaxLength} caracteres.`);

const clientId = z
  .string({ error: 'Falta el identificador del envío.' })
  .trim()
  .min(1, 'Falta el identificador del envío.')
  .max(MAX_ID, 'El identificador del envío es demasiado largo.');

// El token del dispositivo es aleatorio; un mínimo evita claves triviales de adivinar.
const deviceKey = z
  .string({ error: 'Falta la clave del dispositivo.' })
  .trim()
  .min(8, 'La clave del dispositivo no es válida.')
  .max(MAX_ID, 'La clave del dispositivo no es válida.');

const optionalText = (label: string) =>
  z
    .string({ error: `${label} no es válido.` })
    .trim()
    .max(textMaxLength, `${label} admite hasta ${textMaxLength} caracteres.`)
    .optional();

const changeText = (label: string) =>
  z
    .string({ error: `${label} del cambio no es válido.` })
    .trim()
    .max(textMaxLength, `${label} del cambio admite hasta ${textMaxLength} caracteres.`);

const changeSchema = z.object({
  kind: z.enum(['ingredient', 'step', 'servings'], { error: 'El tipo de cambio no es válido.' }),
  before: changeText('El valor anterior'),
  after: changeText('El valor nuevo'),
  reason: changeText('El motivo').optional(),
});

// Valida la receta con el esquema del recetario y la devuelve normalizada, sin campos ajenos.
// `toRawRecipe` asume la forma correcta y lanza con datos rotos: ese error es un rechazo más.
const recipeField = z.unknown().transform((value, ctx): Recipe => {
  try {
    const parsed = rawRecipeSchema.safeParse(toRawRecipe(value as Recipe));
    if (parsed.success) return toRecipe(parsed.data);
  } catch {
    // Se informa abajo con el mismo mensaje.
  }
  ctx.addIssue({ code: 'custom', message: 'La receta publicada no tiene el formato esperado.' });
  return z.NEVER;
});

const newPostSchema = z
  .object(
    {
      clientId,
      deviceKey,
      kind: z.enum(['recipe', 'achievement'], { error: 'El tipo de publicación no es válido.' }),
      alias,
      recipeId: z
        .string({ error: 'Falta la receta.' })
        .trim()
        .min(1, 'Falta la receta.')
        .max(MAX_ID, 'La receta no es válida.'),
      recipeName: z
        .string({ error: 'Falta el nombre de la receta.' })
        .trim()
        .min(1, 'Falta el nombre de la receta.')
        .max(MAX_RECIPE_NAME, 'El nombre de la receta es demasiado largo.'),
      recipe: recipeField.optional(),
      changes: z
        .array(changeSchema, { error: 'La lista de cambios no es válida.' })
        .max(MAX_CHANGES, 'Hay demasiados cambios.')
        .optional(),
      rating: z.enum(['up', 'down'], { error: 'La valoración no es válida.' }).optional(),
      message: optionalText('El mensaje'),
    },
    { error: INVALID_BODY },
  )
  .superRefine((post, ctx) => {
    const reject = (message: string, path: string) =>
      ctx.addIssue({ code: 'custom', message, path: [path] });

    if (post.kind === 'achievement') {
      if (post.recipe) reject('Un logro no lleva receta.', 'recipe');
      if (post.changes) reject('Un logro no lleva cambios.', 'changes');
      return;
    }
    if (post.rating) reject('Una receta no lleva valoración.', 'rating');
    if (!post.recipe) {
      reject('Falta la receta adaptada.', 'recipe');
      return;
    }
    if (post.recipe.id !== post.recipeId) {
      reject('El identificador de la receta no coincide con el publicado.', 'recipeId');
    } else if (!getRecipe(post.recipeId)) {
      reject('La receta no existe en el recetario.', 'recipeId');
    }
  });

const newCommentSchema = z.object(
  {
    clientId,
    deviceKey,
    alias,
    text: z
      .string({ error: 'El comentario no es válido.' })
      .trim()
      .min(1, 'El comentario no puede estar vacío.')
      .max(textMaxLength, `El comentario admite hasta ${textMaxLength} caracteres.`),
  },
  { error: INVALID_BODY },
);

const deviceKeySchema = z.object({ deviceKey }, { error: INVALID_BODY });

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function parse<T>(schema: z.ZodType<unknown>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data as T };
  return { ok: false, error: result.error.issues[0]?.message ?? INVALID_BODY };
}

export const parseNewPost = (body: unknown) => parse<NewCommunityPost>(newPostSchema, body);
export const parseNewComment = (body: unknown) =>
  parse<NewCommunityComment>(newCommentSchema, body);
export const parseDeviceKey = (body: unknown) =>
  parse<{ deviceKey: string }>(deviceKeySchema, body);
