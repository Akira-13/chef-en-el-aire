import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveMicrophone } from './permission';

function mockBrowser({
  state,
  allow = true,
}: {
  state: PermissionState | 'unsupported';
  allow?: boolean;
}) {
  const getUserMedia = vi.fn(async () => {
    if (!allow) throw new DOMException('denied', 'NotAllowedError');
    return { getTracks: () => [{ stop: vi.fn() }] };
  });
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia },
    permissions:
      state === 'unsupported'
        ? { query: vi.fn(async () => Promise.reject(new TypeError('no microphone'))) }
        : { query: vi.fn(async () => ({ state })) },
  });
  return getUserMedia;
}

describe('permiso del micrófono desde el inicio (RNF-11)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('si ya estaba concedido, activa la voz sin preguntar', async () => {
    const getUserMedia = mockBrowser({ state: 'granted' });
    expect(await resolveMicrophone(true)).toEqual({ granted: true, asked: false });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('si falta decidir, lo pide al llegar a una pantalla con voz', async () => {
    const getUserMedia = mockBrowser({ state: 'prompt' });
    expect(await resolveMicrophone(true)).toEqual({ granted: true, asked: true });
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('informa si el usuario lo rechaza al preguntarle', async () => {
    mockBrowser({ state: 'prompt', allow: false });
    expect(await resolveMicrophone(true)).toEqual({ granted: false, asked: true });
  });

  it('no vuelve a preguntar si ya estaba bloqueado', async () => {
    const getUserMedia = mockBrowser({ state: 'denied' });
    expect(await resolveMicrophone(true)).toEqual({ granted: false, asked: false });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('fuera de las pantallas con voz no pregunta', async () => {
    const getUserMedia = mockBrowser({ state: 'prompt' });
    expect(await resolveMicrophone(false)).toEqual({ granted: false, asked: false });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('dos pedidos a la vez muestran una sola pregunta (StrictMode)', async () => {
    const getUserMedia = mockBrowser({ state: 'prompt' });
    const results = await Promise.all([resolveMicrophone(true), resolveMicrophone(true)]);
    expect(results.every((r) => r.granted)).toBe(true);
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('si el navegador no informa el estado, pregunta igual', async () => {
    const getUserMedia = mockBrowser({ state: 'unsupported' });
    expect(await resolveMicrophone(true)).toEqual({ granted: true, asked: true });
    expect(getUserMedia).toHaveBeenCalledOnce();
  });
});
