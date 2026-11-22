// Medición de latencia del asistente (RNF-03, CU-04). Manda 20 preguntas a /ask y 5
// adaptaciones a /adapt, primero con el proveedor remoto y luego con Ollama si responde, y
// compara el p90 con los umbrales. Llama a servicios externos y puede costar dinero: se ejecuta
// a mano con `npm run measure:llm -w @chef/server` y no forma parte de `npm run check`.
//
// Cada pasada levanta una copia local del servidor en un puerto libre y desactiva el otro
// proveedor, para que la medición no se mezcle con el respaldo. El resultado se guarda en
// server/.data/, que no se sube al repositorio.

import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import type { LLMProviderId } from '@chef/shared';
import { createApp } from '../src/app';
import { loadConfig, loadEnvFile } from '../src/config';
import type { LLMProvider } from '../src/llm/LLMProvider';
import { judge, summarize, type LatencySummary, type Verdict } from './latencyStats';

const ASK_COUNT = 20;
const ADAPT_COUNT = 5;
const OUTPUT_DIR = fileURLToPath(new URL('../.data/', import.meta.url));

const QUESTIONS = [
  '¿Cuánto tiempo hiervo las papas?',
  '¿Puedo usar otra salsa?',
  '¿Cómo sé que está listo?',
  '¿Qué hago si se pega?',
];

const askBody = (i: number) => ({
  recipeId: 'REC-008',
  stepNumber: 4,
  question: QUESTIONS[i % QUESTIONS.length],
  skillLevel: 'novato',
});

const adaptBody = {
  recipeId: 'REC-008',
  constraints: { allergies: ['mani'], dinerRestrictions: [], diet: 'omnivora' },
  pantry: [],
  skillLevel: 'novato',
};

interface RouteResult {
  route: 'ask' | 'adapt';
  requests: number;
  failures: number;
  latencyMs: LatencySummary;
  verdict: Verdict;
}

interface PassResult {
  provider: LLMProviderId;
  routes: RouteResult[];
}

// Un proveedor apagado hace que el selector lo omita y use solo el otro.
const disabled = (id: LLMProviderId): LLMProvider => ({
  id,
  isConfigured: () => false,
  complete: async () => {
    throw new Error('desactivado para la medición');
  },
});

async function measureRoute(
  baseUrl: string,
  provider: LLMProviderId,
  route: 'ask' | 'adapt',
  count: number,
): Promise<RouteResult> {
  const samples: number[] = [];
  let failures = 0;
  for (let i = 0; i < count; i++) {
    const startedAt = performance.now();
    try {
      const res = await fetch(`${baseUrl}/api/assistant/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route === 'ask' ? askBody(i) : adaptBody),
      });
      const body = (await res.json()) as { status?: string };
      // Una respuesta "no disponible" no es una latencia de este proveedor.
      if (res.ok && body.status !== 'unavailable') samples.push(performance.now() - startedAt);
      else failures += 1;
    } catch {
      failures += 1;
    }
    console.log(`  ${route} ${i + 1}/${count}`);
  }
  const latencyMs = summarize(samples);
  return { route, requests: count, failures, latencyMs, verdict: judge(provider, latencyMs) };
}

async function runPass(provider: LLMProviderId): Promise<PassResult> {
  const other: LLMProviderId = provider === 'remoto' ? 'ollama' : 'remoto';
  const server: Server = createApp({
    providers: { [other]: disabled(other) },
    llmLog: () => {},
  }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  try {
    const routes = [
      await measureRoute(baseUrl, provider, 'ask', ASK_COUNT),
      await measureRoute(baseUrl, provider, 'adapt', ADAPT_COUNT),
    ];
    return { provider, routes };
  } finally {
    server.close();
  }
}

async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${loadConfig().ollama.url}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const seconds = (ms: number | null) => (ms === null ? 'sin datos' : `${(ms / 1000).toFixed(2)} s`);

function print({ provider, routes }: PassResult): void {
  console.log(`\nProveedor: ${provider}`);
  for (const r of routes) {
    const { latencyMs: l, verdict: v } = r;
    console.log(
      `  /${r.route}: ${l.count}/${r.requests} respuestas · p50 ${seconds(l.p50)} · p90 ${seconds(l.p90)} · máx ${seconds(l.max)}` +
        ` · umbral ${seconds(v.thresholdMs)} → ${v.pass ? 'CUMPLE' : 'NO CUMPLE'}`,
    );
  }
}

async function main(): Promise<void> {
  loadEnvFile();
  const passes: PassResult[] = [];
  const skipped: string[] = [];

  if (process.env.DEEPSEEK_API_KEY) {
    console.log('Midiendo el proveedor remoto…');
    passes.push(await runPass('remoto'));
  } else {
    skipped.push('remoto: falta DEEPSEEK_API_KEY en server/.env');
  }

  if (await ollamaAvailable()) {
    console.log('Midiendo Ollama…');
    passes.push(await runPass('ollama'));
  } else {
    skipped.push('ollama: no responde en la URL configurada');
  }

  passes.forEach(print);
  skipped.forEach((reason) => console.log(`\nOmitido, ${reason}`));
  if (passes.length === 0) {
    process.exitCode = 1;
    return;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const file = `${OUTPUT_DIR}llm-latency-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(
    file,
    JSON.stringify({ measuredAt: new Date().toISOString(), passes, skipped }, null, 2),
  );
  console.log(`\nResultado guardado en ${file}`);
  if (passes.some((p) => p.routes.some((r) => !r.verdict.pass))) process.exitCode = 1;
}

await main();
