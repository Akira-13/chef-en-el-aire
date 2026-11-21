// Lo que se publica de una receta adaptada (RF-34, CA-27.2): los cambios con su antes y después.
// El motivo suele nombrar la alergia o la condición de quien publica, así que solo viaja si la
// persona marcó "Mostrar motivos".

import type { CommunityChange, RecipeChange } from '@chef/shared';

export function toCommunityChanges(
  changes: readonly RecipeChange[],
  showReasons: boolean,
): CommunityChange[] {
  return changes.map(({ kind, before, after, reason }) => ({
    kind,
    before,
    after,
    ...(showReasons && reason.trim() && { reason }),
  }));
}
