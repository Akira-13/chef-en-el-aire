// Respuestas a "¿Dijiste…?" y umbral de confianza de la voz (RF-19, CA-14.1).

import { normalizeSpeech } from './normalize';

export const MIN_CONFIDENCE = 0.6;

export function needsConfirmation(confidence: number | undefined): boolean {
  return confidence !== undefined && confidence < MIN_CONFIDENCE;
}

export function isYes(text: string): boolean {
  return /^(?:chef )?(?:si|claro|correcto|exacto|eso)(?: chef)?$/.test(normalizeSpeech(text));
}

export function isNo(text: string): boolean {
  return /^(?:chef )?no(?: chef)?$/.test(normalizeSpeech(text));
}
