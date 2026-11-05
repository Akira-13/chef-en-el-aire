// Modo cocina: un paso a la vez en tipografía grande (RF-11), controlado por cualquier canal a
// través del bus de comandos (RF-12).

import { useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Step } from '@chef/shared';
import { AssistantPanel } from '../assistant/AssistantPanel';
import { requestAlertPermission } from '../cooking/backgroundAlert';
import { encouragement, estimatedReadingMs, substitutedIngredients } from '../cooking/progress';
import { clearCookingSession } from '../cooking/session';
import { stepIngredients } from '../cooking/stepIngredients';
import { TimerBar } from '../cooking/TimerBar';
import {
  describeTimers,
  findStepTimer,
  findTimer,
  formatSpokenDuration,
  remainingSeconds,
  startTimer,
  useTimers,
} from '../cooking/timers';
import { useNow } from '../cooking/useNow';
import { useStepNavigation } from '../cooking/useStepNavigation';
import { useWakeLock } from '../cooking/useWakeLock';
import { commandBus, useCommands } from '../core/commandBus';
import { enterScreen } from '../core/commandContext';
import { clearAdaptedRecipe, useRecipe } from '../core/recipes';
import { output, profileService, useProfile } from '../core/services';
import { ChannelStatus } from '../input';
import { Button, Card, Chip, IconButton, Screen } from '../ui';
import { formatDuration, recipeArt } from '../ui/labels';
import styles from './screens.module.css';

function StepTimerControl({ step }: { step: Step }) {
  useTimers((state) => state.running);
  const running = step.timerName ? findTimer(step.timerName) : undefined;
  const now = useNow(running !== undefined);

  if (step.timerSeconds === null) return null;
  if (running) {
    return (
      <Chip tone="timer" className={styles.timerRunning}>
        ⏱ {running.name} · {formatDuration(remainingSeconds(running, now))}
      </Chip>
    );
  }
  return (
    <Button
      variant="timer"
      block
      onClick={() => commandBus.emit({ type: 'startTimer', name: step.timerName }, 'touch')}
    >
      ⏱ Iniciar {step.timerName} · {formatDuration(step.timerSeconds)}
    </Button>
  );
}

export function CookingScreen() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const { status, recipe, original, isAdapted } = useRecipe(recipeId);
  const shownAt = useRef(0);

  useWakeLock();

  const finish = useCallback(() => {
    if (!recipe) return;
    void profileService.recordEvent({
      type: 'recipeCompleted',
      recipeId: recipe.id,
      substitutions: substitutedIngredients(original, recipe),
    });
    clearCookingSession();
    clearAdaptedRecipe(recipe.id);
    navigate(`/listo/${recipe.id}`, { replace: true });
  }, [navigate, original, recipe]);

  const nav = useStepNavigation(recipeId, recipe, finish);
  const { step } = nav;

  useEffect(() => {
    if (!recipe || !step) return;
    enterScreen('cooking', {
      recipeId: recipe.id,
      stepNumber: step.number,
      totalSteps: recipe.steps.length,
      stepHasTimer: step.timerSeconds !== null,
    });
    shownAt.current = performance.now();
    // La advertencia se lee siempre: el riesgo no depende de la verbosidad ni de mirar la pantalla.
    const warning = step.warning ? ` Cuidado: ${step.warning}` : '';
    output.announce({
      text: `Paso ${step.number}. ${step.text}${warning}`,
      short: `Paso ${step.number}. ${step.shortText}.${warning}`,
      kind: 'step',
    });
  }, [recipe, step, nav.repeatCount]);

  /** Avanzar antes de que termine la lectura completa es una señal para el perfil (CA-24.1). */
  function noteSkippedReading() {
    if (!recipe || !step) return;
    const { ttsEnabled, verbosity, outputs } = profile.accessibility;
    if (!ttsEnabled || verbosity !== 'detallada' || !outputs.includes('audio')) return;
    if (performance.now() - shownAt.current < estimatedReadingMs(step.text)) {
      void profileService.recordEvent({
        type: 'readingSkipped',
        recipeId: recipe.id,
        stepNumber: step.number,
      });
    }
  }

  function handleStartTimer(name?: string) {
    const target = recipe && step ? findStepTimer(recipe, step, name) : undefined;
    if (!target) {
      output.cue('error');
      output.announce({ text: 'Este paso no tiene temporizador.', kind: 'info' });
      return;
    }
    const { timer, alreadyRunning } = startTimer(target.name, target.seconds);
    const remaining = formatSpokenDuration(remainingSeconds(timer));
    output.cue('success');
    output.announce({
      text: alreadyRunning
        ? `El temporizador ${timer.name} ya está corriendo: faltan ${remaining}.`
        : `Temporizador ${timer.name} iniciado: ${remaining}.`,
      kind: 'info',
    });
  }

  useCommands(({ command, channel }) => {
    switch (command.type) {
      case 'next':
        noteSkippedReading();
        output.stop();
        output.cue('navigate');
        nav.next();
        break;
      case 'previous':
        if (nav.previous()) {
          output.stop();
          output.cue('navigate');
        } else {
          // Distinto al éxito y sin reproche (CA-31.2).
          output.cue('error');
          output.announce({ text: 'Ya estás en el primer paso.', kind: 'info' });
        }
        break;
      case 'repeat':
        if (recipe && step) {
          void profileService.recordEvent({
            type: 'stepRepeated',
            recipeId: recipe.id,
            stepNumber: step.number,
          });
        }
        output.cue('navigate');
        nav.repeat();
        break;
      case 'pause':
        output.stop();
        output.cue('success');
        nav.setPaused(true);
        break;
      case 'resume':
        output.cue('success');
        nav.setPaused(false);
        break;
      case 'startTimer':
        if (channel === 'touch') requestAlertPermission();
        handleStartTimer(command.name);
        break;
      case 'whereAmI':
        if (step) {
          // CA-19.1: paso, texto y temporizadores, para ubicarse sin mirar la pantalla.
          output.announce({
            text: `Paso ${step.number} de ${nav.total}. ${step.text} ${describeTimers()}`,
            kind: 'info',
          });
        }
        break;
      default:
        break;
    }
  });

  if (!recipe || !step) {
    return (
      <Screen title="Modo cocina" background="cork">
        <p role={status === 'loading' ? 'status' : 'alert'}>
          {status === 'loading' ? 'Cargando receta…' : 'No encontré esta receta.'}
        </p>
        <Link to="/">Volver al inicio</Link>
      </Screen>
    );
  }

  const ingredients = stepIngredients(step, recipe.ingredients);
  const cheer = encouragement(nav.index, nav.total);

  return (
    <Screen
      title={`Paso ${step.number} · ${recipe.name}`}
      background="cork"
      fixed
      header={
        <div className={styles.cookingHeader}>
          <div className={styles.cookingTopBar}>
            <IconButton aria-label="Salir del modo cocina" onClick={() => navigate('/')}>
              ✕
            </IconButton>
            <ChannelStatus />
          </div>
          <TimerBar />
        </div>
      }
      footer={
        <>
          <div className={styles.navRow}>
            <IconButton
              aria-label="Paso anterior"
              size={64}
              disabled={nav.isFirst}
              onClick={() => commandBus.emit({ type: 'previous' }, 'touch')}
            >
              ←
            </IconButton>
            <div className={styles.navMiddle}>
              <IconButton
                aria-label="Repetir paso"
                onClick={() => commandBus.emit({ type: 'repeat' }, 'touch')}
              >
                🔁
              </IconButton>
              <IconButton
                aria-label={nav.paused ? 'Continuar' : 'Pausar'}
                onClick={() => commandBus.emit({ type: nav.paused ? 'resume' : 'pause' }, 'touch')}
              >
                {nav.paused ? '▶️' : '⏸️'}
              </IconButton>
            </div>
            <IconButton
              aria-label={nav.isLast ? 'Terminar receta' : 'Paso siguiente'}
              variant="primary"
              size={64}
              onClick={() => commandBus.emit({ type: 'next' }, 'touch')}
            >
              {nav.isLast ? '✓' : '→'}
            </IconButton>
          </div>
          <p className={styles.channelHint}>🎙️ voz · ✋ gesto · toque — lo que prefieras</p>
        </>
      }
    >
      <h1 className="visually-hidden">{recipe.name}</h1>
      <Card pinned key={step.number} className={styles.stepCard}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNumber} aria-hidden="true">
            {step.number}
          </span>
          <span className={styles.stepCount}>
            Paso {step.number} de {nav.total}
            {cheer && <span className={styles.cheer}>{cheer} 🎉</span>}
          </span>
          <span className={styles.recipeArt} aria-hidden="true">
            {recipeArt(recipe.id)}
          </span>
        </div>
        <p className={styles.stepText}>{step.text}</p>
        {step.warning && <p className={styles.warning}>⚠️ {step.warning}</p>}
        {step.readyCue && <p className={styles.readyCue}>✨ {step.readyCue}</p>}
        <StepTimerControl step={step} />
        {ingredients.length > 0 && (
          <ul className={styles.stepIngredients} aria-label="Ingredientes de este paso">
            {ingredients.map((ingredient) => (
              <li key={ingredient.id}>
                <Chip>
                  {ingredient.quantity > 0 && `${ingredient.quantity} ${ingredient.unit} `}
                  {ingredient.name}
                </Chip>
              </li>
            ))}
          </ul>
        )}
        {isAdapted && <Chip tone="have">Receta adaptada</Chip>}
        {nav.paused && (
          <p role="status" className={styles.paused}>
            ⏸️ En pausa. Los temporizadores siguen corriendo.
          </p>
        )}
      </Card>

      <AssistantPanel recipe={recipe} step={step} />
    </Screen>
  );
}
