// Cierre de la receta: celebración breve y saltable, registro en el historial y calificación
// (RF-40, RF-31).

import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { commandBus, useCommands } from '../core/commandBus';
import { enterScreen } from '../core/commandContext';
import { useRecipe } from '../core/recipes';
import { output, profileService } from '../core/services';
import { Button, IconButton, Screen } from '../ui';
import styles from './screens.module.css';

// Valoración que se guarda en el historial al calificar con el pulgar.
const RATING_BY_THUMB = { up: 5, down: 2 } as const;

export function CelebrationScreen() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const { recipe } = useRecipe(recipeId);
  const recorded = useRef(false);

  useEffect(() => {
    if (!recipe || recorded.current) return;
    recorded.current = true;
    enterScreen('celebration', { recipeId: recipe.id });
    void profileService.recordEvent({
      type: 'recipeCompleted',
      recipeId: recipe.id,
      substitutions: [],
    });
    output.announce({ text: recipe.celebration, kind: 'success' });
    output.cue('celebration');
  }, [recipe]);

  useCommands(({ command }) => {
    if (!recipe) return;
    if (command.type === 'rate') {
      void profileService.recordEvent({
        type: 'recipeRated',
        recipeId: recipe.id,
        rating: RATING_BY_THUMB[command.value],
      });
      output.announce({ text: '¡Gracias! Lo tendré en cuenta.', kind: 'info' });
    }
    // Saltar la celebración en una sola acción, por cualquier canal (RNF-16).
    if (command.type === 'skip' || command.type === 'next') navigate('/');
  });

  return (
    <Screen
      background="primary"
      footer={
        <Button variant="secondary" size="lg" block onClick={() => navigate('/')}>
          Volver a inicio
        </Button>
      }
    >
      <div className={styles.hero}>
        <span className={styles.heroArt} aria-hidden="true">
          🎉
        </span>
        <h1 className={styles.celebrationText}>{recipe?.celebration ?? '¡Listo!'}</h1>
      </div>
      <p>¿Te gustó?</p>
      <div className={styles.ratingRow}>
        <IconButton
          aria-label="Me gustó"
          size={64}
          onClick={() => commandBus.emit({ type: 'rate', value: 'up' }, 'touch')}
        >
          👍
        </IconButton>
        <IconButton
          aria-label="No me gustó"
          size={64}
          onClick={() => commandBus.emit({ type: 'rate', value: 'down' }, 'touch')}
        >
          👎
        </IconButton>
      </div>
    </Screen>
  );
}
