import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import { toProfile, toRecipes, type RawProfileBook, type RawRecipeBook } from '@chef/shared';
import { commandBus } from '../core/commandBus';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const ocopa = recipes.find((r) => r.id === 'REC-008')!;
const diego = (rawProfiles as unknown as RawProfileBook).perfiles
  .map(toProfile)
  .find((p) => p.name === 'Diego')!;

const mocks = vi.hoisted(() => ({
  announce: vi.fn(),
  cue: vi.fn(),
  recordEvent: vi.fn(),
  setAdaptedRecipe: vi.fn(),
}));

vi.mock('../core/services', () => ({
  output: { announce: mocks.announce, cue: mocks.cue },
  profileService: { recordEvent: mocks.recordEvent },
  useProfile: () => diego,
}));
vi.mock('../core/recipes', () => ({ setAdaptedRecipe: mocks.setAdaptedRecipe }));

import { CONFIRM_TIMEOUT_MS, useVoiceSubstitution } from './useVoiceSubstitution';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Host({ askAssistant = false }: { askAssistant?: boolean }) {
  useVoiceSubstitution(ocopa, askAssistant);
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

const mount = (askAssistant = false) =>
  act(async () => root.render(<Host askAssistant={askAssistant} />));
const say = (command: Parameters<typeof commandBus.emit>[0]) =>
  act(async () => void commandBus.emit(command, 'voice'));
const lastAnnouncement = () => mocks.announce.mock.calls.at(-1)?.[0]?.text as string;

describe('sustituir por voz: confirmación', () => {
  it('pide confirmar antes de cambiar la receta', async () => {
    await mount();
    await say({ type: 'substitute', ingredient: 'maní' });
    expect(lastAnnouncement()).toContain('semillas de girasol tostadas');
    expect(lastAnnouncement()).toContain('confirmo');
    expect(mocks.setAdaptedRecipe).not.toHaveBeenCalled();
  });

  it('con «confirmo» aplica el cambio y lo registra para el perfil', async () => {
    await mount();
    await say({ type: 'substitute', ingredient: 'maní' });
    await say({ type: 'confirm' });
    expect(mocks.setAdaptedRecipe).toHaveBeenCalledOnce();
    const adapted = mocks.setAdaptedRecipe.mock.calls[0]![0];
    expect(adapted.ingredients.map((i: { name: string }) => i.name)).toContain(
      'semillas de girasol tostadas',
    );
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'substitutionAccepted', original: 'maní tostado' }),
    );
  });

  it('con «cancelar» no cambia nada y lo registra como rechazo', async () => {
    await mount();
    await say({ type: 'substitute', ingredient: 'maní' });
    await say({ type: 'cancel' });
    expect(mocks.setAdaptedRecipe).not.toHaveBeenCalled();
    expect(mocks.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'substitutionRejected' }),
    );
    await say({ type: 'confirm' });
    expect(mocks.setAdaptedRecipe).not.toHaveBeenCalled();
  });

  it('si no se confirma a tiempo, la propuesta caduca', async () => {
    await mount();
    await say({ type: 'substitute', ingredient: 'maní' });
    await act(async () => void vi.advanceTimersByTime(CONFIRM_TIMEOUT_MS + 1));
    await say({ type: 'confirm' });
    expect(mocks.setAdaptedRecipe).not.toHaveBeenCalled();
  });

  it('«confirmo» sin propuesta pendiente no hace nada', async () => {
    await mount();
    await say({ type: 'confirm' });
    expect(mocks.setAdaptedRecipe).not.toHaveBeenCalled();
    expect(mocks.announce).not.toHaveBeenCalled();
  });
});

describe('sustituir por voz: sin propuesta', () => {
  it('avisa con sonido de error si el ingrediente no está en la receta', async () => {
    await mount();
    await say({ type: 'substitute', ingredient: 'trufa' });
    expect(mocks.cue).toHaveBeenCalledWith('error');
    expect(lastAnnouncement()).toContain('trufa');
  });

  it('en la receta sin asistente sugiere «Adaptar con IA» si no hay sustituto', async () => {
    await mount(false);
    await say({ type: 'substitute', ingredient: 'papa amarilla' });
    expect(lastAnnouncement()).toContain('Adaptar con IA');
  });

  it('en modo cocina pregunta al asistente si el recetario no tiene sustituto', async () => {
    await mount(true);
    const asked: unknown[] = [];
    const stop = commandBus.subscribe((event) => asked.push(event.command));
    await say({ type: 'substitute', ingredient: 'papa amarilla' });
    stop();
    expect(asked).toContainEqual({
      type: 'ask',
      question: '¿Con qué puedo sustituir papa amarilla?',
    });
  });
});
