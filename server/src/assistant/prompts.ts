// Prompts del asistente. El modelo recibe la receta en el formato de los datos (claves en
// español, como datos/recetas.json) y debe devolver esa misma estructura para que la receta
// adaptada se convierta con toRecipe sin pasos intermedios (CA-04.3).

import { ALLERGEN_LABELS, toRawRecipe, type AdaptRequest, type Recipe } from '@chef/shared';

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

function describeConstraints(request: AdaptRequest): string {
  const { allergies, dinerRestrictions, diet } = request.constraints;
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
    describeConstraints(request),
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
