// Panel del facilitador para el modo prueba de gestos (?prueba=gestos, CU-06): 10 repeticiones de
// cada gesto básico y 5 minutos de cocina para contar falsos positivos. Se abre sobre el Inicio,
// donde los comandos de la prueba no mueven la pantalla. No guarda video ni imágenes (RNF-11).

import { useEffect, useReducer, useState } from 'react';
import { useCommands } from '../../core/commandBus';
import { useProfile } from '../../core/services';
import { Button } from '../../ui';
import { useChannelStore } from '../channelStore';
import { downloadFile } from './download';
import {
  BASIC_GESTURES,
  COOKING_SESSION_MS,
  createCookingSession,
  createGestureRepetitions,
  exportGestureTrial,
  formatByGesture,
  formatCooking,
  formatRepetitions,
  type GestureAttempt,
} from './gestureTrial';
import styles from './trial.module.css';
import { sanitizeParticipant } from './voiceTrial';

const FEEDBACK_MS = 1500;
const TICK_MS = 250;

// Gesto del perfil que necesita cada gesto básico (los nombres vienen de AccessibilityPrefs).
const PROFILE_GESTURE = {
  swipeLeft: 'deslizar_siguiente',
  swipeRight: 'deslizar_anterior',
  palm: 'palma_abierta_pausar',
  thumbUp: 'pulgar_arriba_confirmar',
} as const;

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function describe(attempt: GestureAttempt): string {
  if (attempt.skipped) return 'Intento saltado.';
  if (attempt.hit) return '✔ Acertó.';
  return attempt.recognized
    ? `✘ No acertó: se reconoció otro gesto (${attempt.recognized}).`
    : '✘ No acertó: no se reconoció ningún gesto.';
}

export interface GestureTrialPanelProps {
  seed?: number;
}

export function GestureTrialPanel({ seed }: GestureTrialPanelProps) {
  const [repetitions, setRepetitions] = useState(() => createGestureRepetitions(seed ?? newSeed()));
  const [cooking, setCooking] = useState(createCookingSession);
  const [mode, setMode] = useState<'repetitions' | 'cooking'>('repetitions');
  const [phase, setPhase] = useState<'idle' | 'asking' | 'feedback'>('idle');
  const [feedback, setFeedback] = useState('');
  const [lastGesture, setLastGesture] = useState('');
  const [participant, setParticipant] = useState('');
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const camera = useChannelStore((s) => s.camera);
  const prefs = useProfile().accessibility;

  const missing = BASIC_GESTURES.filter(
    (g) => !prefs.enabledGestures.includes(PROFILE_GESTURE[g.id]),
  );

  function showResult(attempt: GestureAttempt | null): void {
    if (!attempt) return;
    setFeedback(describe(attempt));
    setPhase('feedback');
  }

  function ask(): void {
    repetitions.begin(performance.now());
    setPhase('asking');
  }

  useCommands((event) => {
    const now = performance.now();
    if (mode === 'repetitions' && phase === 'asking') showResult(repetitions.receive(event, now));
    if (mode === 'cooking' && cooking.running()) {
      cooking.receive(event, now);
      if (event.channel === 'gesture') setLastGesture(event.command.type);
      refresh();
    }
  });

  // Pasados 6 s sin gesto, el intento cuenta como no reconocido.
  useEffect(() => {
    if (mode !== 'repetitions' || phase !== 'asking') return;
    const id = window.setInterval(() => showResult(repetitions.tick(performance.now())), TICK_MS);
    return () => window.clearInterval(id);
  }, [mode, phase, repetitions]);

  useEffect(() => {
    if (phase !== 'feedback') return;
    const id = window.setTimeout(() => {
      if (repetitions.finished()) setPhase('idle');
      else ask();
    }, FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [phase, repetitions]);

  // El reloj de la sesión de cocina se actualiza solo y se detiene a los 5 minutos.
  useEffect(() => {
    if (mode !== 'cooking' || !cooking.running()) return;
    const id = window.setInterval(() => {
      cooking.tick(performance.now());
      refresh();
    }, 500);
    return () => window.clearInterval(id);
  }, [mode, cooking, cooking.running()]);

  function exportResults(): void {
    const code = sanitizeParticipant(participant);
    const data = exportGestureTrial(repetitions, cooking, code, new Date(), performance.now());
    downloadFile(`${code ?? 'prueba'}-prueba-gestos.json`, JSON.stringify(data, null, 2));
  }

  function restart(): void {
    setRepetitions(createGestureRepetitions(newSeed()));
    setCooking(createCookingSession());
    setPhase('idle');
    setFeedback('');
    setLastGesture('');
  }

  const current = repetitions.current();
  const finished = repetitions.finished();
  const answered = repetitions.attempts().length;
  const hasData = answered > 0 || cooking.started();
  const cookingSummary = cooking.summary(performance.now());

  return (
    <section className={styles.panel} aria-labelledby="gesture-trial-title">
      <h2 id="gesture-trial-title" className={styles.title}>
        Prueba de gestos
      </h2>

      <div className={styles.row} role="group" aria-label="Parte de la prueba">
        <Button
          variant="secondary"
          className={styles.toggle}
          aria-pressed={mode === 'repetitions'}
          onClick={() => setMode('repetitions')}
        >
          Repeticiones
        </Button>
        <Button
          variant="secondary"
          className={styles.toggle}
          aria-pressed={mode === 'cooking'}
          onClick={() => setMode('cooking')}
        >
          5 minutos de cocina
        </Button>
      </div>

      {camera !== 'on' && (
        <p role="status" className={styles.warning}>
          La cámara aún no está lista. Permite la cámara y espera a que se encienda.
        </p>
      )}
      {missing.length > 0 && (
        <p role="status" className={styles.warning}>
          En este perfil no están activos: {missing.map((g) => g.label.toLowerCase()).join(', ')}.
          Actívalos en el Perfil o esos intentos fallarán.
        </p>
      )}
      {prefs.requiresActivationGesture && (
        <p role="status" className={styles.warning}>
          El perfil pide el gesto de activación (señalar hacia arriba) antes de cada gesto.
        </p>
      )}

      {mode === 'repetitions' ? (
        <>
          <h3 className={styles.title}>
            Intento {Math.min(repetitions.position(), repetitions.total)} de {repetitions.total}
          </h3>
          <progress className={styles.progress} max={repetitions.total} value={answered}>
            {answered} de {repetitions.total}
          </progress>
          <p className={styles.prompt} aria-live="polite">
            {finished
              ? 'Prueba terminada'
              : phase === 'asking' && current
                ? `${current.icon} ${current.how}`
                : phase === 'feedback'
                  ? feedback
                  : 'Pulsa «Empezar»'}
          </p>
          <div className={styles.row}>
            {phase === 'idle' && !finished && <Button onClick={ask}>Empezar</Button>}
            <Button
              variant="secondary"
              disabled={phase !== 'asking'}
              onClick={() => {
                repetitions.repeatRequest(performance.now());
                refresh();
              }}
            >
              Repetir intento
            </Button>
            <Button
              variant="secondary"
              disabled={phase !== 'asking'}
              onClick={() => showResult(repetitions.skip())}
            >
              Saltar
            </Button>
          </div>
          <ul className={styles.result} aria-label="Resultado de las repeticiones">
            <li>{formatRepetitions(repetitions.summary())}</li>
            {formatByGesture(repetitions.summary()).map((line) => (
              <li key={line}>{line}</li>
            ))}
            {repetitions.summary().skipped > 0 && (
              <li>Saltados: {repetitions.summary().skipped}</li>
            )}
          </ul>
        </>
      ) : (
        <>
          <p className={styles.prompt} aria-live="polite">
            {cooking.running()
              ? `Cocina con normalidad · ${Math.floor(cookingSummary.elapsedMs / 60000)}:${String(
                  Math.floor((cookingSummary.elapsedMs % 60000) / 1000),
                ).padStart(2, '0')} de 5:00`
              : cooking.started()
                ? 'Sesión terminada'
                : 'Pulsa «Iniciar»'}
          </p>
          <div className={styles.row}>
            {!cooking.started() && (
              <Button
                onClick={() => {
                  cooking.start(performance.now());
                  refresh();
                }}
              >
                Iniciar
              </Button>
            )}
            {cooking.running() && (
              <Button
                variant="secondary"
                onClick={() => {
                  cooking.stop(performance.now());
                  refresh();
                }}
              >
                Detener
              </Button>
            )}
          </div>
          <Button
            size="lg"
            block
            disabled={!cooking.running()}
            onClick={() => {
              cooking.mark(performance.now());
              refresh();
            }}
          >
            Gesto intencional
          </Button>
          <ul className={styles.result} aria-label="Resultado de la cocina">
            <li>{formatCooking(cookingSummary)}</li>
            <li>
              Gestos reconocidos: {cookingSummary.recognized}
              {lastGesture && cooking.running() ? ` (último: ${lastGesture})` : ''}
            </li>
            <li>Gestos intencionales marcados: {cookingSummary.intentionalMarks}</li>
            {cookingSummary.missedIntentional > 0 && (
              <li>Intencionales no detectados: {cookingSummary.missedIntentional}</li>
            )}
          </ul>
          <p className={styles.note}>
            Toca «Gesto intencional» cuando la persona haga un gesto a propósito. Todo gesto
            reconocido sin ese toque en ±2 s cuenta como falso positivo. Dura{' '}
            {COOKING_SESSION_MS / 60000} minutos.
          </p>
        </>
      )}

      <label className={styles.field}>
        Código del participante (P01 a P08, sin nombres)
        <input
          className={styles.input}
          value={participant}
          maxLength={3}
          placeholder="P01"
          autoComplete="off"
          onChange={(event) => setParticipant(event.target.value)}
        />
      </label>
      <div className={styles.row}>
        <Button variant="secondary" disabled={!hasData} onClick={exportResults}>
          Exportar
        </Button>
        {(finished || (cooking.started() && !cooking.running())) && (
          <Button onClick={restart}>Otro participante</Button>
        )}
      </div>
      <p className={styles.note}>
        Úsalo en el Inicio: ahí los gestos de la prueba no mueven la pantalla. No se guarda video.
      </p>
    </section>
  );
}
