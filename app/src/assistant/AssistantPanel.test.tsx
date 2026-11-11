import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ASSISTANT_UNAVAILABLE_MESSAGE,
  toRecipes,
  type Recipe,
  type Step,
  type AskResponse,
  type ExplainResponse,
  type RawRecipeBook,
} from '@chef/shared';
import rawRecipes from '../../../datos/recetas.json';
import { commandBus } from '../core/commandBus';

const mocks = vi.hoisted(() => ({
  ask: vi.fn(),
  explain: vi.fn(),
  announce: vi.fn(),
  recordEvent: vi.fn(),
  metricsStart: vi.fn(),
  metricsEnd: vi.fn(),
  online: true,
}));

vi.mock('../core/assistantClient', () => ({
  assistantClient: { ask: mocks.ask, explain: mocks.explain },
}));
vi.mock('../core/services', () => ({
  output: { announce: mocks.announce },
  profileService: { recordEvent: mocks.recordEvent },
  useProfile: () => ({
    skillLevel: 'novato',
    explicit: { allergies: ['mani'], dinerRestrictions: [], diet: 'omnivora' },
    emotional: { assistantTone: 'calmado' },
  }),
}));
vi.mock('../core/metrics', () => ({
  metrics: { start: mocks.metricsStart, end: mocks.metricsEnd },
}));
vi.mock('./useOnlineStatus', () => ({ useOnlineStatus: () => mocks.online }));

import { AssistantPanel } from './AssistantPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const recipe = toRecipes(rawRecipes as unknown as RawRecipeBook).find((r) => r.id === 'REC-008')!;
const step = recipe.steps[3]!;
const shownStep = {
  servings: recipe.servings,
  text: step.text,
  ...(step.warning && { warning: step.warning }),
  ...(step.readyCue && { readyCue: step.readyCue }),
};
const anything = expect.anything();
const OFFLINE_MESSAGE = 'Sin conexión: el asistente no está disponible';

const answer: AskResponse = {
  status: 'ok',
  answer: 'Unos 15 minutos.',
  moreDetail: 'Hasta que se pinchen con un tenedor.',
  provider: 'remoto',
  latencyMs: 700,
};
const explanation: ExplainResponse = {
  status: 'ok',
  explanation: 'Corta las papas en rodajas.',
  readyCue: 'Las papas se ven cremosas.',
  readyCueSource: 'assistant',
  provider: 'remoto',
  latencyMs: 800,
};
const unavailable = { status: 'unavailable', message: ASSISTANT_UNAVAILABLE_MESSAGE } as const;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.online = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const button = (label: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(label));

async function render(shown: Step = step, shownRecipe: Recipe = recipe) {
  await act(async () => root.render(<AssistantPanel recipe={shownRecipe} step={shown} />));
}

async function type(text: string) {
  const input = container.querySelector('input')!;
  await act(async () => {
    // Un campo controlado de React solo ve el valor si se asigna con el setter nativo.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function askQuestion(text = '¿Cuánto hiervo las papas?') {
  await render();
  await type(text);
  await act(async () => button('Preguntar')!.click());
}

describe('AssistantPanel: preguntar', () => {
  it('envía la pregunta con el paso, el nivel, el tono y las restricciones (CA-07.1, RF-41)', async () => {
    mocks.ask.mockResolvedValueOnce(answer);
    await askQuestion();
    expect(mocks.ask).toHaveBeenCalledWith({
      recipeId: 'REC-008',
      stepNumber: step.number,
      question: '¿Cuánto hiervo las papas?',
      skillLevel: 'novato',
      tone: 'calmado',
      constraints: { allergies: ['mani'], dinerRestrictions: [], diet: 'omnivora' },
      stepView: shownStep,
    });
  });

  it('muestra "Pensando…" de inmediato y lo avisa por ARIA (RNF-03, CA-07.2)', async () => {
    let resolve!: (response: AskResponse) => void;
    mocks.ask.mockReturnValueOnce(new Promise<AskResponse>((r) => (resolve = r)));
    await askQuestion();
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Pensando…');
    expect(mocks.announce).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Pensando…', kind: 'info' }),
    );
    await act(async () => resolve(answer));
    expect(container.textContent).not.toContain('Pensando…');
  });

  it('mide llm.thinking al pintar "Pensando…" y llm.response al llegar la respuesta (RNF-03)', async () => {
    let resolve!: (response: AskResponse) => void;
    mocks.ask.mockReturnValueOnce(new Promise<AskResponse>((r) => (resolve = r)));
    await askQuestion();
    expect(mocks.metricsStart).toHaveBeenCalledWith('llm.thinking', expect.any(String));
    expect(mocks.metricsStart).toHaveBeenCalledWith('llm.response', expect.any(String));
    expect(mocks.metricsEnd).toHaveBeenCalledWith('llm.thinking', expect.any(String));
    expect(mocks.metricsEnd).not.toHaveBeenCalledWith('llm.response', expect.any(String), anything);
    await act(async () => resolve(answer));
    expect(mocks.metricsEnd).toHaveBeenCalledWith('llm.response', expect.any(String), anything);
  });

  it('muestra la respuesta escrita y la anuncia como respuesta (CA-07.3)', async () => {
    mocks.ask.mockResolvedValueOnce(answer);
    await askQuestion();
    expect(container.textContent).toContain('Unos 15 minutos.');
    expect(mocks.announce).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Unos 15 minutos.', kind: 'answer' }),
    );
  });

  it('avisa y anuncia como alerta si la respuesta menciona un alérgeno (RF-07, RNF-06)', async () => {
    mocks.ask.mockResolvedValueOnce({ ...answer, allergenWarnings: ['mani'] });
    await askQuestion();
    const notice = container.querySelector('[role="alert"]');
    expect(notice?.textContent).toContain('Esta respuesta menciona maní.');
    expect(container.textContent).toContain('Unos 15 minutos.');
    expect(mocks.announce).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Esta respuesta menciona maní.'),
        kind: 'alert',
      }),
    );
  });

  it('une varios alérgenos de forma natural en el aviso (RF-07, RNF-06)', async () => {
    mocks.ask.mockResolvedValueOnce({ ...answer, allergenWarnings: ['mani', 'leche', 'huevo'] });
    await askQuestion();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Esta respuesta menciona maní, leche y huevo.',
    );
  });

  it('no muestra ni anuncia aviso si la respuesta no trae alérgenos (RF-07)', async () => {
    mocks.ask.mockResolvedValueOnce(answer);
    await askQuestion();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(mocks.announce).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'alert' }));
  });

  it('revela el detalle solo al pulsar "Más detalle" (CA-07.1)', async () => {
    mocks.ask.mockResolvedValueOnce(answer);
    await askQuestion();
    expect(container.textContent).not.toContain('Hasta que se pinchen');
    await act(async () => button('Más detalle')!.click());
    expect(container.textContent).toContain('Hasta que se pinchen con un tenedor.');
    expect(mocks.announce).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Hasta que se pinchen con un tenedor.', kind: 'answer' }),
    );
    expect(button('Más detalle')).toBeUndefined();
  });

  it('no ofrece "Más detalle" si el asistente no lo envió (CA-07.1)', async () => {
    mocks.ask.mockResolvedValueOnce({ ...answer, moreDetail: undefined });
    await askQuestion();
    expect(button('Más detalle')).toBeUndefined();
  });

  it('responde al comando ask de cualquier canal, p. ej. la voz (RF-08, RF-24)', async () => {
    mocks.ask.mockResolvedValueOnce(answer);
    await render();
    await act(async () => {
      commandBus.emit({ type: 'ask', question: '¿Cuánto hiervo?' }, 'voice');
    });
    expect(mocks.ask).toHaveBeenCalledWith(
      expect.objectContaining({ question: '¿Cuánto hiervo?', stepNumber: step.number }),
    );
    expect(container.textContent).toContain('Unos 15 minutos.');
  });

  it('no pide nada con la pregunta vacía', async () => {
    await render();
    await type('   ');
    expect(button('Preguntar')!.disabled).toBe(true);
    await act(async () => {
      commandBus.emit({ type: 'ask', question: ' ' }, 'voice');
    });
    expect(mocks.ask).not.toHaveBeenCalled();
  });

  it('con el asistente no disponible avisa y la receta sigue usable (RF-10, CA-08.3)', async () => {
    mocks.ask.mockResolvedValueOnce(unavailable);
    await askQuestion();
    expect(container.textContent).toContain(ASSISTANT_UNAVAILABLE_MESSAGE);
    expect(mocks.announce).toHaveBeenCalledWith(
      expect.objectContaining({ text: ASSISTANT_UNAVAILABLE_MESSAGE }),
    );
    expect(container.textContent).not.toContain('Pensando…');
    expect(button('Preguntar')).toBeDefined();
  });
});

describe('AssistantPanel: receta adaptada', () => {
  // Con una sustitución, el paso y las porciones que ve el usuario ya no son los de los datos.
  const adaptedStep: Step = {
    ...step,
    text: 'Licúa las semillas de girasol.',
    readyCue: undefined,
  };
  const adaptedRecipe: Recipe = { ...recipe, servings: 2 };
  const adaptedView = { servings: 2, text: adaptedStep.text };

  it('"Más" explica el paso adaptado, no el original', async () => {
    mocks.explain.mockResolvedValueOnce(explanation);
    await render(adaptedStep, adaptedRecipe);
    await act(async () => button('Más')!.click());
    expect(mocks.explain).toHaveBeenCalledWith(expect.objectContaining({ stepView: adaptedView }));
  });

  it('la pregunta también viaja con el paso adaptado', async () => {
    mocks.ask.mockResolvedValueOnce(answer);
    await render(adaptedStep, adaptedRecipe);
    await type('¿Cuánto licúo?');
    await act(async () => button('Preguntar')!.click());
    expect(mocks.ask).toHaveBeenCalledWith(expect.objectContaining({ stepView: adaptedView }));
  });
});

describe('AssistantPanel: explicar el paso', () => {
  it('"Más" pide la explicación y registra el evento de aprendizaje (CA-10.1, RF-29)', async () => {
    mocks.explain.mockResolvedValueOnce(explanation);
    await render();
    await act(async () => button('Más')!.click());
    expect(mocks.explain).toHaveBeenCalledWith({
      recipeId: 'REC-008',
      stepNumber: step.number,
      skillLevel: 'novato',
      constraints: { allergies: ['mani'], dinerRestrictions: [], diet: 'omnivora' },
      stepView: shownStep,
    });
    expect(mocks.recordEvent).toHaveBeenCalledWith({
      type: 'explanationRequested',
      recipeId: 'REC-008',
      stepNumber: step.number,
    });
    expect(container.textContent).toContain('Corta las papas en rodajas.');
  });

  it('marca como "sugerencia del asistente" la señal que no venía en los datos (CA-10.2)', async () => {
    mocks.explain.mockResolvedValueOnce(explanation);
    await render();
    await act(async () => button('Más')!.click());
    expect(container.textContent).toContain('Las papas se ven cremosas.');
    expect(container.textContent).toContain('Sugerencia del asistente');
  });

  it('no marca como sugerencia la señal que viene de la receta (CA-10.1)', async () => {
    mocks.explain.mockResolvedValueOnce({ ...explanation, readyCueSource: 'recipe' });
    await render();
    await act(async () => button('Más')!.click());
    expect(container.textContent).toContain('Las papas se ven cremosas.');
    expect(container.textContent).not.toContain('Sugerencia del asistente');
  });

  it('anuncia la explicación y la señal como respuesta (CA-10.1)', async () => {
    mocks.explain.mockResolvedValueOnce(explanation);
    await render();
    await act(async () => button('Más')!.click());
    expect(mocks.announce).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Las papas se ven cremosas.'),
        kind: 'answer',
      }),
    );
  });

  it('avisa y anuncia como alerta si la explicación menciona un alérgeno (RF-07, RNF-06)', async () => {
    mocks.explain.mockResolvedValueOnce({ ...explanation, allergenWarnings: ['mani'] });
    await render();
    await act(async () => button('Más')!.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Esta respuesta menciona maní.',
    );
    expect(container.textContent).toContain('Corta las papas en rodajas.');
    expect(mocks.announce).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Esta respuesta menciona maní.'),
        kind: 'alert',
      }),
    );
  });

  it('no muestra ni anuncia aviso si la explicación no trae alérgenos (RF-07)', async () => {
    mocks.explain.mockResolvedValueOnce(explanation);
    await render();
    await act(async () => button('Más')!.click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(mocks.announce).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'alert' }));
  });

  it('responde al comando explain y muestra "Pensando…" (RF-13, RNF-03)', async () => {
    let resolve!: (response: ExplainResponse) => void;
    mocks.explain.mockReturnValueOnce(new Promise<ExplainResponse>((r) => (resolve = r)));
    await render();
    await act(async () => {
      commandBus.emit({ type: 'explain' }, 'voice');
    });
    expect(container.textContent).toContain('Pensando…');
    expect(mocks.recordEvent).toHaveBeenCalledTimes(1);
    await act(async () => resolve(explanation));
    expect(container.textContent).toContain('Corta las papas en rodajas.');
  });

  it('con el asistente no disponible avisa y no rompe el paso (RF-10)', async () => {
    mocks.explain.mockResolvedValueOnce(unavailable);
    await render();
    await act(async () => button('Más')!.click());
    expect(container.textContent).toContain(ASSISTANT_UNAVAILABLE_MESSAGE);
  });
});

describe('AssistantPanel: sin conexión', () => {
  beforeEach(() => {
    mocks.online = false;
  });

  it('muestra el aviso y deshabilita los botones sin llamar al servidor (CA-35.2)', async () => {
    await render();
    await type('¿Cuánto hiervo las papas?');
    expect(container.textContent).toContain(OFFLINE_MESSAGE);
    expect(button('Preguntar')!.disabled).toBe(true);
    expect(button('Más')!.disabled).toBe(true);
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(mocks.explain).not.toHaveBeenCalled();
  });

  it('un comando de voz sin red avisa por salida y no llama al servidor (CA-35.2)', async () => {
    await render();
    await act(async () => {
      commandBus.emit({ type: 'ask', question: '¿Cuánto hiervo?' }, 'voice');
      commandBus.emit({ type: 'explain' }, 'voice');
    });
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(mocks.explain).not.toHaveBeenCalled();
    expect(mocks.announce).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining(OFFLINE_MESSAGE) }),
    );
  });
});

describe('AssistantPanel: retroalimentación afectiva', () => {
  const feel = (feeling: 'nervous' | 'tired' | 'confused' | 'happy', channel = 'voice' as const) =>
    act(async () => {
      commandBus.emit({ type: 'feeling', feeling }, channel);
    });

  it('ante el comando feeling responde con apoyo, lo anuncia y ofrece pausar (CA-33.2)', async () => {
    await render();
    await feel('nervous');
    expect(container.textContent).toContain('Tranquilo');
    expect(button('Pausar un momento')).toBeDefined();
    expect(mocks.announce).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(/Tranquilo.*pausa/s),
        short: expect.stringContaining('Tranquilo'),
        kind: 'info',
      }),
    );
    // Es un texto fijo: no gasta una llamada al asistente.
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(mocks.explain).not.toHaveBeenCalled();
  });

  it('responde igual sin conexión porque no depende del asistente (CA-33.2, CA-35.2)', async () => {
    mocks.online = false;
    await render();
    await feel('tired');
    expect(container.textContent).toContain('respiro');
    expect(button('Pausar un momento')).toBeDefined();
  });

  it('ofrece pausar a quien está confundido, cansado o nervioso, pero no a quien está contento (CA-33.2)', async () => {
    await render();
    await feel('happy');
    expect(container.textContent).toContain('Qué bien');
    expect(button('Pausar un momento')).toBeUndefined();
    await feel('confused');
    expect(button('Pausar un momento')).toBeDefined();
  });

  it('"Pausar un momento" emite el comando pause por toque y deja de ofrecerlo (RF-12, CA-33.2)', async () => {
    const seen: Array<{ type: string; channel: string }> = [];
    const stop = commandBus.subscribe(({ command, channel }) =>
      seen.push({ type: command.type, channel }),
    );
    await render();
    await feel('nervous');
    await act(async () => button('Pausar un momento')!.click());
    stop();
    expect(seen).toContainEqual({ type: 'pause', channel: 'touch' });
    expect(button('Pausar un momento')).toBeUndefined();
    expect(container.textContent).toContain('En pausa');
  });

  it('si ya pausó por otro canal no ofrece pausar, y al continuar vuelve a ofrecerlo (RF-24)', async () => {
    await render();
    await act(async () => {
      commandBus.emit({ type: 'pause' }, 'voice');
    });
    await feel('tired');
    expect(button('Pausar un momento')).toBeUndefined();
    await act(async () => {
      commandBus.emit({ type: 'resume' }, 'gesture');
    });
    expect(button('Pausar un momento')).toBeDefined();
  });

  it('el mensaje no sigue en pantalla al cambiar de paso', async () => {
    await render();
    await feel('nervous');
    await act(async () => root.render(<AssistantPanel recipe={recipe} step={recipe.steps[4]!} />));
    expect(container.textContent).not.toContain('Tranquilo');
  });

  it('no pisa la respuesta del asistente que ya se estaba mostrando (CA-33.2)', async () => {
    mocks.ask.mockResolvedValueOnce(answer);
    await askQuestion();
    await feel('nervous');
    expect(container.textContent).toContain('Unos 15 minutos.');
    expect(container.textContent).toContain('Tranquilo');
  });
});

describe('AssistantPanel: el ánimo declarado llega al asistente', () => {
  const feel = (feeling: 'nervous' | 'tired' | 'confused' | 'happy') =>
    act(async () => {
      commandBus.emit({ type: 'feeling', feeling }, 'voice');
    });
  const lastRequest = () => mocks.ask.mock.calls.at(-1)![0] as Record<string, unknown>;

  async function ask(text = '¿Cuánto hiervo las papas?') {
    await type(text);
    await act(async () => button('Preguntar')!.click());
  }

  it('tras declarar un ánimo, la siguiente pregunta lo lleva (RF-41, CA-33.1)', async () => {
    mocks.ask.mockResolvedValue(answer);
    await render();
    await feel('nervous');
    await ask();
    expect(lastRequest()).toMatchObject({
      feeling: 'nervous',
      question: '¿Cuánto hiervo las papas?',
    });
  });

  it('sin ánimo declarado la pregunta no trae feeling (RF-41)', async () => {
    mocks.ask.mockResolvedValue(answer);
    await render();
    await ask();
    expect('feeling' in lastRequest()).toBe(false);
  });

  it('el último ánimo declarado es el que se envía (RF-41)', async () => {
    mocks.ask.mockResolvedValue(answer);
    await render();
    await feel('nervous');
    await feel('tired');
    await ask();
    expect(lastRequest().feeling).toBe('tired');
  });

  it('el ánimo sigue vigente al pasar al siguiente paso de la misma receta (CA-33.1)', async () => {
    mocks.ask.mockResolvedValue(answer);
    await render();
    await feel('confused');
    await act(async () => root.render(<AssistantPanel recipe={recipe} step={recipe.steps[4]!} />));
    await ask();
    expect(lastRequest()).toMatchObject({
      feeling: 'confused',
      stepNumber: recipe.steps[4]!.number,
    });
  });

  it('declarar que está contento lo quita: ya no hay nada que ajustar (RF-41)', async () => {
    mocks.ask.mockResolvedValue(answer);
    await render();
    await feel('nervous');
    await feel('happy');
    await ask();
    expect('feeling' in lastRequest()).toBe(false);
  });

  it('al cambiar de receta el ánimo se olvida (RF-41)', async () => {
    mocks.ask.mockResolvedValue(answer);
    const other = toRecipes(rawRecipes as unknown as RawRecipeBook).find(
      (r) => r.id === 'REC-001',
    )!;
    await render();
    await feel('nervous');
    await act(async () => root.render(<AssistantPanel recipe={other} step={other.steps[0]!} />));
    await ask();
    expect('feeling' in lastRequest()).toBe(false);
  });
});
