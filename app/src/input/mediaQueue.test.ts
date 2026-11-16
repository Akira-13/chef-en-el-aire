import { describe, expect, it } from 'vitest';
import { enqueueMediaRequest } from './mediaQueue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('solicitudes de cámara y micrófono en fila', () => {
  it('no pide la siguiente hasta que el usuario responde la anterior', async () => {
    const mic = deferred<string>();
    const started: string[] = [];
    const first = enqueueMediaRequest(() => {
      started.push('mic');
      return mic.promise;
    });
    const second = enqueueMediaRequest(async () => {
      started.push('camera');
      return 'camera';
    });

    await Promise.resolve();
    expect(started).toEqual(['mic']);

    mic.resolve('mic');
    expect(await first).toBe('mic');
    expect(await second).toBe('camera');
    expect(started).toEqual(['mic', 'camera']);
  });

  it('un rechazo no bloquea la solicitud siguiente', async () => {
    const mic = deferred<string>();
    const first = enqueueMediaRequest(() => mic.promise);
    const second = enqueueMediaRequest(async () => 'camera');

    mic.reject(new DOMException('denied', 'NotAllowedError'));
    await expect(first).rejects.toThrow('denied');
    expect(await second).toBe('camera');
  });
});
