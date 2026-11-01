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
  type AskResponse,
  type AssistantUnavailable,
  type ExplainResponse,
  type Recipe,
  type RecipeChange,
} from '@chef/shared';
import { getRecipe } from '../data/recipes';
import { AssistantUnavailableError, type ProviderSelector } from '../llm/ProviderSelector';
import { parseAdaptation, parseAnswer, parseExplanation } from './parser';
import {
  buildAdaptPrompt,
  buildAskPrompt,
  buildExplainPrompt,
  maxSentences,
  type AskInput,
  type ExplainInput,
} from './prompts';

const unavailable: AssistantUnavailable = {
  status: 'unavailable',
  message: ASSISTANT_UNAVAILABLE_MESSAGE,
};

const allergen = z.enum(ALLERGEN_CATEGORIES);

const constraintsSchema = z.object({
  allergies: z.array(allergen),
  dinerRestrictions: z.array(
    z.object({ diner: z.string(), restriction: allergen, reason: z.string() }),
  ),
  diet: z.string(),
});

const skillLevelSchema = z.enum(['novato', 'intermedio', 'avanzado']);

const adaptRequestSchema = z.object({
  recipeId: z.string().min(1),
  servings: z.number().int().positive().max(100).optional(),
  constraints: constraintsSchema,
  pantry: z.array(z.string()),
  skillLevel: skillLevelSchema,
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

// Las restricciones son opcionales: sin ellas el modelo no sabe qué alérgenos evitar, por eso la
// interfaz las envía siempre que conoce el perfil (RF-07).
const askRequestSchema = z.object({
  recipeId: z.string().min(1),
  stepNumber: z.number().int().positive(),
  question: z.string().trim().min(1).max(500),
  skillLevel: skillLevelSchema,
  tone: z.string().max(100).optional(),
  feeling: z.enum(['nervous', 'tired', 'confused', 'happy']).optional(),
  constraints: constraintsSchema.optional(),
});

const explainRequestSchema = z.object({
  recipeId: z.string().min(1),
  stepNumber: z.number().int().positive(),
  skillLevel: skillLevelSchema,
  constraints: constraintsSchema.optional(),
});

// Respuestas cortas: la voz las lee en voz alta y RNF-03 pide ≤ 8 s con el proveedor remoto.
const ANSWER_OPTIONS = { json: true, temperature: 0.3, maxTokens: 400 } as const;

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

  // RF-08: duda libre con el contexto del paso actual. La respuesta se recorta a las frases que
  // permite el nivel (CA-07.1, CA-33.1) y la ruta contesta "no disponible" si nadie responde.
  router.post('/ask', async (req, res) => {
    const parsed = askRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Pedido de pregunta inválido' });
      return;
    }
    const request: AskInput = parsed.data;
    const recipe = getRecipe(request.recipeId);
    const step = recipe?.steps.find((s) => s.number === request.stepNumber);
    if (!recipe || !step) {
      res.status(404).json({ error: 'Receta o paso no encontrado' });
      return;
    }

    try {
      const prompt = buildAskPrompt(recipe, step, request);
      const { value, provider, latencyMs } = await getSelector().run(async (llm, signal) =>
        parseAnswer(
          await llm.complete(prompt.user, { system: prompt.system, ...ANSWER_OPTIONS, signal }),
          maxSentences(request.skillLevel),
        ),
      );
      const body: AskResponse = { status: 'ok', ...value, provider, latencyMs };
      res.json(body);
    } catch (error) {
      if (!(error instanceof AssistantUnavailableError)) console.error('[assistant] /ask', error);
      sendUnavailable(res);
    }
  });

  // RF-13: la señal de "cuándo está listo" de los datos manda y no gasta una llamada al modelo
  // (CA-10.1); si el paso no la trae, la genera el modelo y se marca como suya (CA-10.2).
  router.post('/explain', async (req, res) => {
    const parsed = explainRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Pedido de explicación inválido' });
      return;
    }
    const request: ExplainInput = parsed.data;
    const recipe = getRecipe(request.recipeId);
    const step = recipe?.steps.find((s) => s.number === request.stepNumber);
    if (!recipe || !step) {
      res.status(404).json({ error: 'Receta o paso no encontrado' });
      return;
    }

    if (step.readyCue) {
      const body: ExplainResponse = {
        status: 'ok',
        explanation: step.text,
        readyCue: step.readyCue,
        readyCueSource: 'recipe',
        provider: null,
        latencyMs: 0,
      };
      res.json(body);
      return;
    }

    try {
      const prompt = buildExplainPrompt(recipe, step, request);
      const { value, provider, latencyMs } = await getSelector().run(async (llm, signal) =>
        parseExplanation(
          await llm.complete(prompt.user, {
            system: prompt.system,
            ...ANSWER_OPTIONS,
            maxTokens: 600,
            signal,
          }),
        ),
      );
      const body: ExplainResponse = {
        status: 'ok',
        ...value,
        readyCueSource: 'assistant',
        provider,
        latencyMs,
      };
      res.json(body);
    } catch (error) {
      if (!(error instanceof AssistantUnavailableError))
        console.error('[assistant] /explain', error);
      sendUnavailable(res);
    }
  });

  return router;
}
