// "Lo que aprendí de ti" (RF-30, CA-25.1, CA-25.2): cada dato aprendido con su origen y la
// forma de borrarlo. Borrar un dato aprendido nunca toca lo explícito.

import type { AcceptedSubstitution, Feeling, LearnedOrigin, Profile } from '@chef/shared';

// Claves estables de cada dato aprendido; se guardan en `learned.origins`.
export const learnedKey = {
  like: (value: string) => `likes:${value}`,
  dislike: (value: string) => `dislikes:${value}`,
  accepted: (s: AcceptedSubstitution) => `acceptedSubstitutions:${s.original}|${s.substitute}`,
  rejected: (s: AcceptedSubstitution) => `rejectedSubstitutions:${s.original}|${s.substitute}`,
  skipsFullReading: () => 'skipsFullReading',
  query: (value: string) => `frequentQueries:${value}`,
  explanation: (value: string) => `frequentExplanations:${value}`,
  difficultStep: (recipeId: string, stepNumber: number) =>
    `difficultSteps:${recipeId}#${stepNumber}`,
  lastFeeling: () => 'lastFeeling',
};

/** Registra (o reemplaza) el origen de un dato aprendido. */
export function withOrigin(
  origins: LearnedOrigin[] | undefined,
  key: string,
  event: string,
  date: string,
): LearnedOrigin[] {
  return [...(origins ?? []).filter((o) => o.key !== key), { key, event, date }];
}

const FEELING_LABELS: Record<Feeling, string> = {
  nervous: 'nervioso o nerviosa',
  tired: 'con cansancio',
  confused: 'con dudas',
  happy: 'feliz',
};

const ORIGIN_LABELS: Record<string, string> = {
  substitutionAccepted: 'aceptaste esta sustitución',
  substitutionRejected: 'rechazaste esta sustitución',
  readingSkipped: 'saltaste la lectura completa en 3 recetas seguidas',
  stepRepeated: 'repetiste este paso 3 veces',
  feelingDeclared: 'lo dijiste mientras cocinabas',
  explanationRequested: 'me pediste que te lo explicara',
  recipeRated: 'por cómo valoraste tus platos',
};

function formatDate(date: string): string {
  const [, month, day] = date.split('-');
  return month && day ? `${Number(day)}/${Number(month)}` : date;
}

export interface LearnedItem {
  key: string;
  label: string;
  /** De dónde salió, por ejemplo "aceptaste esta sustitución el 5/10". */
  origin: string;
}

/** Lista legible de lo aprendido; `recipeName` traduce ids de receta a su nombre. */
export function describeLearned(
  profile: Profile,
  recipeName: (id: string) => string = (id) => id,
): LearnedItem[] {
  const { learned, emotional } = profile;
  const origins = new Map((learned.origins ?? []).map((o) => [o.key, o]));
  const originOf = (key: string) => {
    const origin = origins.get(key);
    if (!origin) return 'de tu historial de uso';
    const what = ORIGIN_LABELS[origin.event] ?? 'por cómo usas la app';
    return `${what} el ${formatDate(origin.date)}`;
  };
  const item = (key: string, label: string): LearnedItem => ({ key, label, origin: originOf(key) });

  return [
    ...learned.likes.map((v) => item(learnedKey.like(v), `Te gusta: ${v}`)),
    ...learned.dislikes.map((v) => item(learnedKey.dislike(v), `No te gusta: ${v}`)),
    ...learned.acceptedSubstitutions.map((s) =>
      item(learnedKey.accepted(s), `Cambias ${s.original} por ${s.substitute}`),
    ),
    ...(learned.rejectedSubstitutions ?? []).map((s) =>
      item(learnedKey.rejected(s), `Prefieres no cambiar ${s.original} por ${s.substitute}`),
    ),
    ...(learned.skipsFullReading
      ? [item(learnedKey.skipsFullReading(), 'Prefieres que lea solo lo breve')]
      : []),
    ...(learned.frequentQueries ?? []).map((v) =>
      item(learnedKey.query(v), `Sueles preguntar: «${v}»`),
    ),
    ...(learned.frequentExplanations ?? []).map((v) =>
      item(learnedKey.explanation(v), `Sueles pedir que te explique «${v}»`),
    ),
    ...(learned.difficultSteps ?? []).map((s) =>
      item(
        learnedKey.difficultStep(s.recipeId, s.stepNumber),
        `Te costó el paso ${s.stepNumber} de ${recipeName(s.recipeId)}`,
      ),
    ),
    ...(emotional.lastFeeling
      ? [
          item(
            learnedKey.lastFeeling(),
            `La última vez dijiste que estabas ${FEELING_LABELS[emotional.lastFeeling.feeling]}`,
          ),
        ]
      : []),
  ];
}

/**
 * Borra un dato aprendido y su origen (CA-25.2). Al quitarlo de `learned` deja de usarse en
 * sugerencias y sustituciones. Lo explícito y la configuración de accesibilidad no cambian.
 */
export function forgetLearned(profile: Profile, key: string): Profile {
  const { learned, emotional } = profile;
  const keep = <T>(list: T[] | undefined, keyOf: (value: T) => string) =>
    list && list.filter((value) => keyOf(value) !== key);

  return {
    ...profile,
    learned: {
      ...learned,
      likes: keep(learned.likes, learnedKey.like)!,
      dislikes: keep(learned.dislikes, learnedKey.dislike)!,
      acceptedSubstitutions: keep(learned.acceptedSubstitutions, learnedKey.accepted)!,
      rejectedSubstitutions: keep(learned.rejectedSubstitutions, learnedKey.rejected),
      frequentQueries: keep(learned.frequentQueries, learnedKey.query),
      frequentExplanations: keep(learned.frequentExplanations, learnedKey.explanation),
      difficultSteps: keep(learned.difficultSteps, (s) =>
        learnedKey.difficultStep(s.recipeId, s.stepNumber),
      ),
      ...(key === learnedKey.skipsFullReading() && {
        skipsFullReading: false,
        readingSkipStreak: [],
      }),
      origins: learned.origins?.filter((o) => o.key !== key),
    },
    emotional:
      key === learnedKey.lastFeeling() ? { ...emotional, lastFeeling: undefined } : emotional,
  };
}
