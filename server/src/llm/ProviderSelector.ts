// Selector de proveedor del Gateway LLM: prueba el principal y, si falla, expira o devuelve
// algo que no se puede interpretar, el alterno. Si ninguno responde lanza
// AssistantUnavailableError y la ruta contesta "no disponible" (RF-10, CA-08.1, CA-08.3).

import type { LLMProviderId } from '@chef/shared';
import type { LlmConfig, ServerConfig } from '../config';
import { DeepSeekProvider } from './DeepSeekProvider';
import type { LLMProvider } from './LLMProvider';
import { OllamaProvider } from './OllamaProvider';

export class AssistantUnavailableError extends Error {
  constructor(message = 'Ningún proveedor de LLM respondió') {
    super(message);
    this.name = 'AssistantUnavailableError';
  }
}

export interface SelectorResult<T> {
  value: T;
  provider: LLMProviderId;
  latencyMs: number;
}

/** Trabajo que se prueba con cada proveedor: pedir la respuesta y convertirla al resultado. */
export type ProviderTask<T> = (provider: LLMProvider, signal: AbortSignal) => Promise<T>;

type Providers = Partial<Record<LLMProviderId, LLMProvider>>;

export class ProviderSelector {
  constructor(
    private readonly llm: LlmConfig,
    private readonly providers: Providers,
    private readonly log: (message: string) => void = console.log,
  ) {}

  async run<T>(task: ProviderTask<T>): Promise<SelectorResult<T>> {
    const order = [this.llm.primary, this.llm.fallback].filter(
      (id, i, all): id is LLMProviderId => id !== null && all.indexOf(id) === i,
    );
    for (const id of order) {
      const provider = this.providers[id];
      if (!provider?.isConfigured()) {
        this.log(`[llm] ${id} no está configurado, se omite`);
        continue;
      }
      const startedAt = performance.now();
      try {
        const value = await this.attempt(provider, task);
        const latencyMs = Math.round(performance.now() - startedAt);
        this.log(`[llm] respondió ${id} en ${latencyMs} ms`);
        return { value, provider: id, latencyMs };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.log(`[llm] ${id} falló: ${reason}`);
      }
    }
    throw new AssistantUnavailableError();
  }

  // Cada intento tiene su propio límite de tiempo: al vencer se cancela la petición y, por si
  // el proveedor ignora la señal, se deja de esperarlo.
  private async attempt<T>(provider: LLMProvider, task: ProviderTask<T>): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`tiempo límite de ${this.llm.timeoutMs} ms`));
      }, this.llm.timeoutMs);
    });
    const work = task(provider, controller.signal);
    work.catch(() => undefined);
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Arma el selector con los adaptadores reales; las pruebas inyectan proveedores falsos. */
export function createSelector(
  config: ServerConfig,
  providers: Providers = {},
  log?: (message: string) => void,
): ProviderSelector {
  return new ProviderSelector(
    config.llm,
    {
      remoto: new DeepSeekProvider(config.deepseek),
      ollama: new OllamaProvider(config.ollama),
      ...providers,
    },
    log,
  );
}
