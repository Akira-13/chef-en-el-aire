import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speak, speechAt } from './speech';

/** Síntesis falsa: la prueba decide cuándo empieza y termina cada lectura. */
class FakeUtterance {
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  lang = '';
  voice: unknown = null;
  volume = 1;
  constructor(public text: string) {}
}

describe('qué sonaba por el altavoz (eco)', () => {
  let current: FakeUtterance | undefined;
  // Las lecturas se guardan en el módulo: cada prueba ocurre una hora después de la anterior.
  let hour = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(++hour * 3_600_000);
    current = undefined;
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('speechSynthesis', {
      speaking: false,
      cancel: () => {},
      getVoices: () => [],
      speak: (u: FakeUtterance) => {
        current = u;
        u.onstart?.();
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('lo que empieza a oírse mientras la app habla se compara con lo que decía', () => {
    speak('Di «chef, siguiente».', { volume: 1, interrupt: false });
    const during = Date.now() + 500;
    expect(speechAt(during)).toEqual(['Di «chef, siguiente».']);
  });

  it('lo que el usuario dice después de que la app calló no se compara con nada', () => {
    speak('Di «chef, siguiente».', { volume: 1, interrupt: false });
    vi.advanceTimersByTime(1500);
    current!.onend?.();
    vi.advanceTimersByTime(1000);
    expect(speechAt(Date.now())).toEqual([]);
  });

  it('si el navegador no avisa del final, la lectura deja de contar según su largo', () => {
    speak('Hola.', { volume: 1, interrupt: false });
    expect(speechAt(Date.now() + 10_000)).toEqual([]);
  });
});
