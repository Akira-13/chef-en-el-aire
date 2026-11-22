// Compartir en la Comunidad el plato terminado (RF-37): el plato, la valoración y el alias, nunca
// datos de salud. Responde también a "comparte mi logro" en la celebración. Sin conexión queda
// en la cola y se envía al reconectar.

import { useRef, useState, type ReactElement } from 'react';
import { useCommands } from '../core/commandBus';
import { getCommandContext } from '../core/commandContext';
import { output, useProfile } from '../core/services';
import { Button } from '../ui';
import { AliasField, saveAlias } from './AliasField';
import { suggestAlias } from './format';
import { publishPost, type ActionResult } from './outbox';
import styles from './community.module.css';

export interface ShareAchievementButtonProps {
  recipeId: string;
  recipeName: string;
  rating?: 'up' | 'down';
}

export function ShareAchievementButton({
  recipeId,
  recipeName,
  rating,
}: ShareAchievementButtonProps): ReactElement | null {
  const profile = useProfile();
  const savedAlias = profile.community?.alias;
  const [phase, setPhase] = useState<'idle' | 'alias' | 'sending' | ActionResult>('idle');
  const [draftAlias, setDraftAlias] = useState(suggestAlias);
  const [aliasError, setAliasError] = useState<string>();
  // Dos "comparte" o dos toques seguidos llegan antes de volver a pintar: evita compartir dos veces.
  const inFlight = useRef(false);

  async function share(alias: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase('sending');
    let result: ActionResult;
    try {
      result = await publishPost({
        kind: 'achievement',
        alias,
        recipeId,
        recipeName,
        ...(rating && { rating }),
      });
    } finally {
      inFlight.current = false;
    }
    setPhase(result);
    if (result === 'sent') {
      output.cue('success');
      output.announce({ text: 'Compartí tu logro en la Comunidad.', kind: 'success' });
    } else if (result === 'pending') {
      output.announce({
        text: 'Sin conexión: tu logro se compartirá al volver la conexión.',
        kind: 'info',
      });
    }
  }

  function start() {
    if (savedAlias) {
      void share(savedAlias);
      return;
    }
    // Sin alias, primero se muestra el sugerido para que la persona lo vea o lo cambie.
    setPhase('alias');
    output.announce({
      text: `Compartirás tu logro como ${draftAlias}. Puedes cambiar el alias. Di "comparte mi logro" otra vez o toca Compartir.`,
      short: 'Di "comparte mi logro" otra vez para compartir.',
      kind: 'info',
    });
  }

  function confirmAlias() {
    const saved = saveAlias(draftAlias, profile.name);
    if (!saved.ok) {
      setAliasError(saved.error);
      output.announce({ text: saved.error, kind: 'error' });
      return;
    }
    void share(saved.alias);
  }

  useCommands(({ command }) => {
    if (command.type !== 'share' || getCommandContext().screen !== 'celebration') return;
    if (phase === 'alias') confirmAlias();
    else if (phase === 'idle' || phase === 'rejected') start();
  });

  if (phase === 'sent' || phase === 'pending') {
    return (
      <p className={styles.notice} role="status">
        {phase === 'sent'
          ? '✅ Compartido en la Comunidad.'
          : '⏳ Pendiente: se compartirá al volver la conexión.'}
      </p>
    );
  }

  if (phase === 'alias') {
    return (
      <div className={styles.preview}>
        <p>En la Comunidad solo se verá tu alias, el plato y tu valoración.</p>
        <AliasField
          value={draftAlias}
          error={aliasError}
          onChange={(value) => {
            setDraftAlias(value);
            setAliasError(undefined);
          }}
        />
        <div className={styles.actions}>
          <Button onClick={confirmAlias}>Compartir</Button>
          <Button variant="ghost" onClick={() => setPhase('idle')}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button variant="secondary" block disabled={phase === 'sending'} onClick={start}>
      🎉 Compartir mi logro en la Comunidad
    </Button>
  );
}
