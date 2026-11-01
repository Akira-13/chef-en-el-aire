// Cierre de la receta: celebración breve y saltable, y calificación (RF-40, RF-31). La
// animación y el sonido respetan las preferencias del perfil (CA-32.2).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router';
import { celebrationPlan } from '../cooking/progress';
import { commandBus, useCommands } from '../core/commandBus';
import { enterScreen } from '../core/commandContext';
import { useRecipe } from '../core/recipes';
import { output, profileService, useProfile } from '../core/services';
import { Button, IconButton, Screen } from '../ui';
import { recipeArt } from '../ui/labels';
import styles from './screens.module.css';

// Valoración que se guarda en el historial al calificar con el pulgar.
const RATING_BY_THUMB = { up: 5, down: 2 } as const;

const CONFETTI_COLORS = ['#fff3e6', '#f2b35c', '#f2905c', '#ffffff'];

function Confetti({ pieces, durationMs }: { pieces: number; durationMs: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => ({
        left: `${((index + 0.5) * 100) / pieces}%`,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        delayMs: (index % 5) * 180,
      })),
    [pieces],
  );

  return (
    <div className={styles.confetti} aria-hidden="true">
      {items.map((item) => {
        const style: CSSProperties = {
          left: item.left,
          background: item.color,
          animationDelay: `${item.delayMs}ms`,
          animationDuration: `${durationMs - item.delayMs}ms`,
        };
        return <span key={item.left} className={styles.confettiPiece} style={style} />;
      })}
    </div>
  );
}

export function CelebrationScreen() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const { recipe } = useRecipe(recipeId);
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const announced = useRef(false);

  const plan = celebrationPlan(
    profile.emotional.celebration,
    profile.accessibility.outputs.includes('audio'),
  );

  useEffect(() => {
    if (!recipe || announced.current) return;
    announced.current = true;
    enterScreen('celebration', { recipeId: recipe.id });
    output.announce({ text: recipe.celebration, kind: 'success' });
    if (plan.sound) output.cue('celebration');
  }, [recipe, plan.sound]);

  function leave() {
    output.stop();
    navigate('/');
  }

  useCommands(({ command }) => {
    if (recipe && command.type === 'rate') {
      setRating(command.value);
      void profileService.recordEvent({
        type: 'recipeRated',
        recipeId: recipe.id,
        rating: RATING_BY_THUMB[command.value],
      });
      output.announce({ text: '¡Gracias! Lo tendré en cuenta.', kind: 'info' });
    }
    // Saltar la celebración en una sola acción, por cualquier canal (RNF-16).
    if (command.type === 'skip' || command.type === 'next') leave();
  });

  return (
    <Screen
      title="¡Listo!"
      background="primary"
      footer={
        <>
          <Button variant="secondary" size="lg" block onClick={leave}>
            Volver a inicio
          </Button>
          <Button variant="ghost" className={styles.skip} onClick={leave}>
            saltar
          </Button>
        </>
      }
    >
      <Confetti pieces={plan.confetti} durationMs={plan.durationMs} />
      <div className={styles.celebrationBody}>
        <div className={styles.hero}>
          <span className={styles.heroArt} aria-hidden="true">
            🎉
          </span>
          {recipe && (
            <span className={styles.heroArt} aria-hidden="true">
              {recipeArt(recipe.id)}
            </span>
          )}
          <h1 className={styles.celebrationText}>{recipe?.celebration ?? '¡Listo!'}</h1>
          <p className={styles.celebrationNote}>Guardado en tu historial</p>
        </div>
        <p className={styles.celebrationNote}>¿Te gustó?</p>
        <div className={styles.ratingRow}>
          <IconButton
            aria-label="Me gustó"
            aria-pressed={rating === 'up'}
            size={64}
            onClick={() => commandBus.emit({ type: 'rate', value: 'up' }, 'touch')}
          >
            👍
          </IconButton>
          <IconButton
            aria-label="No me gustó"
            aria-pressed={rating === 'down'}
            size={64}
            onClick={() => commandBus.emit({ type: 'rate', value: 'down' }, 'touch')}
          >
            👎
          </IconButton>
        </div>
      </div>
    </Screen>
  );
}
