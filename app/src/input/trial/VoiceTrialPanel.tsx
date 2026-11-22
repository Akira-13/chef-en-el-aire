// Panel del facilitador para el modo prueba de voz (?prueba=voz, CU-05). Se abre sobre el Inicio:
// mientras está activo, los comandos de la prueba no tienen efecto en esa pantalla. No guarda
// audio ni frases, solo el comando reconocido y el resultado (RNF-11).

import { useEffect, useReducer, useState } from 'react';
import { COMMAND_LABELS, type CommandType } from '@chef/shared';
import { useCommands } from '../../core/commandBus';
import { Button } from '../../ui';
import { useChannelStore } from '../channelStore';
import { downloadFile } from './download';
import styles from './trial.module.css';
import {
  createVoiceTrial,
  formatSummary,
  NOISE_LEVELS,
  sanitizeParticipant,
  type NoiseLevel,
  type TrialRequestResult,
} from './voiceTrial';

/** Pausa entre un resultado y el pedido siguiente, para que la persona lo vea. */
const FEEDBACK_MS = 1500;
const TICK_MS = 250;

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function recognizedLabel(type: string | null): string {
  if (!type) return 'nada';
  return type in COMMAND_LABELS ? COMMAND_LABELS[type as CommandType] : type;
}

function describe(result: TrialRequestResult): string {
  if (result.skipped) return 'Pedido saltado.';
  if (result.hit) return '✔ Acertó.';
  return `✘ No acertó: se reconoció «${recognizedLabel(result.recognized)}».`;
}

export interface VoiceTrialPanelProps {
  /** Semilla del orden de los pedidos; si falta, es aleatoria. */
  seed?: number;
}

export function VoiceTrialPanel({ seed }: VoiceTrialPanelProps) {
  const [trial, setTrial] = useState(() => createVoiceTrial(seed ?? newSeed()));
  const [phase, setPhase] = useState<'idle' | 'asking' | 'feedback'>('idle');
  const [feedback, setFeedback] = useState('');
  const [participant, setParticipant] = useState('');
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const voice = useChannelStore((s) => s.voice);

  function showResult(result: TrialRequestResult | null): void {
    if (!result) return;
    setFeedback(describe(result));
    setPhase('feedback');
  }

  function ask(): void {
    trial.begin(performance.now());
    setPhase('asking');
  }

  useCommands((event) => {
    if (phase !== 'asking') return;
    showResult(trial.receive(event, performance.now()));
  });

  // Pasados 5 s sin respuesta, el pedido cuenta como no reconocido.
  useEffect(() => {
    if (phase !== 'asking') return;
    const id = window.setInterval(() => showResult(trial.tick(performance.now())), TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, trial]);

  // Tras mostrar el resultado se pasa al pedido siguiente, o se termina.
  useEffect(() => {
    if (phase !== 'feedback') return;
    const id = window.setTimeout(() => {
      if (trial.finished()) setPhase('idle');
      else ask();
    }, FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [phase, trial]);

  function restart(): void {
    setTrial(createVoiceTrial(newSeed()));
    setPhase('idle');
    setFeedback('');
  }

  function exportResults(): void {
    const code = sanitizeParticipant(participant);
    const data = trial.export(code, new Date());
    downloadFile(`${code ?? 'prueba'}-prueba-voz.json`, JSON.stringify(data, null, 2));
  }

  const current = trial.current();
  const finished = trial.finished();
  const answered = trial.results().length;
  const summaryLines = formatSummary(trial.summary());
  const skipped = trial.summary().skipped;

  return (
    <section className={styles.panel} aria-labelledby="voice-trial-title">
      <h2 id="voice-trial-title" className={styles.title}>
        Prueba de voz · pedido {Math.min(trial.position(), trial.total)} de {trial.total}
      </h2>
      <progress className={styles.progress} max={trial.total} value={answered}>
        {answered} de {trial.total}
      </progress>

      {voice !== 'on' && (
        <p role="status" className={styles.warning}>
          La voz no está activa. Abre el Inicio con el micrófono permitido y conexión a internet.
        </p>
      )}

      <p className={styles.prompt} aria-live="polite">
        {finished
          ? 'Prueba terminada'
          : phase === 'asking' && current
            ? `Di: chef, ${current.phrase}`
            : phase === 'feedback'
              ? feedback
              : 'Pulsa «Empezar»'}
      </p>

      <div className={styles.row} role="group" aria-label="Nivel de ruido">
        {(Object.keys(NOISE_LEVELS) as NoiseLevel[]).map((level) => (
          <Button
            key={level}
            variant="secondary"
            className={styles.toggle}
            aria-pressed={trial.noise() === level}
            onClick={() => {
              trial.setNoise(level);
              refresh();
            }}
          >
            Ruido {NOISE_LEVELS[level].label}
          </Button>
        ))}
      </div>

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
        {phase === 'idle' && !finished && <Button onClick={ask}>Empezar</Button>}
        <Button
          variant="secondary"
          disabled={phase !== 'asking'}
          onClick={() => {
            trial.repeatRequest(performance.now());
            refresh();
          }}
        >
          Repetir pedido
        </Button>
        <Button
          variant="secondary"
          disabled={phase !== 'asking'}
          onClick={() => showResult(trial.skip())}
        >
          Saltar
        </Button>
        <Button variant="secondary" disabled={answered === 0} onClick={exportResults}>
          Exportar
        </Button>
        {finished && <Button onClick={restart}>Otro participante</Button>}
      </div>

      <ul className={styles.result} aria-label="Resultado">
        {summaryLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
        {skipped > 0 && <li>Saltados: {skipped}</li>}
      </ul>
      <p className={styles.note}>
        Úsalo en el Inicio: ahí los comandos de la prueba no mueven la pantalla. No se guarda audio.
      </p>
    </section>
  );
}
