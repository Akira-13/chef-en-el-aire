// Reconocimiento de voz continuo (RF-18). Se reinicia solo porque Android lo corta en silencio.

import type { Command } from '@chef/shared';
import { enqueueMediaRequest } from '../mediaQueue';
import { createWakeGate } from './wakeWord';
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
}

const LANGS = ['es-PE', 'es-419'];
const RESTART_DELAY_MS = 250;
export const DEFAULT_SILENCE_MS = 1200;

/** Empieza a escuchar; devuelve la función que detiene el reconocimiento. */
export function startVoice(
  handlers: VoiceHandlers,
  { silenceMs = DEFAULT_SILENCE_MS }: VoiceOptions = {},
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

  recognition.lang = LANGS[langIndex]!;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  function handle(transcript: string, confidence?: number): void {
    if (handlers.onPhrase?.(transcript)) return;
    const commandText = gate.feed(transcript);
    if (commandText === null) {
      if (gate.isArmed()) handlers.onWake?.();
      return;
    }
    const command = parseCommand(commandText);
    // Sin "chef" solo valen los comandos conocidos: una charla de fondo no debe ir al asistente.
    if (command?.type === 'ask' && gate.isFollowUp()) return;
    if (command)
      handlers.onCommand(command, { confidence, transcript: transcript.trim() }, commandText);
  }

  recognition.onresult = (event) => {
    window.clearTimeout(silenceTimer);
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]!;
      const { transcript, confidence } = result[0]!;
      // Chrome reporta 0 cuando no conoce la confianza.
      if (result.isFinal) handle(transcript, confidence > 0 ? confidence : undefined);
      else interim += transcript;
    }
    if (!interim.trim()) return;
    // Tras el silencio la frase se da por terminada; `onend` vuelve a empezar.
    silenceTimer = window.setTimeout(() => {
      handle(interim);
      recognition.abort();
    }, silenceMs);
  };

  recognition.onerror = ({ error }) => {
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

  recognition.onend = () => {
    if (stopped || fatal) return;
    restartTimer = window.setTimeout(() => {
      if (stopped) return;
      try {
        recognition.start();
      } catch {
        // Ya estaba iniciado: no hace falta hacer nada.
      }
    }, RESTART_DELAY_MS);
  };

  recognition.start();

  return () => {
    stopped = true;
    window.clearTimeout(restartTimer);
    window.clearTimeout(silenceTimer);
    recognition.onend = null;
    recognition.abort();
  };
}

let pendingMicrophone: Promise<boolean> | undefined;

/** Pide permiso del micrófono de forma explícita (RNF-11). Los pedidos simultáneos comparten una pregunta. */
export function requestMicrophone(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return Promise.resolve(isVoiceSupported());
  pendingMicrophone ??= enqueueMediaRequest(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      return true;
    } catch {
      return false;
    }
  }).finally(() => {
    pendingMicrophone = undefined;
  });
  return pendingMicrophone;
}
