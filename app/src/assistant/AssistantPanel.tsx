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
  type Recipe,
  type Step,
} from '@chef/shared';
import { assistantClient } from '../core/assistantClient';
import { useCommands } from '../core/commandBus';
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
  | { phase: 'explanation'; text: string; readyCue: string; suggested: boolean };

// "maní", "maní y leche", "maní, leche y huevo".
const listFormat = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });

function allergenNotice(warnings: AllergenCategory[]): string {
  const names = listFormat.format(warnings.map((a) => ALLERGEN_LABELS[a]));
  return `Esta respuesta menciona ${names}. Recuerda tus alergias y restricciones.`;
}

export function AssistantPanel({ recipe, step }: AssistantPanelProps) {
  const profile = useProfile();
  const online = useOnlineStatus();
  const [question, setQuestion] = useState('');
  const [state, setState] = useState<PanelState>({ phase: 'idle' });
  // Descarta la respuesta que llega tarde, por ejemplo tras cambiar de paso.
  const requestId = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    requestId.current += 1;
    busy.current = false;
    setState({ phase: 'idle' });
    setQuestion('');
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
    // RF-07: la respuesta nombra un alérgeno vigilado; se avisa sin ocultarla ni reescribirla.
    const allergenWarnings = response.allergenWarnings ?? [];
    if (allergenWarnings.length > 0) {
      const notice = allergenNotice(allergenWarnings);
      output.announce({ text: notice, short: notice, kind: 'alert' });
    }
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
    setState({
      phase: 'explanation',
      text: response.explanation,
      readyCue: response.readyCue,
      // CA-10.2: la señal que generó el asistente se distingue de la de la receta.
      suggested: response.readyCueSource === 'assistant',
    });
  }

  function showDetail(current: Extract<PanelState, { phase: 'answer' }>) {
    if (!current.moreDetail) return;
    output.announce({ text: current.moreDetail, kind: 'answer' });
    setState({ ...current, detailShown: true });
  }

  // La voz, el gesto o el teclado piden lo mismo que los botones (RF-24).
  useCommands((event) => {
    if (event.command.type === 'ask') void ask(event.command.question);
    if (event.command.type === 'explain') void explain();
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  const loading = state.phase === 'loading';

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
          {state.allergenWarnings.length > 0 && (
            <p role="alert" className={styles.allergenNotice}>
              {allergenNotice(state.allergenWarnings)}
            </p>
          )}
          <p>{state.text}</p>
          {state.detailShown && <p>{state.moreDetail}</p>}
          {state.moreDetail && !state.detailShown && (
            <Button type="button" variant="ghost" onClick={() => showDetail(state)}>
              Más detalle
            </Button>
          )}
        </div>
      )}

      {state.phase === 'explanation' && (
        <div className={styles.answer}>
          <p>{state.text}</p>
          <p className={styles.readyCue}>✨ {state.readyCue}</p>
          {state.suggested && <p className={styles.note}>Sugerencia del asistente</p>}
        </div>
      )}
    </section>
  );
}
