// Alias público de la Comunidad (RF-33): lo único que se publica de la persona. No puede ser su
// nombre real.

import { normalizeText } from '../personalization/text';

/** El mismo límite que acepta el servidor de la Comunidad. */
export const ALIAS_MAX_LENGTH = 30;

export type AliasValidation = { ok: true; alias: string } | { ok: false; error: string };

const words = (text: string) =>
  normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

export function validateAlias(alias: string, profileName: string): AliasValidation {
  const trimmed = alias.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { ok: false, error: 'Escribe un alias.' };
  if (trimmed.length > ALIAS_MAX_LENGTH) {
    return { ok: false, error: `El alias puede tener hasta ${ALIAS_MAX_LENGTH} caracteres.` };
  }
  const nameWords = words(profileName);
  const aliasWords = words(trimmed);
  if (nameWords.length > 0 && nameWords.every((word) => aliasWords.includes(word))) {
    return { ok: false, error: 'Usa un alias, no tu nombre real.' };
  }
  return { ok: true, alias: trimmed };
}
