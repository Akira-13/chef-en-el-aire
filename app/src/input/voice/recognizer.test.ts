import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command } from '@chef/shared';
import { isEcho } from './echo';
import { QUESTION_JOIN_MS, startVoice } from './recognizer';

interface FakeResult {
  transcript: string;
  isFinal: boolean;
}

/** Reconocimiento falso: las pruebas entregan resultados como lo hace Chrome en Android. */
class FakeRecognition {
  static last: FakeRecognition;
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  aborted = 0;
  private results: FakeResult[] = [];

  constructor() {
    FakeRecognition.last = this;
  }

  start(): void {}
  stop(): void {}

  abort(): void {
    this.aborted++;
    this.results = [];
    this.onend?.();
  }

  /** Fija el resultado `index` de la sesión y avisa desde `resultIndex`. */
  emit(index: number, transcript: string, isFinal: boolean, resultIndex = index): void {
    this.results[index] = { transcript, isFinal };
    const results = this.results.map((r) =>
      Object.assign([{ transcript: r.transcript, confidence: 0.9 }], { isFinal: r.isFinal }),
    );
    this.onresult?.({ resultIndex, results });
  }
}

describe('reconocimiento de voz continuo', () => {
  let commands: Command[];
  let woke: number;
  let spoken: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    commands = [];
    woke = 0;
    spoken = [];
    startVoice(
      {
        onCommand: (command) => commands.push(command),
        onError: () => {},
        onWake: () => woke++,
      },
      { isEcho: (transcript) => isEcho(transcript, spoken) },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('si el parcial se queda en "chef", no corta la sesión y espera el resto', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, 'chef', false);
    vi.advanceTimersByTime(1500);
    expect(woke).toBe(1);
    expect(rec.aborted).toBe(0);
    rec.emit(0, 'chef tengo arroz y cebolla', true);
    expect(commands).toEqual([{ type: 'addPantry', items: ['arroz', 'cebolla'] }]);
  });

  it('un final repetido por Android se ejecuta una sola vez', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, 'chef siguiente', true);
    rec.emit(0, 'chef siguiente', true, 0);
    rec.emit(1, 'chef siguiente', true);
    expect(commands).toEqual([{ type: 'next' }]);
  });

  it('el final de una frase ya tomada por silencio no se vuelve a ejecutar', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, 'chef siguiente', false);
    vi.advanceTimersByTime(1500);
    expect(rec.aborted).toBe(1);
    rec.emit(0, 'chef siguiente', true);
    expect(commands).toEqual([{ type: 'next' }]);
  });

  it('una pregunta a medias tomada por silencio no se responde; la frase completa sí', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, 'chef busca', false);
    vi.advanceTimersByTime(1500);
    expect(commands).toEqual([]);
    expect(rec.aborted).toBe(0);
    rec.emit(0, 'chef busca pollo', true);
    expect(commands).toEqual([{ type: 'search', query: 'pollo' }]);
  });

  it('no toma como orden la voz de la app que oye el micrófono', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, 'chef tengo arroz', true);
    spoken.push('Agregué arroz a tu despensa.');
    // Dentro de la ventana de seguimiento, sin "chef", la voz del altavoz llega al micrófono.
    rec.emit(1, 'agregue arroz a tu despensa', true);
    spoken.push('Prueba con «chef, busca pollo».');
    rec.emit(2, 'chef busca pollo', true);
    expect(commands).toEqual([{ type: 'addPantry', items: ['arroz'] }]);
  });

  it('une una pregunta que Android cortó en una pausa', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, 'chef que', true);
    rec.emit(1, 'puedo cocinar con lo que tengo', true);
    expect(commands).toEqual([]);
    vi.advanceTimersByTime(QUESTION_JOIN_MS);
    expect(commands).toEqual([{ type: 'ask', question: 'que puedo cocinar con lo que tengo' }]);
  });

  it('una orden partida en una pausa también se une ("busca" + "pollo")', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, 'chef busca', true);
    rec.emit(1, 'pollo', true);
    vi.advanceTimersByTime(QUESTION_JOIN_MS);
    expect(commands).toEqual([{ type: 'search', query: 'pollo' }]);
  });

  it('una pregunta completa se envía al terminar la espera', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, 'chef que puedo cocinar', true);
    vi.advanceTimersByTime(QUESTION_JOIN_MS - 1);
    expect(commands).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(commands).toEqual([{ type: 'ask', question: 'que puedo cocinar' }]);
  });

  it('un comando con "chef" mientras se espera envía la pregunta y luego el comando', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, 'chef como se pica la cebolla', true);
    rec.emit(1, 'chef siguiente', true);
    expect(commands).toEqual([
      { type: 'ask', question: 'como se pica la cebolla' },
      { type: 'next' },
    ]);
  });

  it('acepta "chef" mal transcrito como en los registros del celular', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, ' Jeff busca pollo', true);
    vi.advanceTimersByTime(3000);
    rec.emit(1, ' se busca apoyo', true);
    vi.advanceTimersByTime(3000);
    rec.emit(2, ' qué ayuda', true);
    expect(commands).toEqual([
      { type: 'search', query: 'pollo' },
      { type: 'search', query: 'apoyo' },
      { type: 'help' },
    ]);
  });

  it('una charla que empieza con "se" o "que" no se toma como orden', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, ' sugerencia de que ustedes cocinar por ejemplo', true);
    rec.emit(1, ' se me olvidó la sal', true);
    rec.emit(2, ' que rico huele', true);
    vi.advanceTimersByTime(3000);
    expect(commands).toEqual([]);
  });

  it('la misma orden dicha de nuevo pasado un momento sí se ejecuta', () => {
    const rec = FakeRecognition.last;
    rec.emit(0, 'chef siguiente', true);
    vi.advanceTimersByTime(3000);
    rec.emit(1, 'siguiente', true);
    expect(commands).toEqual([{ type: 'next' }, { type: 'next' }]);
  });
});
