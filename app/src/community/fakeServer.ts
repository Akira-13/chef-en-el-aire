// Servidor falso de la Comunidad para las pruebas: sigue el contrato REST (idempotencia por
// `clientId`, un aplauso por dispositivo, borrar solo lo propio) y puede "perder la red".

import type {
  CommunityComment,
  CommunityPost,
  NewCommunityComment,
  NewCommunityPost,
} from '@chef/shared';

export interface FakeRequest {
  method: string;
  url: string;
  body: unknown;
}

export interface FakeCommunityServer {
  posts: CommunityPost[];
  requests: FakeRequest[];
  /** Sin red: `fetch` rechaza como el navegador. */
  online: boolean;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Agrega una publicación ajena, como si llegara desde otro teléfono. */
  addForeign(
    post: Partial<CommunityPost> & Pick<CommunityPost, 'recipeId' | 'recipeName'>,
  ): CommunityPost;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function createFakeCommunityServer(initial: CommunityPost[] = []): FakeCommunityServer {
  // Empieza en 100 para no repetir los ids de la semilla.
  let counter = 100;
  const nextId = (prefix: string) => `${prefix}-${String(++counter).padStart(4, '0')}`;
  const authors = new Map<string, string>();
  const postsByClient = new Map<string, CommunityPost>();
  const commentsByClient = new Map<string, CommunityComment>();
  const applauders = new Map<string, Set<string>>();

  const server: FakeCommunityServer = {
    posts: [...initial],
    requests: [],
    online: true,

    addForeign(partial) {
      const post: CommunityPost = {
        id: nextId('PUB'),
        kind: 'recipe',
        alias: 'Otra persona',
        createdAt: new Date().toISOString(),
        applause: 0,
        comments: [],
        ...partial,
      };
      server.posts.unshift(post);
      return post;
    },

    async fetch(input, init) {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (!server.online) throw new TypeError('Failed to fetch');
      server.requests.push({ method, url, body });

      const path = url.replace(/^.*\/api\/community/, '');
      if (path === '/posts' && method === 'GET') {
        return json(200, { posts: server.posts, serverTime: new Date().toISOString() });
      }
      if (path === '/posts' && method === 'POST') {
        const input = body as NewCommunityPost;
        const existing = postsByClient.get(input.clientId);
        if (existing) return json(200, existing);
        if (!input.alias?.trim()) return json(400, { error: 'Falta el alias.' });
        const { clientId, deviceKey, ...rest } = input;
        const post: CommunityPost = {
          ...rest,
          id: nextId('PUB'),
          createdAt: new Date().toISOString(),
          applause: 0,
          comments: [],
        };
        postsByClient.set(clientId, post);
        authors.set(post.id, deviceKey);
        server.posts.unshift(post);
        return json(201, post);
      }
      const match = path.match(/^\/posts\/([^/]+)(?:\/(comments|applause))?$/);
      const post = match && server.posts.find((p) => p.id === decodeURIComponent(match[1]!));
      if (!match || !post) return json(404, { error: 'No existe.' });
      if (match[2] === 'comments') {
        const input = body as NewCommunityComment;
        const existing = commentsByClient.get(input.clientId);
        if (existing) return json(200, existing);
        if (!input.text?.trim()) return json(400, { error: 'El comentario está vacío.' });
        const comment: CommunityComment = {
          id: nextId('COM'),
          alias: input.alias,
          text: input.text,
          createdAt: new Date().toISOString(),
        };
        commentsByClient.set(input.clientId, comment);
        post.comments.push(comment);
        return json(201, comment);
      }
      if (match[2] === 'applause') {
        const { deviceKey } = body as { deviceKey: string };
        const set = applauders.get(post.id) ?? new Set<string>();
        if (!set.has(deviceKey)) {
          set.add(deviceKey);
          post.applause += 1;
        }
        applauders.set(post.id, set);
        return json(200, { applause: post.applause });
      }
      if (method === 'DELETE') {
        if (authors.get(post.id) !== (body as { deviceKey: string }).deviceKey) {
          return json(403, { error: 'No es tuya.' });
        }
        server.posts = server.posts.filter((p) => p !== post);
        return new Response(null, { status: 204 });
      }
      return json(404, { error: 'Ruta no encontrada' });
    },
  };
  return server;
}
