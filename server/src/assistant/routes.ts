// Rutas del asistente (adaptar, preguntar, explicar). Si ningún proveedor responde, la ruta
// contesta "no disponible" y la interfaz sigue con la receta original (RF-10).

import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  ALLERGEN_CATEGORIES,
  ASSISTANT_UNAVAILABLE_MESSAGE,
  findAllergens,
  findAllergensInText,
  neutralizeTitles,
  scaleRecipe,
  watchedAllergens,
  type AdaptRequest,
  type AdaptResponse,
  type AllergenCategory,
  type AskRequest,
  type AskResponse,
  type AssistantUnavailable,
  type DietaryConstraints,
  type ExplainRequest,
  type ExplainResponse,
  type Recipe,
  type RecipeChange,
  type Step,
  type StepView,
} from '@chef/shared';
import { getRecipe } from '../data/recipes';
import { AssistantUnavailableError, type ProviderSelector } from '../llm/ProviderSelector';
import { parseAdaptation, parseAnswer, parseExplanation } from './parser';
import { buildAdaptPrompt, buildAskPrompt, buildExplainPrompt, maxSentences } from './prompts';

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

// RF-07: la respuesta del modelo no se bloquea ni se reescribe (una negación como «no agregues
// maní» también lo nombra), pero sí se avisa de los alérgenos vigilados que menciona.
function findAnswerWarnings(
  texts: Array<string | undefined>,
  constraints: DietaryConstraints | undefined,
): AllergenCategory[] {
  if (!constraints) return [];
  const watched = watchedAllergens(constraints);
  const mentioned = texts.flatMap((text) => (text ? findAllergensInText(text) : []));
  return [...new Set(mentioned.map((m) => m.allergen).filter((a) => watched.has(a)))];
}

// Las restricciones son opcionales: sin ellas el modelo no sabe qué alérgenos evitar, por eso la
// interfaz las envía siempre que conoce el perfil (RF-07).
const stepViewSchema = z.object({
  servings: z.number().int().positive().max(100),
  text: z.string().trim().min(1).max(2000),
  warning: z.string().max(500).optional(),
  readyCue: z.string().max(500).optional(),
});

// Si el usuario adaptó la receta, el paso que ve difiere del de los datos (RF-06).
function withStepView(recipe: Recipe, step: Step, view?: StepView): { recipe: Recipe; step: Step } {
  if (!view) return { recipe, step };
  const { warning, readyCue, ...rest } = step;
  return {
    recipe: { ...recipe, servings: view.servings },
    step: {
      ...rest,
      text: view.text,
      ...(view.warning && { warning: view.warning }),
      ...(view.readyCue && { readyCue: view.readyCue }),
    },
  };
}

const askRequestSchema = z.object({
  recipeId: z.string().min(1),
  stepNumber: z.number().int().positive(),
  question: z.string().trim().min(1).max(500),
  skillLevel: skillLevelSchema,
  tone: z.string().max(100).optional(),
  feeling: z.enum(['nervous', 'tired', 'confused', 'happy']).optional(),
  constraints: constraintsSchema.optional(),
  stepView: stepViewSchema.optional(),
});

const explainRequestSchema = z.object({
  recipeId: z.string().min(1),
  stepNumber: z.number().int().positive(),
  skillLevel: skillLevelSchema,
  constraints: constraintsSchema.optional(),
  stepView: stepViewSchema.optional(),
});

// Respuestas cortas: la voz las lee en voz alta y RNF-03 pide ≤ 8 s con el proveedor remoto.
const ANSWER_OPTIONS = { json: true, temperature: 0.3, maxTokens: 400 } as const;

function sendUnavailable(res: Response): void {
  res.status(503).json(unavailable);
}

// La interfaz muestra "no disponible" ante cualquier error; el motivo real queda en la consola.
function reject(
  res: Response,
  route: string,
  status: 400 | 404,
  error: string,
  detail?: unknown,
): void {
  console.warn(`[assistant] ${route} ${status}: ${error}`, detail ?? '');
  res.status(status).json({ error });
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
      reject(res, '/adapt', 400, 'Pedido de adaptación inválido', parsed.error.issues);
      return;
    }
    const request: AdaptRequest = parsed.data;
    const original = getRecipe(request.recipeId);
    if (!original) {
      reject(res, '/adapt', 404, 'Receta no encontrada', request.recipeId);
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
        request.constraints,
        original,
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
      reject(res, '/ask', 400, 'Pedido de pregunta inválido', parsed.error.issues);
      return;
    }
    const request: AskRequest = parsed.data;
    const stored = getRecipe(request.recipeId);
    const storedStep = stored?.steps.find((s) => s.number === request.stepNumber);
    if (!stored || !storedStep) {
      reject(
        res,
        '/ask',
        404,
        'Receta o paso no encontrado',
        `${request.recipeId} paso ${request.stepNumber}`,
      );
      return;
    }
    const { recipe, step } = withStepView(stored, storedStep, request.stepView);

    try {
      const prompt = buildAskPrompt(recipe, step, request);
      const { value, provider, latencyMs } = await getSelector().run(async (llm, signal) =>
        parseAnswer(
          await llm.complete(prompt.user, { system: prompt.system, ...ANSWER_OPTIONS, signal }),
          maxSentences(request.skillLevel),
        ),
      );
      const allergenWarnings = findAnswerWarnings(
        [value.answer, value.moreDetail],
        request.constraints,
      );
      const body: AskResponse = {
        status: 'ok',
        ...value,
        ...(allergenWarnings.length > 0 && { allergenWarnings }),
        provider,
        latencyMs,
      };
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
      reject(res, '/explain', 400, 'Pedido de explicación inválido', parsed.error.issues);
      return;
    }
    const request: ExplainRequest = parsed.data;
    const stored = getRecipe(request.recipeId);
    const storedStep = stored?.steps.find((s) => s.number === request.stepNumber);
    if (!stored || !storedStep) {
      reject(
        res,
        '/explain',
        404,
        'Receta o paso no encontrado',
        `${request.recipeId} paso ${request.stepNumber}`,
      );
      return;
    }
    const { recipe, step } = withStepView(stored, storedStep, request.stepView);

    if (step.readyCue) {
      // El texto del paso es de la receta, pero también puede nombrar un alérgeno vigilado.
      const allergenWarnings = findAnswerWarnings([step.text, step.readyCue], request.constraints);
      const body: ExplainResponse = {
        status: 'ok',
        explanation: step.text,
        readyCue: step.readyCue,
        readyCueSource: 'recipe',
        ...(allergenWarnings.length > 0 && { allergenWarnings }),
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
      const allergenWarnings = findAnswerWarnings(
        [value.explanation, value.readyCue],
        request.constraints,
      );
      const body: ExplainResponse = {
        status: 'ok',
        ...value,
        readyCueSource: 'assistant',
        ...(allergenWarnings.length > 0 && { allergenWarnings }),
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
