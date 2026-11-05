// Aprendizaje con el uso (RF-29): cada evento produce un perfil nuevo y, si aprendió algo que
// conviene contar, un aviso. Solo escribe en `learned`, `emotional`, `history` y en la
// verbosidad; lo explícito nunca se sobrescribe.

import type { Profile } from '@chef/shared';
import type { UsageEvent } from '../core/contracts';

export interface LearningResult {
  profile: Profile;
  notice?: string;
}

export function applyUsageEvent(profile: Profile, event: UsageEvent, date: string): LearningResult {
  switch (event.type) {
    case 'recipeCompleted':
      return {
        profile: {
          ...profile,
          history: [
            ...profile.history,
            { recipeId: event.recipeId, date, substitutions: event.substitutions },
          ],
        },
      };
    case 'recipeRated': {
      const history = [...profile.history];
      const index = history.findLastIndex((h) => h.recipeId === event.recipeId);
      const entry = history[index];
      if (!entry) return { profile };
      history[index] = { ...entry, rating: event.rating };
      return { profile: { ...profile, history } };
    }
    default:
      return { profile };
  }
}
