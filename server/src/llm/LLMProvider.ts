// Interfaz única de acceso a un LLM (RF-09). Cada proveedor es un adaptador que la implementa;
// añadir un proveedor es escribir un adaptador nuevo, sin cambios en la interfaz de usuario (RNF-14).

import type { LLMProviderId } from '@chef/shared';

export interface CompletionOptions {
  /** Instrucciones de sistema. */
  system?: string;
  /** Pide al proveedor que responda solo con un objeto JSON. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Permite cortar la petición al vencer el tiempo límite (RF-10). */
  signal?: AbortSignal;
}

export interface LLMProvider {
  readonly id: LLMProviderId;
  /** Indica si el proveedor tiene lo necesario para responder (clave, URL). */
  isConfigured(): boolean;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
}
