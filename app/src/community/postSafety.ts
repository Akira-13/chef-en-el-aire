// Marca de seguridad de una receta publicada para quien mira la lista (RF-35). Usa el mismo
// `findAllergens` que la pantalla de la receta, con el perfil de quien la abre. Solo informa: no
// oculta nada ni reemplaza el bloqueo, que sigue ocurriendo al abrir la receta. Puro, sin
// core/services.

import { ALLERGEN_LABELS, findAllergens, type CommunityPost, type Profile } from '@chef/shared';

export interface PostSafety {
  /** `true` si el validador no encontró alérgenos del perfil ni de los comensales. */
  safe: boolean;
  /** Texto corto para la marca y para la lectura en voz. */
  text: string;
}

/**
 * Revisa la receta de una publicación con el perfil actual. Los logros no llevan receta, así que
 * no tienen marca. Una receta que el validador no puede leer cuenta como no segura: nunca se
 * da por buena una receta ajena sin revisar.
 */
export function postSafety(
  post: Pick<CommunityPost, 'kind' | 'recipe'>,
  profile: Pick<Profile, 'explicit'>,
): PostSafety | undefined {
  if (post.kind !== 'recipe' || !post.recipe) return undefined;
  try {
    const findings = findAllergens(post.recipe, profile.explicit);
    if (findings.length === 0) return { safe: true, text: 'Sin alérgenos de tu perfil' };
    const names = new Set(
      findings.map(
        (f) =>
          `${ALLERGEN_LABELS[f.allergen]}${f.source === 'diner' && f.diner ? ` (para ${f.diner})` : ''}`,
      ),
    );
    return { safe: false, text: `Contiene ${[...names].join(', ')}` };
  } catch {
    return { safe: false, text: 'No pude revisarla con tu perfil' };
  }
}
