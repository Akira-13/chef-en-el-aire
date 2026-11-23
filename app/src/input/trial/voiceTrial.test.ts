import { describe, expect, it } from 'vitest';
import type { Command } from '@chef/shared';
import {
  createVoiceTrial,
  ESSENTIAL_COMMANDS,
  formatSummary,
  generateRequests,
  RESPONSE_TIMEOUT_MS,
  sanitizeParticipant,
  summarizeTrial,
  type TrialRequestResult,
} from './voiceTrial';

const voice = (command: Command) => ({ command, channel: 'voice' as const });

/** Responde bien a todos los pedidos con el comando esperado. */
function answerAll(trial: ReturnType<typeof createVoiceTrial>, wrongAt: number[] = []): void {
  let now = 0;
  while (!trial.finished()) {
    trial.begin(now);
    const expected = trial.current();
    const wrong = wrongAt.includes(trial.position());
    const command: Command =
      expected?.id === 'substitute' && !wrong
        ? { type: 'substitute', ingredient: 'leche' }
        : wrong
          ? { type: 'cancel' }
          : ({ type: expected?.id } as Command);
    trial.receive(voice(command), now + 400);
    now += 1000;
  }
}

describe('lista de pedidos (CA-13.5)', () => {
  it('trae 20 pedidos con los 8 comandos esenciales y todos aparecen', () => {
    const requests = generateRequests(7);
    expect(requests).toHaveLength(20);
    const ids = new Set(requests.map((r) => r.id));
    expect(ids.size).toBe(ESSENTIAL_COMMANDS.length);
    for (const command of ESSENTIAL_COMMANDS) {
      expect(requests.filter((r) => r.id === command.id).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('la misma semilla da el mismo orden y otra semilla, otro', () => {
    const ids = (seed: number) => generateRequests(seed).map((r) => r.id);
    expect(ids(42)).toEqual(ids(42));
    expect(ids(42)).not.toEqual(ids(43));
  });

  it('reconoce "sustituye leche" solo con la leche', () => {
    const substitute = ESSENTIAL_COMMANDS.find((c) => c.id === 'substitute');
    expect(substitute?.matches({ type: 'substitute', ingredient: 'la Leche' })).toBe(true);
    expect(substitute?.matches({ type: 'substitute', ingredient: 'huevo' })).toBe(false);
  });
});

describe('registro de cada pedido (RNF-04)', () => {
  it('anota lo esperado, lo reconocido, el acierto, el ruido y la latencia', () => {
    const trial = createVoiceTrial(1);
    trial.setNoise('loud');
    trial.begin(1000);
    const expected = trial.current();
    const result = trial.receive(voice({ type: 'cancel' }), 1600);
    expect(result).toMatchObject({
      number: 1,
      expected: expected?.id,
      recognized: 'cancel',
      hit: false,
      noise: 'loud',
      latencyMs: 600,
    });
    expect(trial.position()).toBe(2);
  });

  it('ignora lo que no llegó por voz', () => {
    const trial = createVoiceTrial(1);
    trial.begin(0);
    expect(trial.receive({ command: { type: 'next' }, channel: 'touch' }, 100)).toBeNull();
    expect(trial.results()).toHaveLength(0);
  });

  it('sin respuesta en 5 s cuenta como no reconocido', () => {
    const trial = createVoiceTrial(1);
    trial.begin(0);
    expect(trial.tick(RESPONSE_TIMEOUT_MS - 1)).toBeNull();
    expect(trial.tick(RESPONSE_TIMEOUT_MS)).toMatchObject({
      recognized: null,
      hit: false,
      latencyMs: null,
    });
  });

  it('repetir el pedido reinicia el tiempo y se anota', () => {
    const trial = createVoiceTrial(1);
    trial.begin(0);
    trial.repeatRequest(4000);
    expect(trial.tick(RESPONSE_TIMEOUT_MS)).toBeNull();
    const expected = { type: trial.current()?.id } as Command;
    const result = trial.receive(
      voice(
        expected.type === 'substitute' ? { type: 'substitute', ingredient: 'leche' } : expected,
      ),
      4500,
    );
    expect(result).toMatchObject({ repeats: 1, latencyMs: 500, hit: true });
  });

  it('saltar un pedido no cuenta a favor ni en contra', () => {
    const trial = createVoiceTrial(1);
    trial.begin(0);
    expect(trial.skip()).toMatchObject({ skipped: true, hit: false });
    expect(trial.summary()).toMatchObject({ overall: { total: 0 }, skipped: 1 });
  });

  it('no recibe nada antes de empezar el pedido ni después de terminar', () => {
    const trial = createVoiceTrial(1, 8);
    expect(trial.receive(voice({ type: 'next' }), 0)).toBeNull();
    answerAll(trial);
    expect(trial.finished()).toBe(true);
    expect(trial.current()).toBeNull();
    expect(trial.skip()).toBeNull();
  });
});

describe('resultado por nivel de ruido (CA-13.5)', () => {
  it('18 de 20 en silencio cumple ≥ 90 %', () => {
    const trial = createVoiceTrial(3);
    answerAll(trial, [4, 11]);
    const summary = trial.summary();
    expect(summary.byNoise.quiet).toMatchObject({ total: 20, hits: 18, meets: true });
    expect(formatSummary(summary)).toEqual(['Aciertos: 18/20 (90 %) · cumple ≥ 90 %']);
  });

  it('17 de 20 en silencio no cumple ≥ 90 %', () => {
    const trial = createVoiceTrial(3);
    answerAll(trial, [1, 2, 3]);
    expect(formatSummary(trial.summary())).toEqual(['Aciertos: 17/20 (85 %) · no cumple ≥ 90 %']);
  });

  it('con ruido de 70 a 80 dB el umbral es ≥ 80 %', () => {
    const trial = createVoiceTrial(3);
    trial.setNoise('loud');
    answerAll(trial, [1, 2, 3, 4]);
    expect(trial.summary().byNoise.loud).toMatchObject({ hits: 16, meets: true, threshold: 0.8 });
  });

  it('calcula los aciertos por separado cuando el facilitador cambia el ruido', () => {
    const trial = createVoiceTrial(5);
    for (let i = 0; i < 10; i++) {
      trial.begin(i);
      trial.receive(voice({ type: 'cancel' }), i + 1);
    }
    trial.setNoise('loud');
    answerAll(trial);
    const { byNoise } = trial.summary();
    expect(byNoise.quiet).toMatchObject({ total: 10, hits: 0, meets: false });
    expect(byNoise.loud).toMatchObject({ total: 10, hits: 10, meets: true });
    expect(formatSummary(trial.summary())).toHaveLength(2);
  });

  it('sin pedidos contestados no inventa un porcentaje', () => {
    expect(summarizeTrial([]).overall).toEqual({ total: 0, hits: 0, rate: 0 });
    expect(formatSummary(summarizeTrial([]))).toEqual(['Aún no hay pedidos contestados.']);
  });
});

describe('exportación (RNF-11)', () => {
  it('exporta el JSON sin audio ni frases, solo comandos y resultados', () => {
    const trial = createVoiceTrial(9, 8);
    answerAll(trial);
    const exported = trial.export('P03', new Date('2026-11-26T15:00:00Z'));
    expect(exported).toMatchObject({
      kind: 'voice-trial',
      participant: 'P03',
      seed: 9,
      date: '2026-11-26T15:00:00.000Z',
    });
    expect(exported.requests).toHaveLength(8);
    const keys = new Set(exported.requests.flatMap((r: TrialRequestResult) => Object.keys(r)));
    expect(keys).not.toContain('transcript');
    expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
  });

  it('solo acepta códigos anónimos como P01, nunca un nombre', () => {
    expect(sanitizeParticipant(' p07 ')).toBe('P07');
    expect(sanitizeParticipant('María')).toBeUndefined();
    expect(sanitizeParticipant('')).toBeUndefined();
    expect(createVoiceTrial(1).export(undefined, new Date(0))).not.toHaveProperty('participant');
  });
});
