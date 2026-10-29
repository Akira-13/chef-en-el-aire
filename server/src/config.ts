// Configuración del servidor. El proveedor de LLM se elige en llm.config.json y las claves
// salen de server/.env: cambiar de proveedor no toca la interfaz de usuario (RF-09, CA-08.1).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { LLMProviderId } from '@chef/shared';

const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));
const LLM_CONFIG_FILE = fileURLToPath(new URL('../llm.config.json', import.meta.url));

export interface LlmConfig {
  primary: LLMProviderId;
  fallback: LLMProviderId | null;
  timeoutMs: number;
}

export interface ServerConfig {
  llm: LlmConfig;
  groq: { apiKey: string | undefined; model: string; baseUrl: string };
  ollama: { url: string; model: string };
}

interface RawLlmConfig {
  llm: { principal: LLMProviderId; alterno?: LLMProviderId | null; tiempo_limite_ms?: number };
}

export function loadEnvFile(): void {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch {
    // Sin server/.env el servidor arranca igual; el asistente responderá "no disponible".
  }
}

export function loadConfig(): ServerConfig {
  const raw = JSON.parse(readFileSync(LLM_CONFIG_FILE, 'utf8')) as RawLlmConfig;
  return {
    llm: {
      primary: raw.llm.principal,
      fallback: raw.llm.alterno ?? null,
      timeoutMs: raw.llm.tiempo_limite_ms ?? 8000,
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY || undefined,
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    },
    ollama: {
      url: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3.1',
    },
  };
}
