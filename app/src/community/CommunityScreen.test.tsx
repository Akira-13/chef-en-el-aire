// Pantalla de la Comunidad contra un servidor falso que sigue el contrato REST.

import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import { toRecipes, type CommunityPost, type RawRecipeBook } from '@chef/shared';
import { commandBus } from '../core/commandBus';
import { enterScreen, getCommandContext } from '../core/commandContext';
import { metrics } from '../core/metrics';
import { clearAdaptedRecipe } from '../core/recipes';
import { output, profileService } from '../core/services';
import { createFakeCommunityServer, type FakeCommunityServer } from './fakeServer';
import { CommunityScreen } from './index';
import { publishPost } from './outbox';
import { addOwnPostId, clearCommunityData } from './storage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const ajiDeGallina = recipes.find((r) => r.id === 'REC-001')!;

let container: HTMLElement;
let root: Root;
let server: FakeCommunityServer;
let announce: ReturnType<typeof vi.spyOn>;

function seed(): CommunityPost[] {
  return [
    {
      id: 'PUB-0002',
      kind: 'achievement',
      alias: 'Mamá Lucha',
      recipeId: 'REC-004',
      recipeName: 'Tortilla de verduras',
      createdAt: '2026-11-20T18:00:00.000Z',
      rating: 'up',
      applause: 2,
      comments: [],
    },
    {
      id: 'PUB-0001',
      kind: 'recipe',
      alias: 'Dieguito',
      recipeId: 'REC-001',
      recipeName: 'Ají de gallina',
      createdAt: '2026-11-19T15:00:00.000Z',
      recipe: ajiDeGallina,
      changes: [{ kind: 'ingredient', before: 'leche evaporada', after: 'leche sin lactosa' }],
      applause: 0,
      comments: [
        {
          id: 'COM-0001',
          alias: 'Mamá Lucha',
          text: '¡Qué rico!',
          createdAt: '2026-11-19T16:00:00.000Z',
        },
      ],
    },
  ];
}

function RecipeStub() {
  return <p>Receta {useParams().recipeId}</p>;
}

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/comunidad']}>
        <Routes>
          <Route path="/comunidad" element={<CommunityScreen />} />
          <Route path="/receta/:recipeId" element={<RecipeStub />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await settle();
}

async function emit(
  command: Parameters<typeof commandBus.emit>[0],
  channel: 'voice' | 'gesture' = 'voice',
) {
  await act(async () => {
    commandBus.emit(command, channel);
  });
  await settle();
}

async function poll() {
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await settle();
}

const cards = () => [
  ...container.querySelectorAll<HTMLLIElement>(
    'ul[aria-label="Publicaciones de la Comunidad"] > li',
  ),
];
const button = (text: string, scope: ParentNode = container) =>
  [...scope.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
const requests = (method: string, fragment: string) =>
  server.requests.filter((r) => r.method === method && r.url.includes(fragment));
const samples = (name: string) => metrics.samples().filter((s) => s.name === name);

beforeEach(async () => {
  localStorage.clear();
  clearCommunityData();
  metrics.clear();
  server = createFakeCommunityServer(seed());
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  await profileService.ready;
  await profileService.reset();
  await profileService.update((p) => ({ ...p, community: { alias: 'Sazón 1234' } }));
  announce = vi.spyOn(output, 'announce');
  enterScreen('home');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  clearAdaptedRecipe('REC-001');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CommunityScreen', () => {
  it('publica la pantalla community para la ayuda y los reconocedores (RF-33)', async () => {
    await render();
    expect(getCommandContext().screen).toBe('community');
  });

  it('lista accesible, la más reciente primero, con plato, alias, fecha y conteos (CA-27.3)', async () => {
    await render();
    const list = container.querySelector('ul[aria-label="Publicaciones de la Comunidad"]');
    expect(list).not.toBeNull();
    const [first, second] = cards();
    expect(first!.textContent).toContain('Tortilla de verduras');
    expect(first!.textContent).toContain('Mamá Lucha');
    expect(first!.textContent).toContain('20/11/2026');
    expect(first!.textContent).toContain('2 aplausos');
    expect(first!.textContent).toContain('Le gustó');
    expect(second!.textContent).toContain('1 comentario');
    expect(second!.textContent).toContain('leche evaporada → leche sin lactosa');
    expect(first!.getAttribute('aria-current')).toBe('true');
  });

  it('el gesto siguiente cambia de publicación y el pulgar arriba aplaude una sola vez (CA-29.2)', async () => {
    await render();
    await emit({ type: 'next' }, 'gesture');
    expect(cards()[1]!.getAttribute('aria-current')).toBe('true');

    await emit({ type: 'confirm' }, 'gesture');
    await emit({ type: 'applaud' });
    expect(requests('POST', '/PUB-0001/applause')).toHaveLength(1);
    expect(cards()[1]!.textContent).toContain('1 aplauso');
    // Sin `disabled` ni `aria-pressed`: conserva el foco y el estado va en la etiqueta (WCAG 4.1.2).
    const applauded = button('Aplaudiste', cards()[1])!;
    expect(applauded.disabled).toBe(false);
    expect(applauded.getAttribute('aria-disabled')).toBe('true');
    expect(applauded.hasAttribute('aria-pressed')).toBe(false);
    await act(async () => applauded.click());
    expect(requests('POST', '/PUB-0001/applause')).toHaveLength(1);
    expect(announce).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Ya aplaudiste esta publicación.' }),
    );
  });

  it('"dónde estoy" lee la publicación seleccionada y sus comentarios (RF-36)', async () => {
    await render();
    await emit({ type: 'next' });
    await emit({ type: 'whereAmI' });
    expect(announce).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Publicación 2 de 2: Ají de gallina') as unknown,
      }),
    );
  });

  it('comentar por voz publica en la seleccionada con el alias (RF-36)', async () => {
    await render();
    await emit({ type: 'comment', text: 'Me salió rica' });
    const [sent] = requests('POST', '/PUB-0002/comments');
    expect(sent?.body).toMatchObject({ alias: 'Sazón 1234', text: 'Me salió rica' });
    expect(cards()[0]!.textContent).toContain('Sazón 1234: Me salió rica');
  });

  it('comentar por texto respeta el límite y publica (RF-36)', async () => {
    await render();
    await act(async () => button('Comentar', cards()[1])!.click());
    const textarea = container.querySelector('textarea')!;
    expect(textarea.maxLength).toBe(500);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(textarea, 'La hice con mi mamá');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('Enviar comentario')!.click());
    await settle();
    expect(requests('POST', '/PUB-0001/comments')).toHaveLength(1);
    expect(cards()[1]!.textContent).toContain('La hice con mi mamá');
  });

  it('sin conexión el comentario queda pendiente y se envía una sola vez al volver (CA-28.3)', async () => {
    await render();
    server.online = false;
    await emit({ type: 'comment', text: 'Sin señal en la cocina' });
    expect(cards()[0]!.textContent).toContain('Sin señal en la cocina');
    expect(cards()[0]!.textContent).toContain('Pendiente');
    expect(container.textContent).toContain('La Comunidad no está disponible ahora');

    server.online = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    await poll();
    expect(requests('POST', '/PUB-0002/comments')).toHaveLength(1);
    expect(cards()[0]!.textContent).not.toContain('Pendiente');
    expect(cards()[0]!.textContent).toContain('Sin señal en la cocina');
    expect(samples('community.queueFlush')).toHaveLength(1);
  });

  it('sin servidor muestra el aviso y conserva lo último cargado (RF-33)', async () => {
    await render();
    server.online = false;
    await poll();
    expect(container.textContent).toContain('La Comunidad no está disponible ahora');
    expect(cards()).toHaveLength(2);
  });

  it('mide cuánto tarda en verse lo ajeno, no lo propio ni lo que ya estaba (CA-28.2)', async () => {
    await render();
    expect(samples('community.visible')).toHaveLength(0);
    server.addForeign({ recipeId: 'REC-002', recipeName: 'Lomo saltado', alias: 'Otra persona' });
    server.addForeign({ recipeId: 'REC-003', recipeName: 'Causa', alias: 'Sazón 1234' });
    await poll();
    expect(samples('community.visible')).toHaveLength(1);
    expect(cards()[0]!.textContent).toContain('Causa');
  });

  it('al entrar avisa de los aplausos nuevos en lo propio, una sola vez (CA-29.2)', async () => {
    addOwnPostId('PUB-0001');
    server.posts.find((p) => p.id === 'PUB-0001')!.applause = 3;
    await render();
    const text = 'Tu publicación «Ají de gallina» recibió 3 aplausos nuevos.';
    expect(container.textContent).toContain(text);
    expect(announce).toHaveBeenCalledWith(expect.objectContaining({ text }));

    // La próxima vez que entra ya los vio; solo avisa lo que llegó después.
    act(() => root.unmount());
    announce.mockClear();
    root = createRoot(container);
    server.posts.find((p) => p.id === 'PUB-0001')!.applause = 4;
    await render();
    expect(container.textContent).toContain('recibió 1 aplauso nuevo.');

    act(() => root.unmount());
    announce.mockClear();
    root = createRoot(container);
    await render();
    expect(container.textContent).not.toContain('aplauso nuevo');
    expect(announce).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('aplauso') }),
    );
  });

  it('no avisa de aplausos en publicaciones de otras personas (CA-29.2)', async () => {
    await render();
    expect(container.textContent).not.toContain('aplausos nuevos');
  });

  it('marca la receta que choca con el perfil y la que no, sin ocultar ninguna (RF-35)', async () => {
    await profileService.selectProfile('USR-001');
    await render();
    const recipeCard = cards()[1]!;
    expect(recipeCard.textContent).toContain('⚠️ Contiene leche (para esposo)');
    expect(cards()).toHaveLength(2);
    // Los logros no llevan marca.
    expect(cards()[0]!.textContent).not.toContain('Contiene');
    expect(cards()[0]!.textContent).not.toContain('Sin alérgenos');

    act(() => root.unmount());
    root = createRoot(container);
    await profileService.selectProfile('USR-004');
    await render();
    expect(cards()[1]!.textContent).toContain('✅ Sin alérgenos de tu perfil');
  });

  it('"dónde estoy" lee la revisión de la receta con el perfil (RF-35)', async () => {
    await profileService.selectProfile('USR-001');
    await render();
    await emit({ type: 'next' }, 'gesture');
    expect(announce).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('Contiene leche (para esposo)') }),
    );
    announce.mockClear();
    await emit({ type: 'whereAmI' });
    expect(announce).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(/Ají de gallina.*Contiene leche \(para esposo\)\./),
      }),
    );
  });

  it('"Cocinar esta receta" la abre como adaptada para que pase por el validador (RF-35)', async () => {
    await render();
    await act(async () => button('Cocinar esta receta', cards()[1])!.click());
    expect(container.textContent).toContain('Receta REC-001');
    const adapted = JSON.parse(localStorage.getItem('chef.adaptedRecipes')!) as {
      state: Record<string, unknown>;
    };
    expect(adapted.state).toHaveProperty('REC-001');
  });

  it('solo lo propio se puede borrar, y se borra en el servidor (RF-33)', async () => {
    expect(
      await publishPost({
        kind: 'achievement',
        alias: 'Sazón 1234',
        recipeId: 'REC-001',
        recipeName: 'Ají de gallina',
        rating: 'up',
      }),
    ).toBe('sent');
    await render();
    expect(cards()).toHaveLength(3);
    expect(button('Borrar', cards()[1])).toBeUndefined();

    await act(async () => button('Borrar', cards()[0])!.click());
    await act(async () => button('Sí, borrar')!.click());
    await settle();
    expect(requests('DELETE', '/posts/')).toHaveLength(1);
    expect(cards()).toHaveLength(2);
  });

  async function publishOwn() {
    expect(
      await publishPost({
        kind: 'achievement',
        alias: 'Sazón 1234',
        recipeId: 'REC-001',
        recipeName: 'Ají de gallina',
        rating: 'up',
      }),
    ).toBe('sent');
    await render();
    await act(async () => button('Borrar', cards()[0])!.click());
  }

  it('con el diálogo de borrar abierto, "confirma" borra y no aplaude (RF-33)', async () => {
    await publishOwn();
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

    await emit({ type: 'confirm' });
    expect(requests('DELETE', '/posts/')).toHaveLength(1);
    expect(requests('POST', '/applause')).toHaveLength(0);
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(cards()).toHaveLength(2);
  });

  it('con el diálogo de borrar abierto, el pulgar arriba también confirma (RF-33)', async () => {
    await publishOwn();
    await emit({ type: 'confirm' }, 'gesture');
    expect(requests('DELETE', '/posts/')).toHaveLength(1);
    expect(requests('POST', '/applause')).toHaveLength(0);
  });

  it('con el diálogo de borrar abierto, "cancela" lo cierra sin borrar (RF-33)', async () => {
    await publishOwn();
    await emit({ type: 'cancel' });
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(requests('DELETE', '/posts/')).toHaveLength(0);
    expect(cards()).toHaveLength(3);
  });

  it('sin diálogo abierto, "confirma" sigue aplaudiendo (RF-36)', async () => {
    await render();
    await emit({ type: 'confirm' });
    expect(requests('POST', '/PUB-0002/applause')).toHaveLength(1);
  });

  it('un comentario por voz vacío no se encola y se avisa (RF-36)', async () => {
    await render();
    await emit({ type: 'comment', text: '   ' });
    expect(requests('POST', '/comments')).toHaveLength(0);
    expect(localStorage.getItem('chef.community.queue')).toBeNull();
    expect(announce).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('comentario') as unknown }),
    );
    expect(announce).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('descart') as unknown }),
    );
  });

  it('una respuesta vieja que llega tarde no pisa a la más nueva (RNF-09)', async () => {
    const pending: ((posts: CommunityPost[]) => void)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, _init?: RequestInit) =>
          new Promise<Response>((resolve) => {
            pending.push((posts) =>
              resolve(
                new Response(JSON.stringify({ posts, serverTime: new Date().toISOString() }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }),
              ),
            );
          }),
      ),
    );
    await render();
    await poll();
    expect(pending).toHaveLength(2);

    const [older, newer] = pending as [(typeof pending)[0], (typeof pending)[0]];
    const fresh = [{ ...seed()[0]!, id: 'PUB-0003', recipeName: 'Causa limeña' }, ...seed()];
    await act(async () => newer(fresh));
    await settle();
    expect(cards()).toHaveLength(3);

    await act(async () => older(seed()));
    await settle();
    expect(cards()).toHaveLength(3);
    expect(cards()[0]!.textContent).toContain('Causa limeña');
  });
});
