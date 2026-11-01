// Recorrido inicial de menos de 2 minutos: el usuario practica "siguiente" por voz y por gesto,
// sin leer un manual (HU-36, CA-36.1). Ningún paso obliga a usar un canal: siempre se puede seguir
// con un toque, porque no todos pueden hablar o hacer gestos (RF-24).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Channel } from '@chef/shared';
import { useCommands } from '../core/commandBus';
import { enterScreen } from '../core/commandContext';
import { output } from '../core/services';
import { Button, Screen } from '../ui';
import { markOnboarded } from './onboardingState';
import styles from './screens.module.css';

interface OnboardingStep {
  art: string;
  title: string;
  text: string;
  /** Canal que se practica en este paso. */
  channel?: Channel;
}

const STEPS: OnboardingStep[] = [
  {
    art: '👩‍🍳',
    title: 'Cocina sin tocar la pantalla',
    text: 'Sigue la receta con la voz, con gestos en el aire o con un toque. Usa lo que te quede mejor.',
  },
  {
    art: '🎙️',
    title: 'Prueba con la voz',
    text: 'Di «chef, siguiente». La palabra «chef» evita que la app reaccione a otras conversaciones.',
    channel: 'voice',
  },
  {
    art: '✋',
    title: 'Prueba con un gesto',
    text: 'Desliza la mano hacia la izquierda frente a la cámara.',
    channel: 'gesture',
  },
  {
    art: '🎉',
    title: '¡Listo para cocinar!',
    text: 'Si te pierdes, di «chef, ayuda» y te digo qué puedes hacer.',
  },
];

// Pausa para que se note el "¡Muy bien!" antes de pasar al siguiente paso.
const SUCCESS_PAUSE_MS = 900;

export function OnboardingScreen() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [practiced, setPracticed] = useState(false);
  const pause = useRef<number | undefined>(undefined);
  const step = STEPS[index] ?? STEPS[0]!;
  const isLast = index === STEPS.length - 1;

  const finish = useCallback(() => {
    markOnboarded();
    output.stop();
    navigate('/', { replace: true });
  }, [navigate]);

  const advance = useCallback(() => {
    window.clearTimeout(pause.current);
    setPracticed(false);
    setIndex((current) => current + 1);
  }, []);

  useEffect(() => enterScreen('onboarding'), []);
  useEffect(() => () => window.clearTimeout(pause.current), []);

  useEffect(() => {
    output.announce({ text: `${step.title}. ${step.text}`, kind: 'info' });
  }, [step]);

  useCommands(({ command, channel }) => {
    if (command.type !== 'next' || channel !== step.channel || practiced) return;
    setPracticed(true);
    output.cue('success');
    output.announce({ text: '¡Muy bien!', kind: 'success' });
    pause.current = window.setTimeout(advance, SUCCESS_PAUSE_MS);
  });

  return (
    <Screen
      title="Bienvenida"
      header={
        <>
          <span className={styles.brand}>Chef en el Aire</span>
          {!isLast && (
            <Button variant="ghost" onClick={finish}>
              Saltar
            </Button>
          )}
        </>
      }
      footer={
        <Button size="lg" block onClick={isLast ? finish : advance}>
          {isLast ? 'Empezar' : 'Continuar'}
        </Button>
      }
    >
      <div key={index} className={styles.onboarding}>
        <span className={styles.heroArt} aria-hidden="true">
          {step.art}
        </span>
        <h1 className={styles.title}>{step.title}</h1>
        <p className={styles.onboardingText}>{step.text}</p>
        {practiced && <p className={styles.cheer}>¡Muy bien! 🎉</p>}
      </div>
      <p className={styles.muted} aria-hidden="true">
        {index + 1} de {STEPS.length}
      </p>
    </Screen>
  );
}
