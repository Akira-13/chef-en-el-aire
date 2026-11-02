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
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  engine.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  synth()?.cancel();
}
