import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AssistantUnavailable, LLMProviderId, Recipe } from '@chef/shared';
import { createApp } from './app';
import type { LLMProvider } from './llm/LLMProvider';

let server: Server;
let baseUrl: string;

// Proveedores que siempre fallan: la API se prueba sin red.
const failing = (id: LLMProviderId): LLMProvider => ({
  id,
  isConfigured: () => true,
  complete: async () => {
    throw new Error('caído');
  },
});

beforeAll(async () => {
  server = createApp({
    providers: { remoto: failing('remoto'), ollama: failing('ollama') },
    llmLog: () => {},
  }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('API de recetas', () => {
  it('devuelve las 10 recetas ya convertidas', async () => {
    const res = await fetch(`${baseUrl}/api/recipes`);
    const recipes = (await res.json()) as Recipe[];
    expect(res.status).toBe(200);
    expect(recipes).toHaveLength(10);
    expect(recipes[0]?.steps[0]?.shortText).toBeTruthy();
  });

  it('responde 404 para una receta inexistente', async () => {
    const res = await fetch(`${baseUrl}/api/recipes/REC-999`);
    expect(res.status).toBe(404);
  });
});

describe('API del asistente', () => {
  it('responde "no disponible" si ningún proveedor contesta (RF-10, CA-08.3)', async () => {
    const res = await fetch(`${baseUrl}/api/assistant/adapt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipeId: 'REC-001',
        constraints: { allergies: [], dinerRestrictions: [], diet: 'omnivora' },
        pantry: [],
        skillLevel: 'novato',
      }),
    });
    const body = (await res.json()) as AssistantUnavailable;
    expect(res.status).toBe(503);
    expect(body.status).toBe('unavailable');
  });

  it('/ask y /explain siguen respondiendo "no disponible" por ahora (RF-10)', async () => {
    for (const route of ['ask', 'explain']) {
      const res = await fetch(`${baseUrl}/api/assistant/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(503);
    }
  });
});
