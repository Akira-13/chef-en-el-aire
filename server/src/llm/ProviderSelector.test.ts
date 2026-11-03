import { describe, expect, it, vi } from 'vitest';
import type { LLMProviderId } from '@chef/shared';
import type { LlmConfig } from '../config';
import type { LLMProvider } from './LLMProvider';
import { AssistantUnavailableError, ProviderSelector } from './ProviderSelector';

const config: LlmConfig = { primary: 'remoto', fallback: 'ollama', timeoutMs: 50 };

function fake(
  id: LLMProviderId,
  complete: LLMProvider['complete'],
  configured = true,
): LLMProvider {
  return { id, isConfigured: () => configured, complete };
}

const answers = (id: LLMProviderId, text: string) => fake(id, async () => text);
const fails = (id: LLMProviderId) =>
  fake(id, async () => {
    throw new Error('caído');
  });
// Proveedor que nunca contesta; solo termina si lo cancelan.
const hangs = (id: LLMProviderId) =>
  fake(
    id,
    (_prompt, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('cancelado')));
      }),
  );

const task = (provider: LLMProvider, signal: AbortSignal) => provider.complete('hola', { signal });

function selector(
  providers: Partial<Record<LLMProviderId, LLMProvider>>,
  llm: LlmConfig = config,
  log = vi.fn(),
) {
  return { selector: new ProviderSelector(llm, providers, log), log };
}

describe('ProviderSelector', () => {
  it('usa el proveedor principal y mide el tiempo (CA-08.1)', async () => {
    const { selector: s, log } = selector({
      remoto: answers('remoto', 'principal'),
      ollama: answers('ollama', 'alterno'),
    });
    const result = await s.run(task);
    expect(result.value).toBe('principal');
    expect(result.provider).toBe('remoto');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('remoto'));
  });

  it('prueba el alterno si el principal falla (CA-08.1)', async () => {
    const { selector: s } = selector({
      remoto: fails('remoto'),
      ollama: answers('ollama', 'alterno'),
    });
    const result = await s.run(task);
    expect(result.value).toBe('alterno');
    expect(result.provider).toBe('ollama');
  });

  it('prueba el alterno si el principal pasa el tiempo límite (CA-08.1)', async () => {
    const { selector: s } = selector({
      remoto: hangs('remoto'),
      ollama: answers('ollama', 'alterno'),
    });
    const result = await s.run(task);
    expect(result.provider).toBe('ollama');
  });

  it('corta el intento vencido con la señal de cancelación (RF-10)', async () => {
    let aborted = false;
    const slow = fake(
      'remoto',
      (_p, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('cancelado'));
          });
        }),
    );
    const { selector: s } = selector({ remoto: slow, ollama: answers('ollama', 'x') });
    await s.run(task);
    expect(aborted).toBe(true);
  });

  it('corta aunque el proveedor ignore la señal (RF-10)', async () => {
    const ignoring = fake('remoto', () => new Promise(() => {}));
    const { selector: s } = selector({ remoto: ignoring, ollama: answers('ollama', 'x') });
    expect((await s.run(task)).provider).toBe('ollama');
  });

  it('cuenta como falla un resultado que no se puede interpretar (CA-04.3, CA-08.1)', async () => {
    const { selector: s } = selector({
      remoto: answers('remoto', 'no es json'),
      ollama: answers('ollama', '{"ok":true}'),
    });
    const result = await s.run(
      async (provider, signal) =>
        JSON.parse(await provider.complete('hola', { signal })) as { ok: boolean },
    );
    expect(result.value).toEqual({ ok: true });
    expect(result.provider).toBe('ollama');
  });

  it('lanza "no disponible" si los dos fallan (CA-08.3)', async () => {
    const { selector: s } = selector({ remoto: fails('remoto'), ollama: fails('ollama') });
    await expect(s.run(task)).rejects.toBeInstanceOf(AssistantUnavailableError);
  });

  it('lanza "no disponible" si los dos vencen el tiempo límite (CA-08.3)', async () => {
    const { selector: s } = selector({ remoto: hangs('remoto'), ollama: hangs('ollama') });
    await expect(s.run(task)).rejects.toBeInstanceOf(AssistantUnavailableError);
  });

  it('salta un proveedor sin configurar sin llamarlo (RF-10)', async () => {
    const complete = vi.fn(async () => 'nunca');
    const { selector: s } = selector({
      remoto: fake('remoto', complete, false),
      ollama: answers('ollama', 'alterno'),
    });
    expect((await s.run(task)).provider).toBe('ollama');
    expect(complete).not.toHaveBeenCalled();
  });

  it('funciona sin alterno y falla si el principal falla (CA-08.3)', async () => {
    const { selector: s } = selector(
      { remoto: fails('remoto'), ollama: answers('ollama', 'x') },
      { ...config, fallback: null },
    );
    await expect(s.run(task)).rejects.toBeInstanceOf(AssistantUnavailableError);
  });

  it('puede cambiarse el proveedor principal sin tocar nada más (CA-08.1)', async () => {
    const { selector: s } = selector(
      { remoto: answers('remoto', 'remoto'), ollama: answers('ollama', 'local') },
      { ...config, primary: 'ollama', fallback: 'remoto' },
    );
    expect((await s.run(task)).value).toBe('local');
  });
});
