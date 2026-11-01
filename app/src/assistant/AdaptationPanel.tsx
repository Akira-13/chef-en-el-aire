// Adaptación de la receta con el asistente según el perfil (RF-05). Muestra qué cambió y por
// qué (CA-05.1) y deja elegir entre la versión adaptada y la original (CA-05.2). Si el
// validador local encontró un alérgeno, solo se continúa con una confirmación explícita:
// el botón dedicado o la voz, nunca un gesto genérico (RF-07, CA-06.2). Si el asistente no
// está disponible se informa y la receta original sigue intacta (RF-10).

import { useState } from 'react';
import {
  ALLERGEN_LABELS,
  type AdaptResponse,
  type AllergenFinding,
  type Recipe,
  type RecipeChange,
} from '@chef/shared';
import { assistantClient } from '../core/assistantClient';
import { useCommands } from '../core/commandBus';
import { clearAdaptedRecipe, setAdaptedRecipe, useRecipe } from '../core/recipes';
import { output, useProfile } from '../core/services';
import { Button } from '../ui';
import styles from './assistant.module.css';

type AdaptedResponse = Exclude<AdaptResponse, { status: 'unavailable' }>;

type PanelState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'unavailable'; message: string }
  | { phase: 'result'; response: AdaptedResponse };

function describeFinding(finding: AllergenFinding): string {
  const allergen = ALLERGEN_LABELS[finding.allergen];
  const owner = finding.source === 'diner' && finding.diner ? ` (para ${finding.diner})` : '';
  // Los hallazgos en pasos usan el id "step-<n>" y el nombre es el término encontrado.
  const step = /^step-(\d+)$/.exec(finding.ingredientId);
  const where = step
    ? `el paso ${step[1]} menciona «${finding.ingredientName}»`
    : `«${finding.ingredientName}»`;
  return `${allergen}${owner}: ${where}`;
}

function ChangeLine({ change }: { change: RecipeChange }) {
  const label =
    change.kind === 'step'
      ? `Paso ${change.target ?? ''}`.trim()
      : change.kind === 'servings'
        ? 'Porciones'
        : null;
  return (
    <li className={styles.change}>
      {label && <span className={styles.label}>{label}: </span>}
      <span className={styles.before}>{change.before}</span> →{' '}
      <span className={styles.after}>{change.after}</span>
      <span className={styles.reason}>{change.reason}</span>
    </li>
  );
}

export function AdaptationPanel({ recipe }: { recipe: Recipe }) {
  const profile = useProfile();
  const { isAdapted } = useRecipe(recipe.id);
  const [state, setState] = useState<PanelState>({ phase: 'idle' });

  const blocked =
    state.phase === 'result' && state.response.status === 'blocked' ? state.response : null;

  async function adapt() {
    // "Pensando…" se pinta antes de esperar la respuesta (RNF-03).
    setState({ phase: 'loading' });
    output.announce({ text: 'Pensando…', kind: 'info' });
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
    if (response.status === 'unavailable') {
      output.announce({ text: response.message, kind: 'info' });
      setState({ phase: 'unavailable', message: response.message });
      return;
    }
    if (response.status === 'blocked') {
      const found = response.findings.map(describeFinding).join('. ');
      output.announce({
        text: `Atención: la receta adaptada todavía contiene un alérgeno. ${found}. Di «confirmo» o pulsa el botón si quieres usarla igual.`,
        short: 'Atención: la receta adaptada contiene un alérgeno.',
        kind: 'alert',
      });
    } else {
      output.announce({
        text: `Propuse ${response.changes.length} cambios a la receta.`,
        kind: 'info',
      });
    }
    setState({ phase: 'result', response });
  }

  function applyAdapted(response: AdaptedResponse) {
    setAdaptedRecipe(response.adapted);
    output.announce({ text: 'Usaré la receta adaptada.', kind: 'success' });
    setState({ phase: 'idle' });
  }

  function applyOriginal() {
    clearAdaptedRecipe(recipe.id);
    output.announce({ text: 'Usaré la receta original.', kind: 'info' });
    setState({ phase: 'idle' });
  }

  // Con una advertencia pendiente, solo la voz confirma (CA-06.2): un gesto genérico como el
  // pulgar arriba, el toque o el teclado se ignoran aunque sean el mismo comando.
  useCommands((event) => {
    if (blocked && event.command.type === 'confirm' && event.channel === 'voice') {
      applyAdapted(blocked);
    }
  });

  const result = state.phase === 'result' ? state.response : null;

  return (
    <section aria-label="Adaptar con IA" className={styles.panel}>
      <Button variant="secondary" block disabled={state.phase === 'loading'} onClick={adapt}>
        ✨ Adaptar con IA a mi perfil
      </Button>

      {state.phase === 'loading' && <p role="status">Pensando…</p>}
      {state.phase === 'unavailable' && <p role="status">{state.message}</p>}

      {isAdapted && !result && (
        <>
          <p role="status" className={styles.note}>
            Estás usando la versión adaptada.
          </p>
          <Button variant="ghost" block onClick={applyOriginal}>
            Usar original
          </Button>
        </>
      )}

      {result && (
        <>
          {result.changes.length > 0 ? (
            <ul className={styles.changes} aria-label="Cambios propuestos">
              {result.changes.map((change, i) => (
                <ChangeLine key={`${change.kind}-${change.target ?? i}`} change={change} />
              ))}
            </ul>
          ) : (
            <p role="status">La receta ya se ajusta a tu perfil, no hubo cambios.</p>
          )}

          {blocked && (
            <div role="alert" className={styles.warning}>
              <p className={styles.warningTitle}>La receta adaptada contiene un alérgeno</p>
              <ul className={styles.warningList}>
                {blocked.findings.map((finding) => (
                  <li key={`${finding.ingredientId}-${finding.allergen}-${finding.diner ?? ''}`}>
                    {describeFinding(finding)}
                  </li>
                ))}
              </ul>
              <p>Para usarla igual di «confirmo» o pulsa el botón.</p>
            </div>
          )}

          <div className={styles.actions}>
            {blocked ? (
              <Button block onClick={() => applyAdapted(blocked)}>
                Confirmo, usar igual
              </Button>
            ) : (
              <Button block onClick={() => applyAdapted(result)}>
                Usar adaptada
              </Button>
            )}
            <Button variant="secondary" block onClick={applyOriginal}>
              Usar original
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
