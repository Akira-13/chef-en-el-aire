// Comparación de textos escritos o dictados: sin tildes, en singular y por frase completa, para
// que "huevos" coincida con "huevo" y "papa amarilla" cubra "papa amarilla sancochada".

/** Pasa a minúsculas y quita tildes para comparar textos escritos o dictados. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

// Plural simple del español: "huevos" → "huevo", "champiñones" → "champinon", "nueces" → "nuez".
function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ces')) return `${word.slice(0, -3)}z`;
  if (word.length > 4 && word.endsWith('es') && /[lrndjiu]$/.test(word.slice(0, -2))) {
    return word.slice(0, -2);
  }
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Palabras normalizadas y en singular. */
export function tokens(text: string): string[] {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(singular);
}

function containsPhrase(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((word, j) => haystack[i + j] === word)) return true;
  }
  return false;
}

/** Verdadero si una frase contiene a la otra palabra por palabra ("pollo" ↔ "pechuga de pollo"). */
export function phrasesMatch(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  return containsPhrase(ta, tb) || containsPhrase(tb, ta);
}

/** Verdadero si `text` contiene la frase `phrase` palabra por palabra. */
export function containsWords(text: string, phrase: string): boolean {
  return containsPhrase(tokens(text), tokens(phrase));
}
