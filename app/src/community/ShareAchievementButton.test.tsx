// Compartir el logro desde la celebración: plato, valoración y alias, sin datos de salud (RF-37).

import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewCommunityPost } from '@chef/shared';
import { commandBus } from '../core/commandBus';
import { enterScreen } from '../core/commandContext';
import { profileService } from '../core/services';
import { createFakeCommunityServer, type FakeCommunityServer } from './fakeServer';
import { ShareAchievementButton } from './index';
import { clearCommunityData } from './storage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let server: FakeCommunityServer;

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function render() {
  await act(async () =>
    root.render(
      <ShareAchievementButton recipeId="REC-001" recipeName="Ají de gallina" rating="up" />,
    ),
  );
}

const button = (text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
const published = () =>
  server.requests.filter((r) => r.method === 'POST').map((r) => r.body as NewCommunityPost);

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
  await profileService.selectProfile('USR-001');
  enterScreen('celebration', { recipeId: 'REC-001' });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('ShareAchievementButton', () => {
  it('"comparte mi logro" publica plato, valoración y alias, sin salud (CA-29.1)', async () => {
    await profileService.update((p) => ({ ...p, community: { alias: 'Rosita' } }));
    await render();
    await share();
    const [body] = published();
    expect(body).toMatchObject({
      kind: 'achievement',
      alias: 'Rosita',
      recipeId: 'REC-001',
      recipeName: 'Ají de gallina',
      rating: 'up',
    });
    expect(Object.keys(body!).sort()).toEqual(
      ['alias', 'clientId', 'deviceKey', 'kind', 'rating', 'recipeId', 'recipeName'].sort(),
    );
    expect(JSON.stringify(body)).not.toContain('Rosa"');
    expect(container.textContent).toContain('Compartido en la Comunidad');
  });

  it('sin alias muestra el sugerido antes de compartir y lo guarda (CA-29.1, RF-33)', async () => {
    await render();
    await act(async () => button('Compartir mi logro')!.click());
    expect(published()).toHaveLength(0);
    const alias = container.querySelector<HTMLInputElement>('input')!.value;
    expect(alias).toMatch(/^Sazón \d{4}$/);
    await act(async () => button('Compartir')!.click());
    await settle();
    expect(published()[0]).toMatchObject({ alias });
    expect(profileService.getProfile().community?.alias).toBe(alias);
  });

  it('sin conexión queda en cola y se envía al volver la red (RF-37, CA-28.3)', async () => {
    await profileService.update((p) => ({ ...p, community: { alias: 'Rosita' } }));
    server.online = false;
    await render();
    await act(async () => button('Compartir mi logro')!.click());
    await settle();
    expect(container.textContent).toContain('Pendiente: se compartirá al volver la conexión');

    server.online = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    expect(published()).toHaveLength(1);
    expect(server.posts).toHaveLength(1);
  });

  it('fuera de la celebración no responde a "comparte" (CA-29.1)', async () => {
    await profileService.update((p) => ({ ...p, community: { alias: 'Rosita' } }));
    enterScreen('recipe');
    await render();
    await share();
    expect(published()).toHaveLength(0);
  });

  it('dos "comparte" seguidos comparten una sola vez (RF-37)', async () => {
    await profileService.update((p) => ({ ...p, community: { alias: 'Rosita' } }));
    await render();
    await act(async () => {
      commandBus.emit({ type: 'share' }, 'voice');
      commandBus.emit({ type: 'share' }, 'voice');
    });
    await settle();
    expect(published()).toHaveLength(1);
  });

  it('dos toques seguidos en Compartir comparten una sola vez (RF-37)', async () => {
    await render();
    await act(async () => button('Compartir mi logro')!.click());
    await act(async () => {
      const confirm = button('Compartir')!;
      confirm.click();
      confirm.click();
    });
    await settle();
    expect(published()).toHaveLength(1);
  });
});
