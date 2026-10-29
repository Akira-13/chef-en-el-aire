// Adaptación de la receta con el asistente según el perfil (RF-05). Si el asistente no está
// disponible, se informa y la receta original sigue intacta (RF-10).

import { useState } from 'react';
import type { AdaptResponse, Recipe } from '@chef/shared';
import { assistantClient } from '../core/assistantClient';
import { useProfile } from '../core/services';
import { Button } from '../ui';

type PanelState =
  { phase: 'idle' } | { phase: 'loading' } | { phase: 'done'; response: AdaptResponse };

export function AdaptationPanel({ recipe }: { recipe: Recipe }) {
  const profile = useProfile();
  const [state, setState] = useState<PanelState>({ phase: 'idle' });

  async function adapt() {
    setState({ phase: 'loading' });
    const response = await assistantClient.adapt({
      recipeId: recipe.id,
      constraints: {
        allergies: profile.explicit.allergies,
        dinerRestrictions: profile.explicit.dinerRestrictions,
        diet: profile.explicit.diet,
      },
      pantry: profile.pantry,
      skillLevel: profile.skillLevel,
    });
    setState({ phase: 'done', response });
  }

  return (
    <section aria-label="Adaptar con IA">
      <Button variant="secondary" block disabled={state.phase === 'loading'} onClick={adapt}>
        ✨ Adaptar con IA a mi perfil
      </Button>
      {state.phase === 'loading' && <p role="status">Pensando…</p>}
      {state.phase === 'done' && state.response.status === 'unavailable' && (
        <p role="status">{state.response.message}</p>
      )}
      {state.phase === 'done' && state.response.status !== 'unavailable' && (
        <p role="status">{state.response.changes.length} cambios propuestos.</p>
      )}
    </section>
  );
}
