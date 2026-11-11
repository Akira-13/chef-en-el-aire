// Lectura en voz alta con speechSynthesis (RF-15).

import type { AccessibilityPrefs, Verbosity } from '@chef/shared';
import type { Announcement } from '../core/contracts';

type VoiceLike = Pick<SpeechSynthesisVoice, 'lang'>;

const PREFERRED_LANGS = ['es-pe', 'es-us', 'es-419'];

function normalizeLang(lang: string): string {
  return lang.replace('_', '-').toLowerCase();
}

/** Voz en español: es-PE, luego es-US, es-419 y cualquier es-*. */
export function pickSpanishVoice<V extends VoiceLike>(voices: readonly V[]): V | undefined {
  for (const lang of PREFERRED_LANGS) {
    const match = voices.find((voice) => normalizeLang(voice.lang) === lang);
    if (match) return match;
  }
  return voices.find((voice) => normalizeLang(voice.lang).startsWith('es'));
}

type OutputPrefs = Pick<AccessibilityPrefs, 'ttsEnabled' | 'outputs' | 'subtitles'>;

export function wantsAudio(prefs: OutputPrefs): boolean {
  return prefs.ttsEnabled && prefs.outputs.includes('audio');
}

/** Subtítulos si el perfil los pide o si no tiene salida de audio (CA-20.2). */
export function wantsSubtitles(prefs: OutputPrefs): boolean {
  return prefs.subtitles === true || !prefs.outputs.includes('audio');
}

/** Texto según la verbosidad del perfil (CA-13.3). */
export function textFor(announcement: Announcement, verbosity: Verbosity): string {
  return verbosity === 'breve' ? (announcement.short ?? announcement.text) : announcement.text;
}

// ---------- Parte con efectos ----------

let cachedVoice: SpeechSynthesisVoice | undefined;

function synth(): SpeechSynthesis | undefined {
  return typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis;
}

function spanishVoice(): SpeechSynthesisVoice | undefined {
  if (!cachedVoice) cachedVoice = pickSpanishVoice(synth()?.getVoices() ?? []);
  return cachedVoice;
}

// Chrome carga las voces de forma asíncrona.
synth()?.addEventListener?.('voiceschanged', () => {
  cachedVoice = undefined;
});

// Lo que la app leyó y cuándo sonó. El micrófono sigue abierto y transcribe la voz del altavoz;
// la entrada de voz pregunta qué sonaba cuando empezó a oír una frase para no tomarla como orden.
// Lo que el usuario dice después de que la app calló nunca es eco, aunque repita sus palabras
// (el tutorial dice «chef, siguiente» y el usuario lo repite).
/** Retraso entre lo que suena y el primer parcial que entrega el reconocimiento. */
const ECHO_LAG_MS = 400;
const MS_PER_CHAR = 100;
const KEEP_MS = 30000;
const spoken: { text: string; start: number; end: number }[] = [];

/** Textos que sonaban por el altavoz en el instante `at`. */
export function speechAt(at: number, now = Date.now()): string[] {
  while (spoken.length > 0 && spoken[0]!.end < now - KEEP_MS) spoken.shift();
  return spoken
    .filter((entry) => {
      // Si el navegador no avisa del final, se estima por el largo del texto.
      const end = Math.min(entry.end, entry.start + entry.text.length * MS_PER_CHAR);
      return entry.start <= at && at <= end + ECHO_LAG_MS;
    })
    .map((entry) => entry.text);
}

export interface SpeakOptions {
  volume: number;
  /** Corta lo que se esté leyendo antes de empezar. */
  interrupt: boolean;
  onStart?: () => void;
  onEnd?: () => void;
}

/** Lee `text` en voz alta. Devuelve false si el navegador no tiene síntesis de voz. */
export function speak(text: string, { volume, interrupt, onStart, onEnd }: SpeakOptions): boolean {
  const engine = synth();
  if (!engine || typeof SpeechSynthesisUtterance === 'undefined') return false;
  if (interrupt) engine.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = spanishVoice();
  utterance.lang = voice?.lang ?? 'es-PE';
  if (voice) utterance.voice = voice;
  utterance.volume = Math.min(1, Math.max(0, volume));
  // Si va en cola detrás de otra lectura, empieza a sonar recién en `onstart`.
  const queued = engine.speaking && !interrupt;
  const entry = { text, start: queued ? Infinity : Date.now(), end: Infinity };
  spoken.push(entry);
  const ended = () => {
    entry.end = Date.now();
    onEnd?.();
  };
  utterance.onstart = () => {
    entry.start = Math.min(entry.start, Date.now());
    onStart?.();
  };
  utterance.onend = ended;
  utterance.onerror = ended;
  engine.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  synth()?.cancel();
}
