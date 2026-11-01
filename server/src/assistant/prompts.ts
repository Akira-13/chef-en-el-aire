// Prompts del asistente. El modelo recibe la receta en el formato de los datos (claves en
// español, como datos/recetas.json) y debe devolver esa misma estructura para que la receta
// adaptada se convierta con toRecipe sin pasos intermedios (CA-04.3).

import {
  ALLERGEN_LABELS,
  toRawRecipe,
  type AdaptRequest,
  type AskRequest,
  type DietaryConstraints,
  type ExplainRequest,
  type Feeling,
  type Recipe,
  type SkillLevel,
  type Step,
} from '@chef/shared';

export interface Prompt {
  system: string;
  user: string;
}

const ADAPT_SYSTEM = `Eres el asistente de una app de cocina peruana. Adaptas recetas al perfil del usuario.

Responde SOLO con un objeto JSON, sin texto antes ni después y sin bloques de código, con esta forma:
{
  "receta": <la receta completa con la MISMA estructura que recibiste>,
  "cambios": [
    { "tipo": "ingrediente" | "paso" | "porciones", "objetivo": "<id del ingrediente o número de paso>", "antes": "<texto original>", "despues": "<texto nuevo>", "motivo": "<por qué, en una frase>" }
  ]
}

Reglas:
- Conserva el id de los ingredientes que se mantienen o se sustituyen; un ingrediente nuevo lleva un id nuevo que empieza con "ING-N".
- Nunca agregues ingredientes con alérgenos de la lista del usuario ni de sus comensales; si un ingrediente los tiene, quítalo o sustitúyelo.
- Actualiza "nombre" y "descripcion" para que no mencionen ingredientes quitados o sustituidos ni ningún alérgeno del usuario o de sus comensales.
- Usa unidades caseras (cda, cdta, taza, unidad, g, ml) y no cambies las cantidades que ya recibiste, salvo en los ingredientes que sustituyas.
- Explica cada cambio en "motivo" con lenguaje simple.
- Mantén los pasos, los temporizadores y la estructura; ajusta solo lo que el cambio exija.
- Si la receta ya cumple todo, devuelve la misma receta y "cambios" vacío.
- Escribe todo en español.`;

function describeConstraints({ allergies, dinerRestrictions, diet }: DietaryConstraints): string {
  const lines = [
    `Alergias del usuario: ${allergies.length ? allergies.map((a) => ALLERGEN_LABELS[a]).join(', ') : 'ninguna'}`,
    `Restricciones de comensales: ${
      dinerRestrictions.length
        ? dinerRestrictions
            .map((r) => `${r.diner} (${ALLERGEN_LABELS[r.restriction]}, ${r.reason})`)
            .join('; ')
        : 'ninguna'
    }`,
    `Dieta: ${diet}`,
  ];
  return lines.join('\n');
}

/** Prompt para adaptar `recipe` (ya escalada a las porciones pedidas) al perfil del pedido. */
export function buildAdaptPrompt(recipe: Recipe, request: AdaptRequest): Prompt {
  const user = [
    describeConstraints(request.constraints),
    `Despensa del usuario: ${request.pantry.length ? request.pantry.join(', ') : 'sin datos'}`,
    `Nivel de cocina: ${request.skillLevel}`,
    `Porciones: ${recipe.servings}`,
    `Pedido del usuario: ${request.note?.trim() || 'ninguno'}`,
    '',
    'Receta (JSON):',
    JSON.stringify(toRawRecipe(recipe), null, 2),
  ].join('\n');
  return { system: ADAPT_SYSTEM, user };
}

// Los pedidos de pregunta y explicación pueden traer las restricciones del perfil para que el
// modelo nunca sugiera un alérgeno; el contrato compartido todavía no las declara.
export type AskInput = AskRequest & { constraints?: DietaryConstraints };
export type ExplainInput = ExplainRequest & { constraints?: DietaryConstraints };

// RF-41, CA-33.1: el novato recibe una explicación tranquilizadora; el avanzado, una sola frase.
const TONE_BY_LEVEL: Record<SkillLevel, string> = {
  novato:
    'Habla con un tono tranquilizador y explicativo: explica el porqué en palabras simples y evita términos técnicos sin aclararlos.',
  intermedio: 'Habla con un tono cercano y claro, sin explicar lo básico.',
  avanzado:
    'Responde en UNA sola frase, directa y sin rodeos, sin explicar lo básico ni tranquilizar.',
};

const FEELING_LABELS: Record<Feeling, string> = {
  nervous: 'nervioso',
  tired: 'cansado',
  confused: 'confundido',
  happy: 'contento',
};

/** Frases que permite la respuesta según el nivel; la ruta recorta lo que el modelo exceda. */
export function maxSentences(level: SkillLevel): number {
  return level === 'avanzado' ? 1 : 2;
}

function toneSection(level: SkillLevel): string {
  return TONE_BY_LEVEL[level];
}

function describeUser(request: AskInput | ExplainInput): string[] {
  const lines = [`Nivel de cocina: ${request.skillLevel}`];
  if ('tone' in request && request.tone?.trim()) {
    lines.push(`Tono preferido por el usuario: ${request.tone.trim()}`);
  }
  if ('feeling' in request && request.feeling) {
    lines.push(`El usuario se siente ${FEELING_LABELS[request.feeling]}: tenlo en cuenta.`);
  }
  if (request.constraints) lines.push(describeConstraints(request.constraints));
  return lines;
}

function describeStep(recipe: Recipe, step: Step): string[] {
  return [
    `Receta: ${recipe.name} (${recipe.servings} porciones)`,
    `Paso ${step.number} de ${recipe.steps.length}: ${step.text}`,
    ...(step.warning ? [`Advertencia del paso: ${step.warning}`] : []),
    ...(step.readyCue ? [`Señal de listo del paso: ${step.readyCue}`] : []),
  ];
}

const SAFETY_RULE =
  'Nunca sugieras ni recomiendes ingredientes con alérgenos de la lista del usuario ni de sus comensales, ni ingredientes que su dieta no permita.';

function askSystem(level: SkillLevel): string {
  const sentences = level === 'avanzado' ? '1 frase' : '2 frases como máximo';
  return `Eres el asistente de una app de cocina peruana que acompaña al usuario mientras cocina, con las manos ocupadas.

Responde SOLO con un objeto JSON, sin texto antes ni después y sin bloques de código, con esta forma:
{ "respuesta": "<respuesta breve, ${sentences}>", "mas_detalle": "<explicación más completa, opcional>" }

Reglas:
- Responde la pregunta considerando la receta y el paso actual.
- ${toneSection(level)}
- ${SAFETY_RULE}
- Si la pregunta no tiene que ver con cocinar, di en una frase que solo ayudas con la receta.
- Escribe todo en español, sin listas ni formato Markdown.`;
}

/** Prompt para una duda del usuario en el paso actual (RF-08, CA-07.1). */
export function buildAskPrompt(recipe: Recipe, step: Step, request: AskInput): Prompt {
  const user = [
    ...describeUser(request),
    ...describeStep(recipe, step),
    '',
    `Pregunta del usuario: ${request.question.trim()}`,
  ].join('\n');
  return { system: askSystem(request.skillLevel), user };
}

function explainSystem(level: SkillLevel): string {
  return `Eres el asistente de una app de cocina peruana que acompaña al usuario mientras cocina, con las manos ocupadas.

Responde SOLO con un objeto JSON, sin texto antes ni después y sin bloques de código, con esta forma:
{ "explicacion": "<explicación ampliada del paso>", "pista_listo": "<señal concreta y observable de cuándo está listo>" }

Reglas:
- Explica el paso que se indica y da una señal que se pueda ver, oler u oír (color, textura, sonido), no solo un tiempo.
- ${toneSection(level)}
- ${SAFETY_RULE}
- Escribe todo en español, sin listas ni formato Markdown.`;
}

/** Prompt para ampliar un paso y, si los datos no la traen, generar su señal de listo (RF-13). */
export function buildExplainPrompt(recipe: Recipe, step: Step, request: ExplainInput): Prompt {
  const user = [...describeUser(request), ...describeStep(recipe, step)].join('\n');
  return { system: explainSystem(request.skillLevel), user };
}
