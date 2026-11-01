// Adaptador de DeepSeek (API compatible con OpenAI) para el Gateway LLM (RF-09, RNF-14).
// Cualquier estado distinto de 2xx, incluido el 429 por límite de uso, es una falla del
// proveedor y el selector prueba el alterno (RF-10).

import type { ServerConfig } from '../config';
import type { CompletionOptions, LLMProvider } from './LLMProvider';

export class DeepSeekProvider implements LLMProvider {
  readonly id = 'remoto';

  constructor(
    private readonly config: ServerConfig['deepseek'],
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    if (!this.config.apiKey) throw new Error('DeepSeek: falta DEEPSEEK_API_KEY');
    const messages = [
      ...(options.system ? [{ role: 'system', content: options.system }] : []),
      { role: 'user', content: prompt },
    ];
    const res = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        ...(options.json && { response_format: { type: 'json_object' } }),
        // Con el razonamiento activo, los tokens de pensamiento agotan max_tokens y cortan el
        // JSON, y la latencia pasa del límite de 8 s (medido: ~5 s sin razonar, >8 s con él).
        thinking: { type: 'disabled' },
      }),
      signal: options.signal,
    });
    if (!res.ok) {
      // El cuerpo ayuda a diagnosticar (límite de uso, modelo inexistente) sin exponer la clave.
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      throw new Error(`DeepSeek respondió ${res.status}: ${detail}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('DeepSeek devolvió una respuesta vacía');
    return content;
  }
}
