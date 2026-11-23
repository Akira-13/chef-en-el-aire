// Lectura más lenta con una emoción reciente (CA-33.2, RF-42), con el reloj simulado.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toProfile, type DeclaredFeeling, type Profile, type RawProfileBook } from '@chef/shared';
import rawProfiles from '../../../datos/perfiles.json';
import { createOutputService } from './index';
import { NORMAL_RATE, SLOW_RATE, speechRate } from './speech';

const NOW = Date.parse('2026-11-26T15:00:00.000Z');
const MINUTE = 60_000;

const feeling = (
  kind: DeclaredFeeling['feeling'],
  minutesAgo: number,
  source: DeclaredFeeling['source'] = 'declared',
): DeclaredFeeling => ({
  feeling: kind,
  date: '2026-11-26',
  source,
  at: new Date(NOW - minutesAgo * MINUTE).toISOString(),
});

describe('velocidad de lectura según la emoción (CA-33.2)', () => {
  it.each(['nervous', 'confused', 'tired'] as const)(
    'con «%s» de hace 29 minutos lee más despacio',
    (kind) => {
      expect(speechRate(feeling(kind, 29), NOW)).toBe(SLOW_RATE);
    },
  );

  it('la velocidad lenta es menor que la normal', () => {
    expect(SLOW_RATE).toBe(0.85);
    expect(NORMAL_RATE).toBe(1);
  });

  it('con la emoción de hace 30 minutos o más vuelve a la velocidad normal', () => {
    expect(speechRate(feeling('nervous', 30), NOW)).toBe(NORMAL_RATE);
    expect(speechRate(feeling('tired', 31), NOW)).toBe(NORMAL_RATE);
  });

  it('con alegría o sin emoción la velocidad es la normal', () => {
    expect(speechRate(feeling('happy', 1), NOW)).toBe(NORMAL_RATE);
    expect(speechRate(undefined, NOW)).toBe(NORMAL_RATE);
  });

  it('una emoción inferida del uso también cuenta', () => {
    expect(speechRate(feeling('confused', 5, 'inferred'), NOW)).toBe(SLOW_RATE);
  });

  it('sin la hora en que ocurrió o con una hora inválida no se sabe si es reciente', () => {
    const { at: _at, ...withoutTime } = feeling('nervous', 1);
    expect(speechRate(withoutTime, NOW)).toBe(NORMAL_RATE);
    expect(speechRate({ ...withoutTime, at: 'ayer' }, NOW)).toBe(NORMAL_RATE);
    expect(speechRate(feeling('nervous', -5), NOW)).toBe(NORMAL_RATE);
  });

  it('con el reloj del sistema usa la hora actual por omisión', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      expect(speechRate(feeling('tired', 10))).toBe(SLOW_RATE);
      vi.setSystemTime(NOW + 25 * MINUTE);
      expect(speechRate(feeling('tired', 10))).toBe(NORMAL_RATE);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('el servicio de salida lee con esa velocidad (CA-33.2)', () => {
  const base = (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile)[0] as Profile;
  let rates: number[];
  let lastFeeling: DeclaredFeeling | undefined;

  // El perfil se arma en cada lectura, como el servicio real, para ver la emoción vigente.
  function service() {
    return createOutputService({
      getProfile: (): Profile => ({
        ...base,
        accessibility: { ...base.accessibility, ttsEnabled: true, outputs: ['visual', 'audio'] },
        emotional: { ...base.emotional, lastFeeling },
      }),
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    rates = [];
    class FakeUtterance {
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      lang = '';
      voice: unknown = null;
      volume = 1;
      rate = 1;
      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('speechSynthesis', {
      speaking: false,
      cancel: () => {},
      getVoices: () => [],
      addEventListener: () => {},
      speak: (u: FakeUtterance) => rates.push(u.rate),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('nervioso hace menos de 30 minutos: 0,85; después de 30 minutos o feliz: 1', () => {
    const output = service();

    lastFeeling = feeling('nervous', 5);
    output.announce({ text: 'Paso 1. Lava el arroz.', kind: 'step' });

    lastFeeling = feeling('nervous', 45);
    output.announce({ text: 'Paso 2. Cocina.', kind: 'step' });

    lastFeeling = feeling('happy', 1);
    output.announce({ text: 'Paso 3. Sirve.', kind: 'step' });

    expect(rates).toEqual([0.85, 1, 1]);
  });
});
