import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ASSISTANT_UNAVAILABLE_MESSAGE,
  toRecipes,
  type AdaptResponse,
  type AllergenFinding,
  type RawRecipeBook,
  type Recipe,
} from '@chef/shared';
import rawRecipes from '../../../datos/recetas.json';
import { commandBus } from '../core/commandBus';

const mocks = vi.hoisted(() => ({
  adapt: vi.fn(),
  announce: vi.fn(),
  setAdaptedRecipe: vi.fn(),
  clearAdaptedRecipe: vi.fn(),
}));

vi.mock('../core/assistantClient', () => ({ assistantClient: { adapt: mocks.adapt } }));
vi.mock('../core/services', () => ({
  output: { announce: mocks.announce },
  useProfile: () => ({
    skillLevel: 'novato',
    pantry: [],
    explicit: { allergies: ['mani'], dinerRestrictions: [], diet: 'omnivora' },
  }),
}));
vi.mock('../core/recipes', () => ({
  setAdaptedRecipe: mocks.setAdaptedRecipe,
  clearAdaptedRecipe: mocks.clearAdaptedRecipe,
  useRecipe: () => ({ isAdapted: false }),
}));

import { AdaptationPanel } from './AdaptationPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const original = toRecipes(rawRecipes as unknown as RawRecipeBook).find((r) => r.id === 'REC-008')!;
const adapted: Recipe = { ...original, name: 'Ocopa sin maní' };

const finding: AllergenFinding = {
  ingredientId: 'ING-050',
  ingredientName: 'pasta de maní',
  allergen: 'mani',
  source: 'profile',
};

const changes = [
  {
    kind: 'ingredient' as const,
    target: 'ING-053',
    before: 'leche evaporada',
    after: 'caldo + maicena',
    reason: 'intolerancia a la lactosa',
  },
];

const okResponse: AdaptResponse = {
  status: 'ok',
  original,
  adapted,
  changes,
  provider: 'remoto',
  latencyMs: 900,
};
const blockedResponse: AdaptResponse = { ...okResponse, status: 'blocked', findings: [finding] };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
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

async function render() {
  await act(async () => root.render(<AdaptationPanel recipe={original} />));
}

async function request(response: AdaptResponse) {
  mocks.adapt.mockResolvedValueOnce(response);
  await render();
  await act(async () => button('Adaptar con IA')!.click());
}

describe('AdaptationPanel', () => {
  it('muestra "Pensando…" de inmediato al pedir la adaptación (RNF-03)', async () => {
    let resolve!: (response: AdaptResponse) => void;
    mocks.adapt.mockReturnValueOnce(new Promise<AdaptResponse>((r) => (resolve = r)));
    await render();
    await act(async () => button('Adaptar con IA')!.click());
    expect(container.textContent).toContain('Pensando…');
    expect(button('Adaptar con IA')!.disabled).toBe(true);
    await act(async () => resolve(okResponse));
    expect(container.textContent).not.toContain('Pensando…');
  });

  it('envía el perfil actual al pedir la adaptación (RF-05)', async () => {
    await request(okResponse);
    expect(mocks.adapt).toHaveBeenCalledWith({
      recipeId: 'REC-008',
      constraints: { allergies: ['mani'], dinerRestrictions: [], diet: 'omnivora' },
      pantry: [],
      skillLevel: 'novato',
    });
  });

  it('lista cada cambio con el antes, el después y el motivo (CA-05.1)', async () => {
    await request(okResponse);
    const text = container.textContent ?? '';
    expect(text).toContain('leche evaporada');
    expect(text).toContain('caldo + maicena');
    expect(text).toContain('intolerancia a la lactosa');
  });

  it('"Usar adaptada" aplica la versión adaptada (CA-05.2)', async () => {
    await request(okResponse);
    await act(async () => button('Usar adaptada')!.click());
    expect(mocks.setAdaptedRecipe).toHaveBeenCalledWith(adapted);
  });

  it('"Usar original" descarta la adaptación y deja la receta original (CA-05.2)', async () => {
    await request(okResponse);
    await act(async () => button('Usar original')!.click());
    expect(mocks.clearAdaptedRecipe).toHaveBeenCalledWith('REC-008');
    expect(mocks.setAdaptedRecipe).not.toHaveBeenCalled();
  });

  it('si el asistente no está disponible, avisa y no toca la receta (RF-10)', async () => {
    await request({ status: 'unavailable', message: ASSISTANT_UNAVAILABLE_MESSAGE });
    expect(container.textContent).toContain(ASSISTANT_UNAVAILABLE_MESSAGE);
    expect(button('Usar adaptada')).toBeUndefined();
    expect(mocks.setAdaptedRecipe).not.toHaveBeenCalled();
    expect(mocks.clearAdaptedRecipe).not.toHaveBeenCalled();
    // La receta original sigue usable: se puede volver a pedir.
    expect(button('Adaptar con IA')!.disabled).toBe(false);
  });
});

describe('AdaptationPanel bloqueada por alérgeno', () => {
  it('advierte el ingrediente y el alérgeno, y lo anuncia (CA-06.2)', async () => {
    await request(blockedResponse);
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('maní');
    expect(alert?.textContent).toContain('pasta de maní');
    expect(mocks.announce).toHaveBeenCalledWith(expect.objectContaining({ kind: 'alert' }));
  });

  it('no ofrece "Usar adaptada" sin confirmación explícita (CA-06.2)', async () => {
    await request(blockedResponse);
    expect(button('Usar adaptada')).toBeUndefined();
    expect(button('Confirmo, usar igual')).toBeDefined();
  });

  it('el botón "Confirmo, usar igual" aplica la receta (CA-06.2)', async () => {
    await request(blockedResponse);
    await act(async () => button('Confirmo, usar igual')!.click());
    expect(mocks.setAdaptedRecipe).toHaveBeenCalledWith(adapted);
  });

  it('un "confirmo" por voz aplica la receta (CA-06.2)', async () => {
    await request(blockedResponse);
    await act(async () => void commandBus.emit({ type: 'confirm' }, 'voice'));
    expect(mocks.setAdaptedRecipe).toHaveBeenCalledWith(adapted);
  });

  it('un "confirmar" por gesto, toque o teclado NO aplica la receta (CA-06.2)', async () => {
    await request(blockedResponse);
    await act(async () => {
      commandBus.emit({ type: 'confirm' }, 'gesture');
      commandBus.emit({ type: 'confirm' }, 'touch');
      commandBus.emit({ type: 'confirm' }, 'keyboard');
    });
    expect(mocks.setAdaptedRecipe).not.toHaveBeenCalled();
  });

  it('otros comandos por voz no confirman (CA-06.2)', async () => {
    await request(blockedResponse);
    await act(async () => void commandBus.emit({ type: 'next' }, 'voice'));
    expect(mocks.setAdaptedRecipe).not.toHaveBeenCalled();
  });

  it('un "confirmo" por voz sin advertencia pendiente no hace nada (CA-06.2)', async () => {
    await request(okResponse);
    await act(async () => void commandBus.emit({ type: 'confirm' }, 'voice'));
    expect(mocks.setAdaptedRecipe).not.toHaveBeenCalled();
  });

  it('"Usar original" sigue disponible y descarta la adaptación (CA-05.2)', async () => {
    await request(blockedResponse);
    await act(async () => button('Usar original')!.click());
    expect(mocks.clearAdaptedRecipe).toHaveBeenCalledWith('REC-008');
    expect(mocks.setAdaptedRecipe).not.toHaveBeenCalled();
  });
});
