// Rutas del asistente (adaptar, preguntar, explicar). Si ningún proveedor responde, la ruta
// contesta "no disponible" y la interfaz sigue con la receta original (RF-10).

import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  ALLERGEN_CATEGORIES,
  ASSISTANT_UNAVAILABLE_MESSAGE,
  findAllergens,
  findAllergensInText,
  scaleRecipe,
  type AdaptRequest,
  type AdaptResponse,
  type AllergenCategory,
  type AssistantUnavailable,
  type Recipe,
  type RecipeChange,
} from '@chef/shared';
import { getRecipe } from '../data/recipes';
import { AssistantUnavailableError, type ProviderSelector } from '../llm/ProviderSelector';
import { parseAdaptation } from './parser';
import { buildAdaptPrompt } from './prompts';

const unavailable: AssistantUnavailable = {
  status: 'unavailable',
  message: ASSISTANT_UNAVAILABLE_MESSAGE,
};

const allergen = z.enum(ALLERGEN_CATEGORIES);

const adaptRequestSchema = z.object({
  recipeId: z.string().min(1),
  servings: z.number().int().positive().max(100).optional(),
  constraints: z.object({
    allergies: z.array(allergen),
    dinerRestrictions: z.array(
      z.object({ diner: z.string(), restriction: allergen, reason: z.string() }),
    ),
    diet: z.string(),
  }),
  pantry: z.array(z.string()),
  skillLevel: z.enum(['novato', 'intermedio', 'avanzado']),
  note: z.string().max(500).optional(),
});

// RNF-06: el nombre y la descripción no los revisa el validador de alérgenos, pero el usuario
// los lee. Si nombran un alérgeno vigilado se reemplazan por un texto neutro, porque la
// descripción original puede mencionarlo igual.
function neutralizeTitles(
  adapted: Recipe,
  original: Recipe,
  constraints: AdaptRequest['constraints'],
): Recipe {
  const watched = new Set<AllergenCategory>([
    ...constraints.allergies,
    ...constraints.dinerRestrictions.map((r) => r.restriction),
  ]);
  const mentionsWatched = (text: string) =>
    findAllergensInText(text).some((m) => watched.has(m.allergen));
  const fallbackName = mentionsWatched(original.name) ? 'Receta adaptada' : original.name;
  return {
    ...adapted,
    name: mentionsWatched(adapted.name) ? fallbackName : adapted.name,
    description: mentionsWatched(adapted.description)
      ? `Versión adaptada de ${fallbackName}.`
      : adapted.description,
  };
}

function sendUnavailable(res: Response): void {
  res.status(503).json(unavailable);
}

/**
 * Router del asistente. Recibe una fábrica del selector para releer la configuración en cada
 * pedido y para probar las rutas con proveedores falsos.
 */
export function createAssistantRouter(getSelector: () => ProviderSelector): Router {
  const router = Router();

  // RF-05: la receta se escala antes del modelo (que solo sustituye) y el resultado siempre
  // pasa por el validador local, sin confiar en los alérgenos que declare el modelo (RF-07).
  router.post('/adapt', async (req, res) => {
    const parsed = adaptRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Pedido de adaptación inválido' });
      return;
    }
    const request: AdaptRequest = parsed.data;
    const original = getRecipe(request.recipeId);
    if (!original) {
      res.status(404).json({ error: 'Receta no encontrada' });
      return;
    }

    try {
      const scaled = scaleRecipe(original, request.servings ?? original.servings);
      const prompt = buildAdaptPrompt(scaled, request);
      const { value, provider, latencyMs } = await getSelector().run(async (llm, signal) =>
        parseAdaptation(
          await llm.complete(prompt.user, {
            system: prompt.system,
            json: true,
            temperature: 0.2,
            maxTokens: 4000,
            signal,
          }),
        ),
      );

      // El id y las porciones no los decide el modelo.
      const adapted = neutralizeTitles(
        { ...value.recipe, id: original.id, servings: scaled.servings },
        original,
        request.constraints,
      );
      const changes: RecipeChange[] = value.changes;
      if (scaled.servings !== original.servings && !changes.some((c) => c.kind === 'servings')) {
        changes.unshift({
          kind: 'servings',
          before: String(original.servings),
          after: String(scaled.servings),
          reason: 'Porciones pedidas',
        });
      }

      const findings = findAllergens(adapted, request.constraints);
      const result = { original, adapted, changes, provider, latencyMs };
      const body: AdaptResponse =
        findings.length > 0
          ? { status: 'blocked', ...result, findings }
          : { status: 'ok', ...result };
      res.json(body);
    } catch (error) {
      if (!(error instanceof AssistantUnavailableError)) console.error('[assistant] /adapt', error);
      sendUnavailable(res);
    }
  });

  // Pendientes de conectar: la interfaz sigue funcionando sin ellas (RF-10).
  router.post(['/ask', '/explain'], (_req, res) => sendUnavailable(res));

  return router;
}
