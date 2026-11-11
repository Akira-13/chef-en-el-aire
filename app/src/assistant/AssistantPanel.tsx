// Panel del asistente dentro del modo cocina: dudas con el contexto del paso actual (RF-08) y
// explicación ampliada del paso (RF-13). Si no hay red o el asistente no responde, se avisa y
// la receta sigue usable (RF-10, CA-35.2).

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ALLERGEN_LABELS,
  type AllergenCategory,
  type AskRequest,
  type DietaryConstraints,
  type ExplainRequest,
  type Feeling,
  type Recipe,
  type Step,
} from '@chef/shared';
import { assistantClient } from '../core/assistantClient';
import { commandBus, useCommands } from '../core/commandBus';
import { metrics } from '../core/metrics';
import { output, profileService, useProfile } from '../core/services';
import { Button } from '../ui';
import styles from './assistant.module.css';
import { useOnlineStatus } from './useOnlineStatus';

export interface AssistantPanelProps {
  recipe: Recipe;
  step: Step;
}

const OFFLINE_MESSAGE = 'Sin conexión: el asistente no está disponible';
// Una sola petición a la vez: comparten la clave de las métricas de espera (RNF-03).
const METRIC_KEY = 'assistant';

type PanelState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'unavailable'; message: string }
  | {
      phase: 'answer';
      text: string;
      moreDetail?: string;
      detailShown: boolean;
      allergenWarnings: AllergenCategory[];
    }
  | {
      phase: 'explanation';
      text: string;
      readyCue: string;
      suggested: boolean;
      allergenWarnings: AllergenCategory[];
    };

// RF-42, CA-33.2: apoyo con texto fijo, así responde también sin red y sin gastar una llamada
// al asistente. Quien está contento solo recibe ánimo; los demás reciben además pausar.
const FEELING_SUPPORT: Record<Feeling, { message: string; offerPause: boolean }> = {
  nervous: { message: 'Tranquilo, vas bien. Respira hondo, aquí no hay apuro.', offerPause: true },
  tired: {
    message: 'Se nota el esfuerzo. Puedes tomarte un respiro cuando quieras.',
    offerPause: true,
  },
  confused: {
    message: 'No pasa nada, vamos con calma. Di «explícame» y lo vemos paso a paso.',
    offerPause: true,
  },
  happy: { message: '¡Qué bien! Sigue así, lo estás haciendo muy bien.', offerPause: false },
};

const PAUSE_OFFER = '¿Quieres pausar un momento? Di «pausa» o pulsa el botón.';

// "maní", "maní y leche", "maní, leche y huevo".
const listFormat = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });

function allergenNotice(warnings: AllergenCategory[]): string {
  const names = listFormat.format(warnings.map((a) => ALLERGEN_LABELS[a]));
  return `Esta respuesta menciona ${names}. Recuerda tus alergias y restricciones.`;
}

// RF-07: el texto nombra un alérgeno vigilado; se avisa por voz y subtítulos sin ocultarlo.
function announceAllergenNotice(warnings: AllergenCategory[]) {
  if (warnings.length === 0) return;
  const notice = allergenNotice(warnings);
  output.announce({ text: notice, short: notice, kind: 'alert' });
}

function AllergenNotice({ warnings }: { warnings: AllergenCategory[] }) {
  if (warnings.length === 0) return null;
  return (
    <p role="alert" className={styles.allergenNotice}>
      {allergenNotice(warnings)}
    </p>
  );
}

export function AssistantPanel({ recipe, step }: AssistantPanelProps) {
  const profile = useProfile();
  const online = useOnlineStatus();
  const [question, setQuestion] = useState('');
  const [state, setState] = useState<PanelState>({ phase: 'idle' });
  // Descarta la respuesta que llega tarde, por ejemplo tras cambiar de paso.
  const requestId = useRef(0);
  const busy = useRef(false);
  // El apoyo afectivo va aparte de la respuesta para no pisarla; `paused` sigue los comandos
  // pause y resume de cualquier canal.
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [paused, setPaused] = useState(false);
  // RF-41, CA-33.1: el último ánimo declarado viaja con cada pregunta para que el asistente ajuste
  // el tono. A diferencia del mensaje de apoyo, no se borra al cambiar de paso: quien está
  // nervioso lo sigue estando. Se olvida al declarar que está contento o al cambiar de receta.
  const declaredFeeling = useRef<Feeling | null>(null);

  useEffect(() => {
    declaredFeeling.current = null;
  }, [recipe.id]);

  useEffect(() => {
    requestId.current += 1;
    busy.current = false;
    setState({ phase: 'idle' });
    setQuestion('');
    setFeeling(null);
  }, [recipe.id, step.number]);

  // RNF-03: "Pensando…" cuenta como mostrado cuando ya se pintó, no cuando se pidió.
  useEffect(() => {
    if (state.phase === 'loading') metrics.end('llm.thinking', METRIC_KEY);
  }, [state.phase]);

  // El asistente recibe el perfil para no sugerir alérgenos ni ingredientes vetados (RF-07).
  const constraints: DietaryConstraints = {
    allergies: profile.explicit.allergies,
    dinerRestrictions: profile.explicit.dinerRestrictions,
    diet: profile.explicit.diet,
  };

  // Devuelve el id de la petición, o null si no se puede pedir ahora (sin red u ocupado).
  function begin(): number | null {
    if (!online) {
      output.announce({ text: OFFLINE_MESSAGE, kind: 'info' });
      return null;
    }
    if (busy.current) return null;
    busy.current = true;
    metrics.start('llm.thinking', METRIC_KEY);
    metrics.start('llm.response', METRIC_KEY);
    setState({ phase: 'loading' });
    output.announce({ text: 'Pensando…', kind: 'info' });
    return ++requestId.current;
  }

  // Cierra la medición y dice si la respuesta sigue vigente para este paso.
  function finish(id: number, status: string): boolean {
    metrics.end('llm.response', METRIC_KEY, { status });
    if (id !== requestId.current) return false;
    busy.current = false;
    return true;
  }

  function showUnavailable(message: string) {
    output.announce({ text: message, kind: 'info' });
    setState({ phase: 'unavailable', message });
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = begin();
    if (id === null) return;
    const request: AskRequest = {
      recipeId: recipe.id,
      stepNumber: step.number,
      question: trimmed,
      skillLevel: profile.skillLevel,
      tone: profile.emotional.assistantTone,
      ...(declaredFeeling.current && { feeling: declaredFeeling.current }),
      constraints,
    };
    const response = await assistantClient.ask(request);
    if (!finish(id, response.status)) return;
    if (response.status === 'unavailable') {
      showUnavailable(response.message);
      return;
    }
    // CA-07.3: se muestra escrita y el servicio de salida la lee si la voz está activa.
    output.announce({ text: response.answer, kind: 'answer' });
    const allergenWarnings = response.allergenWarnings ?? [];
    announceAllergenNotice(allergenWarnings);
    setState({
      phase: 'answer',
      text: response.answer,
      moreDetail: response.moreDetail,
      detailShown: false,
      allergenWarnings,
    });
  }

  async function explain() {
    // RF-29: pedir la explicación es una señal de que el paso cuesta, aunque no haya red.
    void profileService.recordEvent({
      type: 'explanationRequested',
      recipeId: recipe.id,
      stepNumber: step.number,
    });
    const id = begin();
    if (id === null) return;
    const request: ExplainRequest = {
      recipeId: recipe.id,
      stepNumber: step.number,
      skillLevel: profile.skillLevel,
      constraints,
    };
    const response = await assistantClient.explain(request);
    if (!finish(id, response.status)) return;
    if (response.status === 'unavailable') {
      showUnavailable(response.message);
      return;
    }
    output.announce({
      text: `${response.explanation} Sabrás que está listo cuando: ${response.readyCue}`,
      short: response.readyCue,
      kind: 'answer',
    });
    const allergenWarnings = response.allergenWarnings ?? [];
    announceAllergenNotice(allergenWarnings);
    setState({
      phase: 'explanation',
      text: response.explanation,
      readyCue: response.readyCue,
      // CA-10.2: la señal que generó el asistente se distingue de la de la receta.
      suggested: response.readyCueSource === 'assistant',
      allergenWarnings,
    });
  }

  function showDetail(current: Extract<PanelState, { phase: 'answer' }>) {
    if (!current.moreDetail) return;
    output.announce({ text: current.moreDetail, kind: 'answer' });
    setState({ ...current, detailShown: true });
  }

  function support(declared: Feeling) {
    const { message, offerPause } = FEELING_SUPPORT[declared];
    setFeeling(declared);
    declaredFeeling.current = declared === 'happy' ? null : declared;
    output.announce({
      text: offerPause && !paused ? `${message} ${PAUSE_OFFER}` : message,
      short: message,
      kind: 'info',
    });
  }

  // La voz, el gesto o el teclado piden lo mismo que los botones (RF-24).
  useCommands((event) => {
    if (event.command.type === 'ask') {
      // Se ve lo que entendió el reconocimiento, para saber si falló la voz o la pregunta.
      setQuestion(event.command.question);
      void ask(event.command.question);
    }
    if (event.command.type === 'explain') void explain();
    if (event.command.type === 'feeling') support(event.command.feeling);
    if (event.command.type === 'pause') setPaused(true);
    if (event.command.type === 'resume') setPaused(false);
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  const loading = state.phase === 'loading';
  const feelingSupport = feeling ? FEELING_SUPPORT[feeling] : null;

  return (
    <section aria-label="Asistente" className={styles.panel}>
      <form className={styles.askRow} onSubmit={submit}>
        <label className={styles.askField}>
          <span className="visually-hidden">Pregunta sobre este paso</span>
          <input
            className={styles.askInput}
            type="text"
            placeholder="Pregunta sobre este paso"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={!online || loading || !question.trim()}>
          Preguntar
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-label="Más: explícame este paso"
          disabled={!online || loading}
          onClick={() => void explain()}
        >
          Más
        </Button>
      </form>

      {!online && <p role="status">{OFFLINE_MESSAGE}</p>}
      {loading && <p role="status">Pensando…</p>}
      {state.phase === 'unavailable' && <p role="status">{state.message}</p>}

      {state.phase === 'answer' && (
        <div className={styles.answer}>
          <AllergenNotice warnings={state.allergenWarnings} />
          <p>{state.text}</p>
          {state.detailShown && <p>{state.moreDetail}</p>}
          {state.moreDetail && !state.detailShown && (
            <Button type="button" variant="ghost" onClick={() => showDetail(state)}>
              Más detalle
            </Button>
          )}
        </div>
      )}

      {feelingSupport && (
        <div className={styles.answer}>
          <p>{feelingSupport.message}</p>
          {feelingSupport.offerPause &&
            (paused ? (
              <p className={styles.note}>En pausa. Di «continuar» cuando quieras seguir.</p>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => commandBus.emit({ type: 'pause' }, 'touch')}
              >
                Pausar un momento
              </Button>
            ))}
        </div>
      )}

      {state.phase === 'explanation' && (
        <div className={styles.answer}>
          <AllergenNotice warnings={state.allergenWarnings} />
          <p>{state.text}</p>
          <p className={styles.readyCue}>✨ {state.readyCue}</p>
          {state.suggested && <p className={styles.note}>Sugerencia del asistente</p>}
        </div>
      )}
    </section>
  );
}
