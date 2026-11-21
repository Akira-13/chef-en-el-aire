// Aprendizaje con el uso (RF-29, CA-24.1–24.3, RF-42): cada evento produce un perfil nuevo y,
// si aprendió algo que conviene contar, un aviso. Solo escribe en `learned`, `emotional`,
// `history` y, al aprender que prefiere lo breve, en la verbosidad; lo explícito nunca cambia.

import type { AcceptedSubstitution, Profile } from '@chef/shared';
import { normalizeText } from '../personalization/text';
import type { UsageEvent } from '../core/contracts';
import { currentFeeling } from './feeling';
import { learnedKey, withOrigin } from './learned';

export const READING_SKIPS_TO_LEARN = 3;
export const STEP_REPEATS_TO_LEARN = 3;
/** Dos órdenes no entendidas dentro de este intervalo hacen inferir confusión (RF-42). */
export const FAILED_COMMANDS_WINDOW_MS = 60 * 1000;
export const BRIEF_READING_NOTICE = 'A partir de ahora leeré solo lo breve.';
export const INFERRED_FEELING_NOTICE = 'Parece que este paso cuesta. Iré más despacio.';

export interface LearningResult {
  profile: Profile;
  notice?: string;
}

/** Conteos que solo valen durante la sesión, por ejemplo cuántas veces se repitió un paso. */
export interface LearningSession {
  stepRepeats: Map<string, number>;
  /** Momento (ms) de la última orden no entendida que todavía no se emparejó con otra. */
  lastCommandFailedAt?: number;
}

export function createLearningSession(): LearningSession {
  return { stepRepeats: new Map() };
}

const norm = (text: string) => normalizeText(text);

/**
 * RF-42: infiere confusión a partir del uso. Lo declarado manda: si hay una emoción vigente
 * (declarada o ya inferida) no se pisa ni se repite el aviso.
 */
function inferConfusion(
  profile: Profile,
  event: UsageEvent['type'],
  date: string,
  now: Date,
  detail: string,
): LearningResult {
  if (currentFeeling(profile, now)) return { profile };
  return {
    profile: {
      ...profile,
      emotional: {
        ...profile.emotional,
        lastFeeling: { feeling: 'confused', date, source: 'inferred', at: now.toISOString() },
      },
      learned: {
        ...profile.learned,
        origins: withOrigin(profile.learned.origins, learnedKey.lastFeeling(), event, date, detail),
      },
    },
    notice: INFERRED_FEELING_NOTICE,
  };
}
const sameSubstitution = (a: AcceptedSubstitution, b: AcceptedSubstitution) =>
  norm(a.original) === norm(b.original) && norm(a.substitute) === norm(b.substitute);

export function applyUsageEvent(
  profile: Profile,
  event: UsageEvent,
  date: string,
  session: LearningSession = createLearningSession(),
  now: Date = new Date(),
): LearningResult {
  const { learned } = profile;

  switch (event.type) {
    case 'recipeCompleted': {
      // Una receta terminada sin saltar la lectura corta la racha (CA-24.1).
      const streak = learned.readingSkipStreak ?? [];
      return {
        profile: {
          ...profile,
          history: [
            ...profile.history,
            { recipeId: event.recipeId, date, substitutions: event.substitutions },
          ],
          learned: streak.includes(event.recipeId)
            ? learned
            : { ...learned, readingSkipStreak: [] },
        },
      };
    }

    case 'recipeRated': {
      const history = [...profile.history];
      const index = history.findLastIndex((h) => h.recipeId === event.recipeId);
      const entry = history[index];
      if (!entry) return { profile };
      history[index] = { ...entry, rating: event.rating };
      return { profile: { ...profile, history } };
    }

    // CA-24.1: tras saltar la lectura completa en 3 recetas seguidas, lee solo lo breve.
    case 'readingSkipped': {
      const streak = learned.readingSkipStreak ?? [];
      if (streak.includes(event.recipeId)) return { profile };
      const nextStreak = [...streak, event.recipeId];
      const learnsNow = nextStreak.length >= READING_SKIPS_TO_LEARN && !learned.skipsFullReading;
      if (!learnsNow) {
        return { profile: { ...profile, learned: { ...learned, readingSkipStreak: nextStreak } } };
      }
      return {
        profile: {
          ...profile,
          learned: {
            ...learned,
            readingSkipStreak: nextStreak,
            skipsFullReading: true,
            origins: withOrigin(learned.origins, learnedKey.skipsFullReading(), event.type, date),
          },
          accessibility: { ...profile.accessibility, verbosity: 'breve' },
        },
        notice: BRIEF_READING_NOTICE,
      };
    }

    // CA-24.2: lo aceptado se propone primero la próxima vez; lo rechazado, no.
    case 'substitutionAccepted': {
      const accepted = { original: event.original, substitute: event.substitute };
      const has = learned.acceptedSubstitutions.some((s) => sameSubstitution(s, accepted));
      return {
        profile: {
          ...profile,
          learned: {
            ...learned,
            acceptedSubstitutions: has
              ? learned.acceptedSubstitutions
              : [...learned.acceptedSubstitutions, accepted],
            rejectedSubstitutions: learned.rejectedSubstitutions?.filter(
              (s) => !sameSubstitution(s, accepted),
            ),
            origins: withOrigin(learned.origins, learnedKey.accepted(accepted), event.type, date),
          },
        },
      };
    }

    case 'substitutionRejected': {
      const rejected = { original: event.original, substitute: event.substitute };
      const list = learned.rejectedSubstitutions ?? [];
      const has = list.some((s) => sameSubstitution(s, rejected));
      return {
        profile: {
          ...profile,
          learned: {
            ...learned,
            rejectedSubstitutions: has ? list : [...list, rejected],
            acceptedSubstitutions: learned.acceptedSubstitutions.filter(
              (s) => !sameSubstitution(s, rejected),
            ),
            origins: withOrigin(learned.origins, learnedKey.rejected(rejected), event.type, date),
          },
        },
      };
    }

    // CA-24.3: un paso repetido 3 veces se registra como difícil y, al llegar justo a 3, hace
    // inferir confusión (RF-42), aunque el paso ya fuera difícil de antes.
    case 'stepRepeated': {
      const key = learnedKey.difficultStep(event.recipeId, event.stepNumber);
      const count = (session.stepRepeats.get(key) ?? 0) + 1;
      session.stepRepeats.set(key, count);
      if (count < STEP_REPEATS_TO_LEARN) return { profile };
      const steps = learned.difficultSteps ?? [];
      const known = steps.some(
        (s) => s.recipeId === event.recipeId && s.stepNumber === event.stepNumber,
      );
      const withStep: Profile = known
        ? profile
        : {
            ...profile,
            learned: {
              ...learned,
              difficultSteps: [
                ...steps,
                { recipeId: event.recipeId, stepNumber: event.stepNumber },
              ],
              origins: withOrigin(learned.origins, key, event.type, date),
            },
          };
      if (count !== STEP_REPEATS_TO_LEARN) return { profile: withStep };
      return inferConfusion(
        withStep,
        event.type,
        date,
        now,
        `repetiste el paso ${event.stepNumber} tres veces`,
      );
    }

    // RF-42: dos órdenes no entendidas en menos de un minuto hacen inferir confusión.
    case 'commandFailed': {
      const at = now.getTime();
      const previous = session.lastCommandFailedAt;
      if (previous === undefined || at - previous >= FAILED_COMMANDS_WINDOW_MS) {
        session.lastCommandFailedAt = at;
        return { profile };
      }
      session.lastCommandFailedAt = undefined;
      return inferConfusion(
        profile,
        event.type,
        date,
        now,
        'no te entendí 2 veces seguidas en menos de un minuto',
      );
    }

    case 'feelingDeclared':
      return {
        profile: {
          ...profile,
          emotional: {
            ...profile.emotional,
            lastFeeling: {
              feeling: event.feeling,
              date,
              source: 'declared',
              at: now.toISOString(),
            },
          },
          learned: {
            ...learned,
            origins: withOrigin(learned.origins, learnedKey.lastFeeling(), event.type, date),
          },
        },
      };

    case 'explanationRequested': {
      const term = event.term?.trim();
      const list = learned.frequentExplanations ?? [];
      if (!term || list.some((t) => norm(t) === norm(term))) return { profile };
      return {
        profile: {
          ...profile,
          learned: {
            ...learned,
            frequentExplanations: [...list, term],
            origins: withOrigin(learned.origins, learnedKey.explanation(term), event.type, date),
          },
        },
      };
    }

    default:
      return { profile };
  }
}
