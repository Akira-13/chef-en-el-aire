// Reconocimiento de voz continuo (RF-18). Se reinicia solo porque Android lo corta en silencio.

import type { Command } from '@chef/shared';
import { normalizeSpeech } from './normalize';
import { createWakeGate, misheardWake, startsWithWakeWord, WAKE_WORD } from './wakeWord';
import { parseCommand } from './parseCommand';

// Tipos mínimos de la Web Speech API, que TypeScript no incluye.
interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}

interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: RecognitionResult };
}

interface RecognitionErrorEvent {
  readonly error: string;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isVoiceSupported(): boolean {
  return recognitionConstructor() !== undefined;
}

export type VoiceErrorKind = 'unsupported' | 'not-allowed' | 'network' | 'other';

export interface VoiceExtra {
  /** Undefined si el navegador no la reporta. */
  confidence?: number;
  transcript: string;
}

export interface VoiceHandlers {
  /** `text` es lo dicho sin la palabra de activación. */
  onCommand(command: Command, extra: VoiceExtra, text: string): void;
  onError(kind: VoiceErrorKind, detail: string): void;
  /** Se escuchó "chef" solo y se espera el comando. */
  onWake?(): void;
  /** Recibe cada frase antes de la palabra de activación; true si la consumió. */
  onPhrase?(transcript: string): boolean;
}

export interface VoiceOptions {
  /** Silencio tras el que se da la frase por terminada (CA-21.2). */
  silenceMs?: number;
  /** True si la frase, que empezó a oírse en `heardAt`, es la voz de la app en el altavoz. */
  isEcho?: (transcript: string, heardAt: number) => boolean;
}

const LANGS = ['es-PE', 'es-419'];
const RESTART_DELAY_MS = 100;
export const DEFAULT_SILENCE_MS = 1200;
/** Android a veces entrega dos veces la misma frase: la repetición inmediata se ignora. */
const DUPLICATE_WINDOW_MS = 2000;
/**
 * Android corta la frase en las pausas: "chef, qué… puedo cocinar" llega como dos finales. Lo
 * que no es un comando conocido espera este tiempo por si la frase continúa.
 */
export const QUESTION_JOIN_MS = 1500;

// Rastro en la consola (nivel Verbose de DevTools) de qué se oyó y qué se hizo con cada frase:
// sin él no hay forma de saber si falló el reconocimiento o la interpretación.
function trace(...args: unknown[]): void {
  console.debug('[voz]', ...args);
}

interface PendingQuestion {
  text: string;
  transcript: string;
  confidence?: number;
}

/** Empieza a escuchar; devuelve la función que detiene el reconocimiento. */
export function startVoice(
  handlers: VoiceHandlers,
  { silenceMs = DEFAULT_SILENCE_MS, isEcho = () => false }: VoiceOptions = {},
): () => void {
  const Ctor = recognitionConstructor();
  if (!Ctor) {
    handlers.onError('unsupported', 'Este navegador no reconoce voz');
    return () => {};
  }

  const gate = createWakeGate();
  const recognition = new Ctor();
  let langIndex = 0;
  let stopped = false;
  let fatal = false;
  let restartTimer: number | undefined;
  let silenceTimer: number | undefined;
  // Resultados de la sesión ya atendidos: Android repite finales y el final de una frase que ya
  // se tomó por silencio puede llegar igual. Los índices empiezan de cero en cada sesión.
  let handled = new Set<number>();
  // Primer parcial de cada resultado, para el rastro: muestra si "chef" se oyó al principio y el
  // reconocimiento lo quitó del texto final.
  let firstInterim = new Map<number, { text: string; at: number }>();
  let lastCommand = { text: '', at: -Infinity };
  let question: PendingQuestion | null = null;
  let questionTimer: number | undefined;

  recognition.lang = LANGS[langIndex]!;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  /**
   * Atiende una frase; true si la consumió (comando o respuesta a una confirmación). `final` es
   * false cuando la frase se toma por silencio, antes de que llegue el resultado definitivo.
   */
  function handle(
    transcript: string,
    final: boolean,
    confidence?: number,
    heardAt = Date.now(),
  ): boolean {
    trace(final ? 'final' : 'parcial (silencio)', JSON.stringify(transcript), { confidence });
    if (isEcho(transcript, heardAt)) {
      trace('  ignorada: es la voz de la app');
      return false;
    }
    if (question) {
      // Lo que llega sin "chef" mientras se espera es el resto de la pregunta.
      if (final && !startsWithWakeWord(transcript)) {
        question.text += ` ${transcript.trim()}`;
        question.transcript += ` ${transcript.trim()}`;
        trace('  unida a la frase anterior:', JSON.stringify(question.text));
        waitForRest();
        return true;
      }
      if (!final) return false;
      flushQuestion();
    }
    if (handlers.onPhrase?.(transcript)) return true;
    const rest = misheardWake(transcript, (text) => parseCommand(text)?.type !== 'ask');
    if (rest !== null) {
      trace('  "chef" mal oído al inicio; se toma como', JSON.stringify(`${WAKE_WORD} ${rest}`));
    }
    const commandText = gate.feed(rest === null ? transcript : `${WAKE_WORD} ${rest}`);
    if (commandText === null) {
      trace(gate.isArmed() ? '  solo "chef": esperando la orden' : '  ignorada: sin "chef"');
      if (gate.isArmed()) handlers.onWake?.();
      return false;
    }
    const command = parseCommand(commandText);
    // Sin "chef" solo valen los comandos conocidos: una charla de fondo no debe ir al asistente.
    if (!command) return false;
    if (command.type === 'ask') {
      // Una pregunta a medias tomada por silencio no se responde: se espera el resultado final.
      if (gate.isFollowUp() || !final) {
        trace('  ignorada: no es un comando y', final ? 'llegó sin "chef"' : 'la frase no terminó');
        return false;
      }
      question = { text: commandText, transcript: transcript.trim(), confidence };
      trace('  no es un comando conocido: esperando el resto de la frase');
      waitForRest();
      return true;
    }
    return dispatch(command, commandText, transcript.trim(), confidence);
  }

  function waitForRest(): void {
    window.clearTimeout(questionTimer);
    questionTimer = window.setTimeout(flushQuestion, QUESTION_JOIN_MS);
  }

  /** Interpreta la pregunta completa: unida puede resultar un comando ("busca" + "pollo"). */
  function flushQuestion(): void {
    window.clearTimeout(questionTimer);
    const pending = question;
    question = null;
    if (!pending) return;
    const command = parseCommand(pending.text);
    if (command) dispatch(command, pending.text, pending.transcript, pending.confidence);
  }

  function dispatch(
    command: Command,
    commandText: string,
    transcript: string,
    confidence?: number,
  ): boolean {
    const text = normalizeSpeech(commandText);
    const now = Date.now();
    if (text === lastCommand.text && now - lastCommand.at < DUPLICATE_WINDOW_MS) {
      trace('  ignorada: repetida', JSON.stringify(commandText));
      return true;
    }
    lastCommand = { text, at: now };
    trace('  →', command, 'de', JSON.stringify(commandText));
    handlers.onCommand(command, { confidence, transcript }, commandText);
    return true;
  }

  recognition.onresult = (event) => {
    window.clearTimeout(silenceTimer);
    // Mientras el usuario siga hablando, la pregunta pendiente sigue esperando el resto.
    if (question) waitForRest();
    let interim = '';
    const interimIndexes: number[] = [];
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (handled.has(i)) continue;
      const result = event.results[i]!;
      const { transcript, confidence } = result[0]!;
      if (result.isFinal) {
        handled.add(i);
        const first = firstInterim.get(i);
        if (first) trace('parcial inicial', JSON.stringify(first.text));
        // Chrome reporta 0 cuando no conoce la confianza.
        handle(transcript, true, confidence > 0 ? confidence : undefined, first?.at);
      } else {
        interim += transcript;
        interimIndexes.push(i);
        if (!firstInterim.has(i)) firstInterim.set(i, { text: transcript, at: Date.now() });
      }
    }
    if (!interim.trim()) return;
    // Tras el silencio la frase se da por terminada. Si solo se oyó "chef" o algo que no es un
    // comando, la sesión sigue: cortarla perdería el resto de la frase, que suele venir en camino.
    const heardAt = Math.min(...interimIndexes.map((i) => firstInterim.get(i)?.at ?? Date.now()));
    silenceTimer = window.setTimeout(() => {
      if (!handle(interim, false, undefined, heardAt)) return;
      for (const i of interimIndexes) handled.add(i);
      recognition.abort();
    }, silenceMs);
  };

  recognition.onerror = ({ error }) => {
    trace('error del reconocimiento:', error);
    if (error === 'no-speech' || error === 'aborted') return;
    if (error === 'language-not-supported' && langIndex < LANGS.length - 1) {
      recognition.lang = LANGS[++langIndex]!;
      return;
    }
    if (error === 'not-allowed' || error === 'service-not-allowed') {
      fatal = true;
      handlers.onError('not-allowed', error);
    } else if (error === 'network') {
      fatal = true;
      handlers.onError('network', error);
    } else {
      handlers.onError('other', error);
    }
  };

  function restart(): void {
    if (stopped) return;
    try {
      recognition.start();
    } catch {
      // Ya estaba iniciado: no hace falta hacer nada.
    }
  }

  // El navegador cierra la sesión tras un silencio largo (Android, tras cada frase). Mientras está
  // cerrada no se oye nada y lo primero que se perdería es "chef": se reabre en el acto.
  recognition.onend = () => {
    handled = new Set();
    firstInterim = new Map();
    if (stopped || fatal) return;
    trace('sesión terminada; se reabre el micrófono');
    try {
      recognition.start();
    } catch {
      // Algunos navegadores no dejan reabrir dentro del mismo evento: se reintenta enseguida.
      restartTimer = window.setTimeout(restart, RESTART_DELAY_MS);
    }
  };

  recognition.start();
  trace('micrófono abierto', recognition.lang);

  return () => {
    trace('micrófono cerrado');
    stopped = true;
    window.clearTimeout(restartTimer);
    window.clearTimeout(silenceTimer);
    window.clearTimeout(questionTimer);
    recognition.onend = null;
    recognition.abort();
  };
}

/** Pide permiso del micrófono de forma explícita (RNF-11). */
export async function requestMicrophone(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return isVoiceSupported();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return true;
  } catch {
    return false;
  }
}
