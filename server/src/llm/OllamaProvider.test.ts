import { describe, expect, it } from 'vitest';
import { OllamaProvider } from './OllamaProvider';

const config = { url: 'http://ollama.test:11434', model: 'llama-x' };

function capturing(content: string, calls: { url: string; body: unknown }[]): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ message: { content } }), { status: 200 });
  }) as typeof fetch;
}

describe('OllamaProvider', () => {
  it('llama a /api/chat sin streaming y con formato JSON (RF-09)', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const provider = new OllamaProvider(config, capturing('{"a":1}', calls));
    const text = await provider.complete('hola', {
      system: 'sé breve',
      json: true,
      temperature: 0.3,
      maxTokens: 400,
    });
    expect(text).toBe('{"a":1}');
    expect(calls[0]?.url).toBe('http://ollama.test:11434/api/chat');
    expect(calls[0]?.body).toEqual({
      model: 'llama-x',
      messages: [
        { role: 'system', content: 'sé breve' },
        { role: 'user', content: 'hola' },
      ],
      stream: false,
      format: 'json',
      options: { temperature: 0.3, num_predict: 400 },
    });
  });

  it('falla ante un estado distinto de 2xx (RF-10)', async () => {
    const provider = new OllamaProvider(
      config,
      (async () => new Response('error', { status: 500 })) as unknown as typeof fetch,
    );
    await expect(provider.complete('hola')).rejects.toThrow('500');
  });

  it('se considera configurado si tiene URL (RF-09)', () => {
    expect(new OllamaProvider(config).isConfigured()).toBe(true);
    expect(new OllamaProvider({ ...config, url: '' }).isConfigured()).toBe(false);
  });
});
