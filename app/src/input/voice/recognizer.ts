// Reconocimiento de voz continuo (RF-18). Se reinicia solo porque Android lo corta en silencio.

import type { Command } from '@chef/shared';
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

export interface VoiceHandlers {
  onCommand(command: Command, extra: { confidence: number; transcript: string }): void;
  onError(kind: VoiceErrorKind, detail: string): void;
  /** Se escuchó "chef" solo y se espera el comando. */
  onWake?(): void;
}

const LANGS = ['es-PE', 'es-419'];
const RESTART_DELAY_MS = 250;

/** Empieza a escuchar; devuelve la función que detiene el reconocimiento. */
export function startVoice(handlers: VoiceHandlers): () => void {
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

  recognition.lang = LANGS[langIndex]!;
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]!;
      if (!result.isFinal) continue;
      const { transcript, confidence } = result[0]!;
      const commandText = gate.feed(transcript);
      if (commandText === null) {
        if (gate.isArmed()) handlers.onWake?.();
        continue;
      }
      const command = parseCommand(commandText);
      if (command) handlers.onCommand(command, { confidence, transcript: transcript.trim() });
    }
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
