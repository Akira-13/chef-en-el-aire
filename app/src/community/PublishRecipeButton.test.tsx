// Publicar la receta adaptada: vista previa, motivos ocultos por defecto y solo el alias (RF-34).

import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import {
  toRecipes,
  type NewCommunityPost,
  type RawRecipeBook,
  type RecipeChange,
} from '@chef/shared';
import { commandBus } from '../core/commandBus';
import { enterScreen } from '../core/commandContext';
import { profileService } from '../core/services';
import { createFakeCommunityServer, type FakeCommunityServer } from './fakeServer';
import { PublishRecipeButton } from './index';
import { clearCommunityData } from './storage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ocopa = toRecipes(rawRecipes as unknown as RawRecipeBook).find((r) => r.id === 'REC-008')!;
const changes: RecipeChange[] = [
  {
    kind: 'ingredient',
    target: 'ING-001',
    before: 'maní tostado',
    after: 'pecanas',
    reason: 'Diego tiene alergia severa al maní',
  },
];

let container: HTMLElement;
let root: Root;
let server: FakeCommunityServer;

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function render(recipeChanges = changes) {
  await act(async () =>
    root.render(<PublishRecipeButton recipe={ocopa} changes={recipeChanges} />),
  );
}

const button = (text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
const published = () =>
  server.requests.filter((r) => r.method === 'POST').map((r) => r.body as NewCommunityPost);

async function click(text: string) {
  await act(async () => button(text)!.click());
  await settle();
}

async function share() {
  await act(async () => {
    commandBus.emit({ type: 'share' }, 'voice');
  });
  await settle();
}

beforeEach(async () => {
  localStorage.clear();
  clearCommunityData();
  server = createFakeCommunityServer();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  await profileService.ready;
  await profileService.reset();
  await profileService.selectProfile('USR-002');
  enterScreen('recipe', { recipeId: 'REC-008' });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('PublishRecipeButton', () => {
  it('sin cambios no ofrece publicar', async () => {
    await render([]);
    expect(container.innerHTML).toBe('');
  });

  it('la vista previa oculta los motivos por defecto y avisa de la salud (CA-27.2)', async () => {
    await render();
    await click('Publicar en la Comunidad');
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(false);
    expect(container.textContent).toContain('maní tostado → pecanas');
    expect(container.textContent).not.toContain('alergia severa');
    expect(container.textContent).toContain('Revisa que el texto no mencione tu salud');
    expect(published()).toHaveLength(0);
  });

  it('publica sin motivos, sin el nombre real y con el alias guardado (CA-27.2, RNF-09)', async () => {
    await render();
    await click('Publicar en la Comunidad');
    const alias = container.querySelector<HTMLInputElement>('input:not([type])')!.value;
    await click('Publicar');

    const [body] = published();
    expect(body).toMatchObject({ kind: 'recipe', alias, recipeId: 'REC-008' });
    expect(body!.changes).toEqual([
      { kind: 'ingredient', before: 'maní tostado', after: 'pecanas' },
    ]);
    const json = JSON.stringify(body);
    expect(json).not.toContain('Diego');
    expect(json).not.toContain('alergia');
    expect(profileService.getProfile().community?.alias).toBe(alias);
    expect(container.textContent).toContain('Publicada en la Comunidad');
  });

  it('con "Mostrar motivos" los motivos viajan (RF-34)', async () => {
    await profileService.update((p) => ({ ...p, community: { alias: 'Dieguito' } }));
    await render();
    await click('Publicar en la Comunidad');
    await act(async () =>
      container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(),
    );
    expect(container.textContent).toContain('alergia severa');
    await click('Publicar');
    expect(published()[0]!.changes![0]).toHaveProperty('reason');
  });

  it('por voz: "publica mi receta" abre la vista previa y la segunda vez publica (CA-27.1)', async () => {
    await profileService.update((p) => ({ ...p, community: { alias: 'Dieguito' } }));
    await render();
    await share();
    expect(container.textContent).toContain('Así se verá en la Comunidad');
    expect(published()).toHaveLength(0);
    await share();
    expect(published()).toHaveLength(1);
    expect(published()[0]).toMatchObject({ alias: 'Dieguito', recipeName: 'Ocopa arequipeña' });
  });

  it('fuera de la pantalla Receta no responde a "publica" (CA-27.1)', async () => {
    enterScreen('celebration');
    await render();
    await share();
    expect(container.textContent).not.toContain('Así se verá en la Comunidad');
  });

  it('no acepta el nombre real como alias (RF-33)', async () => {
    await render();
    await click('Publicar en la Comunidad');
    const input = container.querySelector<HTMLInputElement>('input:not([type])')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        'Diego',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click('Publicar');
    expect(published()).toHaveLength(0);
    expect(container.textContent).toContain('Usa un alias, no tu nombre real.');
  });

  it('sin conexión queda pendiente (RF-37)', async () => {
    await profileService.update((p) => ({ ...p, community: { alias: 'Dieguito' } }));
    server.online = false;
    await render();
    await click('Publicar en la Comunidad');
    await click('Publicar');
    expect(container.textContent).toContain('Pendiente: se publicará al volver la conexión');
  });

  it('dos "publica" seguidos publican una sola vez (RF-34)', async () => {
    await profileService.update((p) => ({ ...p, community: { alias: 'Dieguito' } }));
    await render();
    await share();
    await act(async () => {
      commandBus.emit({ type: 'share' }, 'voice');
      commandBus.emit({ type: 'share' }, 'voice');
    });
    await settle();
    expect(published()).toHaveLength(1);
  });

  it('dos toques seguidos en Publicar publican una sola vez (RF-34)', async () => {
    await profileService.update((p) => ({ ...p, community: { alias: 'Dieguito' } }));
    await render();
    await click('Publicar en la Comunidad');
    await act(async () => {
      const publish = button('Publicar')!;
      publish.click();
      publish.click();
    });
    await settle();
    expect(published()).toHaveLength(1);
  });
});
