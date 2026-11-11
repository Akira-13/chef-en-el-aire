import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ASSISTANT_UNAVAILABLE_MESSAGE,
  toRawRecipe,
  type AdaptRequest,
  type AdaptResponse,
  type AskResponse,
  type ExplainResponse,
  type LLMProviderId,
} from '@chef/shared';
import { createApp } from '../app';
import { getRecipe } from '../data/recipes';
import type { LLMProvider } from '../llm/LLMProvider';

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function start(providers: Partial<Record<LLMProviderId, LLMProvider>>): Promise<string> {
  const server = createApp({ providers, llmLog: () => {} }).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return `http://localhost:${(server.address() as AddressInfo).port}`;
}

function fake(
  id: LLMProviderId,
  respond: (prompt: string, system: string | undefined) => string,
  prompts: string[] = [],
): LLMProvider {
  return {
    id,
    isConfigured: () => true,
    complete: async (prompt, options) => {
      prompts.push(prompt);
      return respond(prompt, options?.system);
    },
  };
}

const failing = (id: LLMProviderId): LLMProvider => ({
  id,
  isConfigured: () => true,
  complete: async () => {
    throw new Error('caído');
  },
});

const ocopa = getRecipe('REC-008')!;

// Respuestas del modelo falso a partir de la ocopa del recetario.
function llmAnswer(edit: (raw: ReturnType<typeof toRawRecipe>) => void): string {
  const raw = toRawRecipe(ocopa);
  edit(raw);
  return JSON.stringify({
    receta: raw,
    cambios: [
      {
        tipo: 'ingrediente',
        objetivo: 'ING-050',
        antes: 'maní tostado',
        despues: 'x',
        motivo: 'm',
      },
    ],
  });
}

// El modelo "olvida" quitar el maní: lo renombra y borra los alérgenos declarados.
const forgetsPeanut = () =>
  llmAnswer((raw) => {
    for (const ingredient of raw.ingredientes) ingredient.alergenos = [];
    raw.alergenos = [];
    raw.ingredientes.find((i) => i.id === 'ING-050')!.nombre = 'pasta de maní';
  });

// El modelo quita el maní y lo sustituye por semillas de zapallo.
const removesPeanut = () =>
  llmAnswer((raw) => {
    const peanut = raw.ingredientes.find((i) => i.id === 'ING-050')!;
    peanut.nombre = 'semillas de zapallo tostadas';
    peanut.alergenos = [];
    peanut.sustitutos = [];
    raw.alergenos = raw.alergenos.filter((a) => a !== 'mani');
    // Los pasos también dejan de nombrarlo.
    for (const step of raw.pasos) step.texto = step.texto.replace('el maní', 'las semillas');
  });

const diego: AdaptRequest = {
  recipeId: 'REC-008',
  constraints: { allergies: ['mani'], dinerRestrictions: [], diet: 'omnivora' },
  pantry: [],
  skillLevel: 'novato',
};

async function adapt(baseUrl: string, body: unknown) {
  const res = await fetch(`${baseUrl}/api/assistant/adapt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as AdaptResponse & { error?: string } };
}

describe('POST /api/assistant/adapt', () => {
  it('bloquea si el modelo olvida quitar el maní de la ocopa (CA-06.1)', async () => {
    const baseUrl = await start({ remoto: fake('remoto', forgetsPeanut) });
    const { status, body } = await adapt(baseUrl, diego);
    expect(status).toBe(200);
    expect(body.status).toBe('blocked');
    if (body.status !== 'blocked') return;
    expect(body.findings).toContainEqual({
      ingredientId: 'ING-050',
      ingredientName: 'pasta de maní',
      allergen: 'mani',
      source: 'profile',
    });
    expect(body.provider).toBe('remoto');
  });

  it('responde ok con la receta adaptada si no queda ningún alérgeno (CA-04.1)', async () => {
    const baseUrl = await start({ remoto: fake('remoto', removesPeanut) });
    const { body } = await adapt(baseUrl, diego);
    expect(body.status).toBe('ok');
    if (body.status !== 'ok') return;
    expect(body.original.ingredients.find((i) => i.id === 'ING-050')?.name).toBe('maní tostado');
    expect(body.adapted.ingredients.find((i) => i.id === 'ING-050')?.name).toBe(
      'semillas de zapallo tostadas',
    );
    expect(body.changes).toHaveLength(1);
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reemplaza la descripción que aún menciona el maní y responde ok (RNF-06)', async () => {
    const answer = () =>
      llmAnswer((raw) => {
        const peanut = raw.ingredientes.find((i) => i.id === 'ING-050')!;
        peanut.nombre = 'semillas de zapallo tostadas';
        peanut.alergenos = [];
        peanut.sustitutos = [];
        raw.alergenos = raw.alergenos.filter((a) => a !== 'mani');
        for (const step of raw.pasos) step.texto = step.texto.replace('el maní', 'las semillas');
        raw.descripcion = 'Papas en crema de huacatay, ají mirasol y maní.';
      });
    const baseUrl = await start({ remoto: fake('remoto', answer) });
    const { body } = await adapt(baseUrl, diego);
    expect(body.status).toBe('ok');
    if (body.status !== 'ok') return;
    const plain = body.adapted.description.normalize('NFD').replace(/\p{M}/gu, '');
    expect(plain).not.toMatch(/mani/i);
    expect(body.adapted.description).toBe('Versión adaptada de Ocopa arequipeña.');
  });

  it('reemplaza el nombre que menciona el alérgeno por el de la receta original (RNF-06)', async () => {
    const answer = () =>
      llmAnswer((raw) => {
        const peanut = raw.ingredientes.find((i) => i.id === 'ING-050')!;
        peanut.nombre = 'semillas de zapallo tostadas';
        peanut.alergenos = [];
        peanut.sustitutos = [];
        raw.alergenos = raw.alergenos.filter((a) => a !== 'mani');
        for (const step of raw.pasos) step.texto = step.texto.replace('el maní', 'las semillas');
        raw.nombre = 'Ocopa con maní';
      });
    const baseUrl = await start({ remoto: fake('remoto', answer) });
    const { body } = await adapt(baseUrl, diego);
    expect(body.status).toBe('ok');
    if (body.status !== 'ok') return;
    expect(body.adapted.name).toBe('Ocopa arequipeña');
  });

  it('conserva la descripción que devuelve el modelo si no menciona alérgenos (RNF-06)', async () => {
    const answer = () =>
      llmAnswer((raw) => {
        const peanut = raw.ingredientes.find((i) => i.id === 'ING-050')!;
        peanut.nombre = 'semillas de zapallo tostadas';
        peanut.alergenos = [];
        peanut.sustitutos = [];
        raw.alergenos = raw.alergenos.filter((a) => a !== 'mani');
        for (const step of raw.pasos) step.texto = step.texto.replace('el maní', 'las semillas');
        raw.descripcion = 'Papas en crema de huacatay y semillas de zapallo.';
      });
    const baseUrl = await start({ remoto: fake('remoto', answer) });
    const { body } = await adapt(baseUrl, diego);
    expect(body.status).toBe('ok');
    if (body.status !== 'ok') return;
    expect(body.adapted.description).toBe('Papas en crema de huacatay y semillas de zapallo.');
    expect(body.adapted.name).toBe('Ocopa arequipeña');
  });

  it('valida a los comensales además del perfil (CA-06.1, CA-23.1)', async () => {
    const baseUrl = await start({ remoto: fake('remoto', removesPeanut) });
    const { body } = await adapt(baseUrl, {
      ...diego,
      constraints: {
        allergies: [],
        dinerRestrictions: [{ diner: 'esposo', restriction: 'leche', reason: 'lactosa' }],
        diet: 'omnivora',
      },
    });
    expect(body.status).toBe('blocked');
    if (body.status !== 'blocked') return;
    expect(body.findings.every((f) => f.source === 'diner' && f.diner === 'esposo')).toBe(true);
  });

  it('escala la receta antes del modelo y conserva el id original (CA-04.2)', async () => {
    const prompts: string[] = [];
    const baseUrl = await start({ remoto: fake('remoto', removesPeanut, prompts) });
    const { body } = await adapt(baseUrl, { ...diego, servings: 2 });
    // La ocopa de 4 porciones llega al modelo con la mitad de papas (6 → 3).
    expect(prompts[0]).toContain('"porciones": 2');
    expect(prompts[0]).toMatch(/"id": "ING-047"[\s\S]*?"cantidad": 3,/);
    expect(body.status).toBe('ok');
    if (body.status !== 'ok') return;
    expect(body.adapted.id).toBe('REC-008');
    expect(body.adapted.servings).toBe(2);
    expect(body.original.servings).toBe(4);
    expect(body.changes[0]).toMatchObject({ kind: 'servings', before: '4', after: '2' });
  });

  it('pasa al alterno si el principal devuelve algo que no es JSON (CA-04.3, CA-08.1)', async () => {
    const baseUrl = await start({
      remoto: fake('remoto', () => 'lo siento, no puedo'),
      ollama: fake('ollama', removesPeanut),
    });
    const { body } = await adapt(baseUrl, diego);
    expect(body.status).toBe('ok');
    if (body.status !== 'ok') return;
    expect(body.provider).toBe('ollama');
  });

  it('responde 503 "no disponible" si los dos proveedores fallan (CA-08.3)', async () => {
    const baseUrl = await start({ remoto: failing('remoto'), ollama: failing('ollama') });
    const { status, body } = await adapt(baseUrl, diego);
    expect(status).toBe(503);
    expect(body).toEqual({ status: 'unavailable', message: ASSISTANT_UNAVAILABLE_MESSAGE });
  });

  it('responde 400 si el pedido no cumple AdaptRequest', async () => {
    const baseUrl = await start({ remoto: fake('remoto', removesPeanut) });
    expect((await adapt(baseUrl, { recipeId: 'REC-008' })).status).toBe(400);
    expect((await adapt(baseUrl, { ...diego, skillLevel: 'experto' })).status).toBe(400);
  });

  it('responde 404 si la receta no existe', async () => {
    const baseUrl = await start({ remoto: fake('remoto', removesPeanut) });
    expect((await adapt(baseUrl, { ...diego, recipeId: 'REC-999' })).status).toBe(404);
  });
});

async function post(baseUrl: string, route: 'ask' | 'explain', body: unknown) {
  const res = await fetch(`${baseUrl}/api/assistant/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const ask = (baseUrl: string, body: unknown) =>
  post(baseUrl, 'ask', body) as Promise<{ status: number; body: AskResponse & { error?: string } }>;
const explain = (baseUrl: string, body: unknown) =>
  post(baseUrl, 'explain', body) as Promise<{
    status: number;
    body: ExplainResponse & { error?: string };
  }>;

const question = {
  recipeId: 'REC-008',
  stepNumber: 4,
  question: '¿Cuánto hiervo las papas?',
  skillLevel: 'novato',
};

const answerJson = (respuesta: string, detalle?: string) =>
  JSON.stringify({ respuesta, ...(detalle && { mas_detalle: detalle }) });

describe('POST /api/assistant/ask', () => {
  it('responde la duda con respuesta breve y más detalle (CA-07.1)', async () => {
    const prompts: string[] = [];
    const baseUrl = await start({
      remoto: fake(
        'remoto',
        () => answerJson('Unos 15 minutos. Hasta que se pinchen.', 'Detalle'),
        prompts,
      ),
    });
    const { status, body } = await ask(baseUrl, question);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      answer: 'Unos 15 minutos. Hasta que se pinchen.',
      moreDetail: 'Detalle',
      provider: 'remoto',
    });
    // El modelo recibe la pregunta con el paso actual de la receta.
    expect(prompts[0]).toContain('¿Cuánto hiervo las papas?');
    expect(prompts[0]).toContain('Paso 4');
  });

  it('recorta a 2 frases si el modelo se pasa (CA-07.1)', async () => {
    const baseUrl = await start({ remoto: fake('remoto', () => answerJson('Uno. Dos. Tres.')) });
    const { body } = await ask(baseUrl, question);
    expect(body).toMatchObject({ answer: 'Uno. Dos.' });
  });

  it('manda las restricciones del perfil al modelo para no sugerir alérgenos (RF-07)', async () => {
    const prompts: string[] = [];
    const baseUrl = await start({ remoto: fake('remoto', () => answerJson('Ok.'), prompts) });
    await ask(baseUrl, { ...question, constraints: diego.constraints });
    expect(prompts[0]).toContain('maní');
  });

  it('avisa sin bloquear si la respuesta menciona un alérgeno del perfil (RF-07, RNF-06)', async () => {
    const baseUrl = await start({
      remoto: fake('remoto', () => answerJson('No agregues maní, eres alérgico.')),
    });
    const { status, body } = await ask(baseUrl, { ...question, constraints: diego.constraints });
    expect(status).toBe(200);
    // La respuesta llega intacta: una negación legítima también nombra el alérgeno.
    expect(body).toMatchObject({
      status: 'ok',
      answer: 'No agregues maní, eres alérgico.',
      allergenWarnings: ['mani'],
    });
  });

  it('revisa también el detalle (RF-07, RNF-06)', async () => {
    const baseUrl = await start({
      remoto: fake('remoto', () => answerJson('Unos 15 minutos.', 'Sin maní en la salsa.')),
    });
    const { body } = await ask(baseUrl, { ...question, constraints: diego.constraints });
    expect(body).toMatchObject({ allergenWarnings: ['mani'] });
  });

  it('no repite la categoría si se menciona en la respuesta y el detalle (RF-07, RNF-06)', async () => {
    const baseUrl = await start({
      remoto: fake('remoto', () =>
        answerJson('Evita el maní.', 'Tampoco uses pasta de maní ni cacahuate.'),
      ),
    });
    const { body } = await ask(baseUrl, { ...question, constraints: diego.constraints });
    expect(body).toMatchObject({ allergenWarnings: ['mani'] });
  });

  it('avisa del alérgeno de un comensal (RF-07, RNF-06)', async () => {
    const baseUrl = await start({
      remoto: fake('remoto', () => answerJson('Sirve con un chorrito de leche.')),
    });
    const { body } = await ask(baseUrl, {
      ...question,
      constraints: {
        allergies: [],
        dinerRestrictions: [{ diner: 'esposo', restriction: 'leche', reason: 'lactosa' }],
        diet: 'omnivora',
      },
    });
    expect(body).toMatchObject({ allergenWarnings: ['leche'] });
  });

  it('sin alérgenos en la respuesta no agrega avisos (RF-07)', async () => {
    const baseUrl = await start({
      remoto: fake('remoto', () => answerJson('Unos 15 minutos.', 'Hasta que se pinchen.')),
    });
    const { body } = await ask(baseUrl, { ...question, constraints: diego.constraints });
    expect(body).not.toHaveProperty('allergenWarnings');
  });

  it('ignora los alérgenos que no vigila el perfil y no avisa sin restricciones (RF-07)', async () => {
    const baseUrl = await start({ remoto: fake('remoto', () => answerJson('Usa leche y maní.')) });
    const other = await ask(baseUrl, {
      ...question,
      constraints: { allergies: ['soya'], dinerRestrictions: [], diet: 'omnivora' },
    });
    expect(other.body).not.toHaveProperty('allergenWarnings');
    expect((await ask(baseUrl, question)).body).not.toHaveProperty('allergenWarnings');
  });

  it('usa una frase y el tono del perfil para un avanzado (RF-41, CA-33.1)', async () => {
    const seen: Array<{ prompt: string; system?: string }> = [];
    const baseUrl = await start({
      remoto: fake('remoto', (prompt, system) => {
        seen.push({ prompt, system });
        return answerJson('Uno. Dos.');
      }),
    });
    const { body } = await ask(baseUrl, {
      ...question,
      skillLevel: 'avanzado',
      tone: 'cordial y directo',
    });
    expect(seen[0]?.system).toMatch(/UNA sola frase/);
    expect(seen[0]?.prompt).toContain('cordial y directo');
    expect(body).toMatchObject({ answer: 'Uno.' });
  });

  it('pasa al alterno si el principal devuelve algo que no es JSON (CA-08.1)', async () => {
    const baseUrl = await start({
      remoto: fake('remoto', () => 'no sé'),
      ollama: fake('ollama', () => answerJson('Sí.')),
    });
    const { body } = await ask(baseUrl, question);
    expect(body).toMatchObject({ status: 'ok', provider: 'ollama' });
  });

  it('responde 503 "no disponible" si ningún proveedor contesta (CA-08.3)', async () => {
    const baseUrl = await start({ remoto: failing('remoto'), ollama: failing('ollama') });
    const { status, body } = await ask(baseUrl, question);
    expect(status).toBe(503);
    expect(body).toEqual({ status: 'unavailable', message: ASSISTANT_UNAVAILABLE_MESSAGE });
  });

  it('responde 400 si el pedido es inválido y 404 si no existe la receta o el paso', async () => {
    const baseUrl = await start({ remoto: fake('remoto', () => answerJson('Ok.')) });
    expect((await ask(baseUrl, { recipeId: 'REC-008' })).status).toBe(400);
    expect((await ask(baseUrl, { ...question, question: '  ' })).status).toBe(400);
    expect((await ask(baseUrl, { ...question, skillLevel: 'experto' })).status).toBe(400);
    expect((await ask(baseUrl, { ...question, recipeId: 'REC-999' })).status).toBe(404);
    expect((await ask(baseUrl, { ...question, stepNumber: 99 })).status).toBe(404);
  });
});

describe('paso adaptado en /ask y /explain', () => {
  // La receta adaptada solo existe en el dispositivo: el cliente manda el paso tal como lo ve.
  const original = ocopa.steps[0]!;
  const stepView = {
    servings: 2,
    text: 'Licúa las semillas de girasol con el ají.',
    warning: 'No calientes demasiado.',
    readyCue: 'La crema queda espesa.',
  };

  it('/ask pregunta por el paso adaptado, no por el original', async () => {
    const prompts: string[] = [];
    const baseUrl = await start({
      remoto: fake('remoto', () => answerJson('Ok.'), prompts),
    });
    await ask(baseUrl, { ...question, stepNumber: original.number, stepView });
    expect(prompts[0]).toContain(stepView.text);
    expect(prompts[0]).toContain('2 porciones');
    expect(prompts[0]).toContain(stepView.warning);
    expect(prompts[0]).not.toContain(original.text);
  });

  it('/explain devuelve el texto y la pista adaptados cuando el paso trae pista', async () => {
    const baseUrl = await start({});
    const { status, body } = await explain(baseUrl, {
      recipeId: 'REC-008',
      stepNumber: original.number,
      skillLevel: 'novato',
      stepView,
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({
      explanation: stepView.text,
      readyCue: stepView.readyCue,
      readyCueSource: 'recipe',
    });
  });

  it('/explain pide la pista al modelo si el paso adaptado no la trae', async () => {
    const prompts: string[] = [];
    const baseUrl = await start({
      remoto: fake(
        'remoto',
        () => JSON.stringify({ explicacion: 'Se explica.', pista_listo: 'Se ve cremoso.' }),
        prompts,
      ),
    });
    const { text, warning } = stepView;
    const { body } = await explain(baseUrl, {
      recipeId: 'REC-008',
      stepNumber: original.number,
      skillLevel: 'novato',
      stepView: { servings: 2, text, warning },
    });
    expect(body).toMatchObject({ readyCueSource: 'assistant' });
    expect(prompts[0]).toContain(text);
    expect(prompts[0]).not.toContain(original.text);
  });

  it('sin paso adaptado sigue usando el original', async () => {
    const prompts: string[] = [];
    const baseUrl = await start({ remoto: fake('remoto', () => answerJson('Ok.'), prompts) });
    await ask(baseUrl, { ...question, stepNumber: original.number });
    expect(prompts[0]).toContain(original.text);
  });

  it('rechaza un paso adaptado mal formado', async () => {
    const baseUrl = await start({});
    const { status } = await ask(baseUrl, { ...question, stepView: { servings: 0, text: '' } });
    expect(status).toBe(400);
  });
});

describe('POST /api/assistant/explain', () => {
  // En la ocopa el paso 1 trae pista_listo y el 4 no.
  const withCue = ocopa.steps[0]!;
  const withoutCue = ocopa.steps[3]!;
  const explainBody = { recipeId: 'REC-008', stepNumber: withoutCue.number, skillLevel: 'novato' };
  const generated = JSON.stringify({ explicacion: 'Se explica.', pista_listo: 'Se ve cremoso.' });

  it('usa la pista de los datos sin llamar al LLM (CA-10.1)', async () => {
    const prompts: string[] = [];
    const baseUrl = await start({ remoto: fake('remoto', () => generated, prompts) });
    const { status, body } = await explain(baseUrl, { ...explainBody, stepNumber: withCue.number });
    expect(status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      explanation: withCue.text,
      readyCue: withCue.readyCue,
      readyCueSource: 'recipe',
      provider: null,
    });
    expect(prompts).toHaveLength(0);
  });

  it('con la pista de los datos responde aun sin proveedores (CA-10.1, RF-10)', async () => {
    const baseUrl = await start({});
    const { status, body } = await explain(baseUrl, { ...explainBody, stepNumber: withCue.number });
    expect(status).toBe(200);
    expect(body).toMatchObject({ readyCueSource: 'recipe' });
  });

  it('genera la pista con el LLM y la marca como del asistente (CA-10.2)', async () => {
    const baseUrl = await start({ remoto: fake('remoto', () => generated) });
    const { body } = await explain(baseUrl, explainBody);
    expect(body).toMatchObject({
      status: 'ok',
      explanation: 'Se explica.',
      readyCue: 'Se ve cremoso.',
      readyCueSource: 'assistant',
      provider: 'remoto',
    });
  });

  it('manda el nivel y las restricciones al generar la explicación (RF-41, RF-07)', async () => {
    const seen: Array<{ prompt: string; system?: string }> = [];
    const baseUrl = await start({
      remoto: fake('remoto', (prompt, system) => {
        seen.push({ prompt, system });
        return generated;
      }),
    });
    await explain(baseUrl, {
      ...explainBody,
      skillLevel: 'avanzado',
      constraints: diego.constraints,
    });
    expect(seen[0]?.system).toMatch(/UNA sola frase/);
    expect(seen[0]?.prompt).toContain('maní');
  });

  it('avisa si la explicación o la pista del modelo nombran un alérgeno del perfil (RF-07, RNF-06)', async () => {
    const mentionsPeanut = (explicacion: string, pista: string) =>
      JSON.stringify({ explicacion, pista_listo: pista });
    const constraints = diego.constraints;
    const inExplanation = await start({
      remoto: fake('remoto', () => mentionsPeanut('Agrega el maní molido.', 'Se ve cremoso.')),
    });
    expect((await explain(inExplanation, { ...explainBody, constraints })).body).toMatchObject({
      allergenWarnings: ['mani'],
    });
    const inCue = await start({
      remoto: fake('remoto', () => mentionsPeanut('Se explica.', 'Sabe a maní tostado.')),
    });
    expect((await explain(inCue, { ...explainBody, constraints })).body).toMatchObject({
      allergenWarnings: ['mani'],
    });
  });

  it('avisa del alérgeno de un comensal en la explicación del modelo (RF-07, RNF-06)', async () => {
    const baseUrl = await start({
      remoto: fake('remoto', () =>
        JSON.stringify({ explicacion: 'Añade un poco de leche.', pista_listo: 'Se ve cremoso.' }),
      ),
    });
    const { body } = await explain(baseUrl, {
      ...explainBody,
      constraints: {
        allergies: [],
        dinerRestrictions: [{ diner: 'esposo', restriction: 'leche', reason: 'lactosa' }],
        diet: 'omnivora',
      },
    });
    expect(body).toMatchObject({ allergenWarnings: ['leche'] });
  });

  it('sin alérgenos vigilados en la explicación no agrega avisos (RF-07)', async () => {
    const baseUrl = await start({ remoto: fake('remoto', () => generated) });
    const other = await explain(baseUrl, { ...explainBody, constraints: diego.constraints });
    expect(other.body).not.toHaveProperty('allergenWarnings');
    expect((await explain(baseUrl, explainBody)).body).not.toHaveProperty('allergenWarnings');
    const unwatched = await start({
      remoto: fake('remoto', () =>
        JSON.stringify({ explicacion: 'Usa leche.', pista_listo: 'Se ve cremoso.' }),
      ),
    });
    const { body } = await explain(unwatched, { ...explainBody, constraints: diego.constraints });
    expect(body).not.toHaveProperty('allergenWarnings');
  });

  it('también avisa con la pista de los datos si el texto del paso nombra un alérgeno (RF-07)', async () => {
    // El paso 3 de la ocopa trae pista_listo y su texto nombra el maní.
    const baseUrl = await start({});
    const { body } = await explain(baseUrl, {
      ...explainBody,
      stepNumber: 3,
      constraints: diego.constraints,
    });
    expect(body).toMatchObject({ readyCueSource: 'recipe', allergenWarnings: ['mani'] });
    const clean = await explain(baseUrl, {
      ...explainBody,
      stepNumber: withCue.number,
      constraints: diego.constraints,
    });
    expect(clean.body).not.toHaveProperty('allergenWarnings');
  });

  it('responde 503 "no disponible" si falta la pista y nadie contesta (CA-08.3)', async () => {
    const baseUrl = await start({ remoto: failing('remoto'), ollama: failing('ollama') });
    const { status, body } = await explain(baseUrl, explainBody);
    expect(status).toBe(503);
    expect(body).toEqual({ status: 'unavailable', message: ASSISTANT_UNAVAILABLE_MESSAGE });
  });

  it('responde 400 y 404 ante pedidos inválidos', async () => {
    const baseUrl = await start({ remoto: fake('remoto', () => generated) });
    expect((await explain(baseUrl, { recipeId: 'REC-008' })).status).toBe(400);
    expect((await explain(baseUrl, { ...explainBody, recipeId: 'REC-999' })).status).toBe(404);
    expect((await explain(baseUrl, { ...explainBody, stepNumber: 99 })).status).toBe(404);
  });
});
