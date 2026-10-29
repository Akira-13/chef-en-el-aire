// Modo cocina: un paso a la vez en tipografía grande (RF-11), controlado por cualquier canal a
// través del bus de comandos (RF-12).

import { useCallback, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AssistantPanel } from '../assistant/AssistantPanel';
import { useStepNavigation } from '../cooking/useStepNavigation';
import { commandBus, useCommands } from '../core/commandBus';
import { enterScreen } from '../core/commandContext';
import { useRecipe } from '../core/recipes';
import { output } from '../core/services';
import { ChannelStatus } from '../input';
import { Card, Chip, IconButton, Screen } from '../ui';
import { formatDuration, recipeArt } from '../ui/labels';
import styles from './screens.module.css';

export function CookingScreen() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const { status, recipe } = useRecipe(recipeId);
  const finish = useCallback(() => navigate(`/listo/${recipeId}`), [navigate, recipeId]);
  const nav = useStepNavigation(recipe, finish);
  const { step } = nav;

  useEffect(() => {
    if (!recipe || !step) return;
    enterScreen('cooking', {
      recipeId: recipe.id,
      stepNumber: step.number,
      totalSteps: recipe.steps.length,
      stepHasTimer: step.timerSeconds !== null,
    });
    output.announce({
      text: `Paso ${step.number}. ${step.text}`,
      short: `Paso ${step.number}. ${step.shortText}`,
      kind: 'step',
    });
  }, [recipe, step, nav.repeatCount]);

  useCommands(({ command }) => {
    switch (command.type) {
      case 'next':
        nav.next();
        break;
      case 'previous':
        nav.previous();
        break;
      case 'repeat':
        nav.repeat();
        break;
      case 'pause':
        nav.setPaused(true);
        break;
      case 'resume':
        nav.setPaused(false);
        break;
      default:
        break;
    }
  });

  if (!recipe || !step) {
    return (
      <Screen background="cork">
        <p role={status === 'loading' ? 'status' : 'alert'}>
          {status === 'loading' ? 'Cargando receta…' : 'No encontré esta receta.'}
        </p>
        <Link to="/">Volver al inicio</Link>
      </Screen>
    );
  }

  return (
    <Screen
      background="cork"
      header={
        <>
          <IconButton aria-label="Salir del modo cocina" onClick={() => navigate('/')}>
            ✕
          </IconButton>
          <ChannelStatus />
        </>
      }
      footer={
        <>
          <div className={styles.navRow}>
            <IconButton
              aria-label="Paso anterior"
              size={64}
              disabled={nav.index === 0}
              onClick={() => commandBus.emit({ type: 'previous' }, 'touch')}
            >
              ←
            </IconButton>
            <IconButton
              aria-label={nav.isLast ? 'Terminar receta' : 'Paso siguiente'}
              variant="primary"
              size={64}
              onClick={() => commandBus.emit({ type: 'next' }, 'touch')}
            >
              →
            </IconButton>
          </div>
          <p className={styles.channelHint}>🎙️ voz · ✋ gesto · toque — lo que prefieras</p>
        </>
      }
    >
      <Card className={styles.stepCard}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNumber} aria-hidden="true">
            {step.number}
          </span>
          <span className={styles.muted}>
            Paso {step.number} de {nav.total}
          </span>
          <span className={styles.recipeArt} aria-hidden="true">
            {recipeArt(recipe.id)}
          </span>
        </div>
        <p className={styles.stepText}>{step.text}</p>
        {step.readyCue && <p className={styles.readyCue}>✨ {step.readyCue}</p>}
        {step.warning && <p className={styles.readyCue}>⚠️ {step.warning}</p>}
        {step.timerSeconds !== null && (
          <div className={styles.chipRow}>
            <Chip tone="timer">
              ⏱ {step.timerName} · {formatDuration(step.timerSeconds)}
            </Chip>
          </div>
        )}
        {nav.paused && <p role="status">⏸ En pausa</p>}
      </Card>

      <AssistantPanel recipe={recipe} step={step} />
    </Screen>
  );
}
