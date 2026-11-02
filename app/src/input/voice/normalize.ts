/** Minúsculas, sin tildes ni puntuación, para comparar frases dictadas. */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[¿?¡!.,;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
