// Emoción vigente de la persona (RF-42, CA-33.2): la última declarada o inferida vale durante
// 30 minutos desde que se registró. El tono del asistente y el ritmo de lectura la consultan
// aquí. Módulo puro, sin core/services.

import type { DeclaredFeeling, Profile } from '@chef/shared';

export const FEELING_VALID_MS = 30 * 60 * 1000;

/** Emoción registrada hace menos de 30 minutos; sin hora (datos antiguos) no está vigente. */
export function currentFeeling(
  profile: Profile,
  now: Date = new Date(),
): DeclaredFeeling | undefined {
  const feeling = profile.emotional.lastFeeling;
  if (!feeling?.at) return undefined;
  const age = now.getTime() - Date.parse(feeling.at);
  return Number.isFinite(age) && age < FEELING_VALID_MS ? feeling : undefined;
}
