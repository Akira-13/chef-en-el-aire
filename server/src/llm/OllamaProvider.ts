// Adaptador de Ollama, el proveedor local opcional del Gateway LLM (RF-09, RNF-14).

import type { ServerConfig } from '../config';
import type { CompletionOptions, LLMProvider } from './LLMProvider';

export class OllamaProvider implements LLMProvider {
  readonly id = 'ollama';

  constructor(
    private readonly config: ServerConfig['ollama'],
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.url);
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    const messages = [
      ...(options.system ? [{ role: 'system', content: options.system }] : []),
      { role: 'user', content: prompt },
    ];
    const res = await this.fetchImpl(`${this.config.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false,
        ...(options.json && { format: 'json' }),
        options: { temperature: options.temperature, num_predict: options.maxTokens },
      }),
      signal: options.signal,
    });
    if (!res.ok) throw new Error(`Ollama respondió ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content;
    if (!content) throw new Error('Ollama devolvió una respuesta vacía');
    return content;
  }
}
