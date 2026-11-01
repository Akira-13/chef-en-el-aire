import { describe, expect, it } from 'vitest';
import { DeepSeekProvider } from './DeepSeekProvider';

const config = {
  apiKey: 'clave-de-prueba',
  model: 'modelo-x',
  baseUrl: 'https://deepseek.test/v1',
};

interface Captured {
  url: string;
  init: RequestInit;
}

function fakeFetch(response: Response, captured: Captured[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {} });
    return response;
  }) as typeof fetch;
}

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

describe('DeepSeekProvider', () => {
  it('exige la clave para estar configurado (RF-09)', () => {
    expect(new DeepSeekProvider({ ...config, apiKey: undefined }).isConfigured()).toBe(false);
    expect(new DeepSeekProvider(config).isConfigured()).toBe(true);
  });

  it('envía la petición compatible con OpenAI y devuelve el texto (RF-09)', async () => {
    const captured: Captured[] = [];
    const provider = new DeepSeekProvider(config, fakeFetch(ok('{"a":1}'), captured));
    const text = await provider.complete('hola', {
      system: 'sé breve',
      json: true,
      temperature: 0.2,
      maxTokens: 500,
    });
    expect(text).toBe('{"a":1}');
    const [call] = captured;
    expect(call?.url).toBe('https://deepseek.test/v1/chat/completions');
    expect((call?.init.headers as Record<string, string>).Authorization).toBe(
      'Bearer clave-de-prueba',
    );
    expect(JSON.parse(String(call?.init.body))).toEqual({
      model: 'modelo-x',
      messages: [
        { role: 'system', content: 'sé breve' },
        { role: 'user', content: 'hola' },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
    });
  });

  it('no pide formato JSON si no se necesita (RF-09)', async () => {
    const captured: Captured[] = [];
    await new DeepSeekProvider(config, fakeFetch(ok('hola'), captured)).complete('hola');
    expect(JSON.parse(String(captured[0]?.init.body))).not.toHaveProperty('response_format');
  });

  it('desactiva el razonamiento también sin formato JSON (RNF-14)', async () => {
    const captured: Captured[] = [];
    await new DeepSeekProvider(config, fakeFetch(ok('hola'), captured)).complete('hola');
    expect(JSON.parse(String(captured[0]?.init.body)).thinking).toEqual({ type: 'disabled' });
  });

  it('trata un 429 como falla e incluye estado y cuerpo recortado, sin la clave (RF-10)', async () => {
    const body = `límite de uso ${'x'.repeat(500)}`;
    const provider = new DeepSeekProvider(config, fakeFetch(new Response(body, { status: 429 })));
    const error = await provider.complete('hola').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('DeepSeek respondió 429: límite de uso');
    expect(message.length).toBeLessThan(260);
    expect(message).not.toContain('clave-de-prueba');
  });

  it('falla si la respuesta no trae texto (RF-10)', async () => {
    const provider = new DeepSeekProvider(config, fakeFetch(new Response('{}', { status: 200 })));
    await expect(provider.complete('hola')).rejects.toThrow();
  });

  it('falla sin clave en vez de llamar a la red (RF-10)', async () => {
    const captured: Captured[] = [];
    const provider = new DeepSeekProvider(
      { ...config, apiKey: undefined },
      fakeFetch(ok('x'), captured),
    );
    await expect(provider.complete('hola')).rejects.toThrow();
    expect(captured).toHaveLength(0);
  });

  it('pasa la señal de cancelación a la petición (RF-10)', async () => {
    const captured: Captured[] = [];
    const controller = new AbortController();
    await new DeepSeekProvider(config, fakeFetch(ok('x'), captured)).complete('hola', {
      signal: controller.signal,
    });
    expect(captured[0]?.init.signal).toBe(controller.signal);
  });
});
