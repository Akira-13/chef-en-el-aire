import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ASSISTANT_UNAVAILABLE_MESSAGE,
  toRawRecipe,
  type AdaptRequest,
  type AdaptResponse,
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
