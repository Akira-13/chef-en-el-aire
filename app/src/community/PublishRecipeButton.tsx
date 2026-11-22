// Publicar en la Comunidad una receta adaptada con sus cambios (RF-34). Antes se ve una vista
// previa con exactamente lo que se publicará. Los motivos de los cambios suelen nombrar la
// alergia o la condición, así que solo viajan si la persona marca "Mostrar motivos" (CA-27.2).
// También responde a "publica mi receta" en la pantalla Receta: la primera vez abre la vista
// previa y la segunda publica.

import { useRef, useState, type ReactElement } from 'react';
import type { Recipe, RecipeChange } from '@chef/shared';
import { useCommands } from '../core/commandBus';
import { getCommandContext } from '../core/commandContext';
import { output, useProfile } from '../core/services';
import { Button } from '../ui';
import { AliasField, saveAlias } from './AliasField';
import { toCommunityChanges } from './changes';
import { suggestAlias } from './format';
import { publishPost, type ActionResult } from './outbox';
import styles from './community.module.css';

export interface PublishRecipeButtonProps {
  recipe: Recipe;
  changes: RecipeChange[];
}

type Phase = 'idle' | 'preview' | 'sending' | ActionResult;

export function PublishRecipeButton({
  recipe,
  changes,
}: PublishRecipeButtonProps): ReactElement | null {
  const profile = useProfile();
  const savedAlias = profile.community?.alias;
  const [phase, setPhase] = useState<Phase>('idle');
  const [showReasons, setShowReasons] = useState(false);
  const [draftAlias, setDraftAlias] = useState(suggestAlias);
  const [aliasError, setAliasError] = useState<string>();
  // Dos "publica" o dos toques seguidos llegan antes de que la pantalla se vuelva a pintar y
  // verían todavía la vista previa: este marcador evita publicar dos veces.
  const inFlight = useRef(false);

  const published = toCommunityChanges(changes, showReasons);

  function openPreview() {
    setShowReasons(false);
    setPhase('preview');
    output.announce({
      text: `Vista previa: publicarás ${recipe.name} como ${savedAlias ?? draftAlias}, con ${changes.length} cambios y sin los motivos. Revisa que el texto no mencione tu salud. Di "publica mi receta" otra vez o toca Publicar.`,
      short: 'Vista previa lista. Di "publica mi receta" otra vez para publicar.',
      kind: 'info',
    });
  }

  async function publish() {
    if (inFlight.current) return;
    let alias = savedAlias;
    if (!alias) {
      const saved = saveAlias(draftAlias, profile.name);
      if (!saved.ok) {
        setAliasError(saved.error);
        output.announce({ text: saved.error, kind: 'error' });
        return;
      }
      alias = saved.alias;
    }
    inFlight.current = true;
    setPhase('sending');
    let result: ActionResult;
    try {
      // Solo el alias identifica a quien publica: ni su nombre ni sus restricciones (RNF-09).
      result = await publishPost({
        kind: 'recipe',
        alias,
        recipeId: recipe.id,
        recipeName: recipe.name,
        recipe,
        changes: published,
      });
    } finally {
      inFlight.current = false;
    }
    setPhase(result);
    if (result === 'sent') {
      output.cue('success');
      output.announce({ text: 'Publiqué tu receta en la Comunidad.', kind: 'success' });
    } else if (result === 'pending') {
      output.announce({
        text: 'Sin conexión: tu receta se publicará al volver la conexión.',
        kind: 'info',
      });
    }
  }

  useCommands(({ command }) => {
    if (command.type !== 'share' || getCommandContext().screen !== 'recipe') return;
    if (phase === 'preview') void publish();
    else if (phase === 'idle' || phase === 'rejected') openPreview();
  });

  if (changes.length === 0) return null;

  if (phase === 'sent' || phase === 'pending') {
    return (
      <p className={styles.notice} role="status">
        {phase === 'sent'
          ? '✅ Publicada en la Comunidad.'
          : '⏳ Pendiente: se publicará al volver la conexión.'}
      </p>
    );
  }

  if (phase === 'idle' || phase === 'rejected') {
    return (
      <Button variant="secondary" block onClick={openPreview}>
        📣 Publicar en la Comunidad
      </Button>
    );
  }

  return (
    <section className={styles.preview} aria-labelledby="publicar-titulo">
      <h3 id="publicar-titulo" className={styles.previewTitle}>
        Así se verá en la Comunidad
      </h3>
      <p className={styles.notice}>
        Revisa que el texto no mencione tu salud: los pasos adaptados pueden nombrar tu alergia o
        condición.
      </p>
      <dl>
        <dt className={styles.muted}>Plato</dt>
        <dd>{recipe.name}</dd>
        <dt className={styles.muted}>Alias</dt>
        <dd>{savedAlias ?? draftAlias}</dd>
      </dl>
      {!savedAlias && (
        <AliasField
          value={draftAlias}
          error={aliasError}
          onChange={(value) => {
            setDraftAlias(value);
            setAliasError(undefined);
          }}
        />
      )}
      <ul className={styles.changes} aria-label="Cambios que se publicarán">
        {published.map((change, i) => (
          <li key={i} className={styles.change}>
            {change.before} → {change.after}
            {change.reason && <span className={styles.reason}>{change.reason}</span>}
          </li>
        ))}
      </ul>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={showReasons}
          onChange={(event) => setShowReasons(event.target.checked)}
        />
        Mostrar motivos (pueden incluir datos de tu salud)
      </label>
      <div className={styles.actions}>
        <Button disabled={phase === 'sending'} onClick={() => void publish()}>
          Publicar
        </Button>
        <Button variant="ghost" onClick={() => setPhase('idle')}>
          Cancelar
        </Button>
      </div>
    </section>
  );
}
