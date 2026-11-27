// Almacén de la Comunidad (RF-33 a RF-37, RNF-09). Mantiene las publicaciones en memoria y las
// guarda en un JSON. Las escrituras se serializan con una promesa encadenada y se hacen de forma
// atómica (archivo temporal y `rename`), así un corte no deja el archivo a medias.
// Lo privado (autor, envíos ya vistos, quién aplaudió) vive aparte de la parte pública de cada
// publicación, por eso nunca puede salir en una respuesta. Los `deviceKey` se guardan con hash.

import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { access, constants, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  COMMUNITY_LIMITS,
  scaleRecipe,
  type CommunityComment,
  type CommunityFeed,
  type CommunityPost,
  type NewCommunityComment,
  type NewCommunityPost,
} from '@chef/shared';
import { getRecipe } from '../data/recipes';

export type NewPostInput = NewCommunityPost;
export type NewCommentInput = NewCommunityComment;

/** Publicaciones que se conservan; al pasarse se descartan las más antiguas. */
export const MAX_POSTS = 200;
/** Tope de comentarios por publicación, para que el archivo no crezca sin límite. */
export const MAX_COMMENTS_PER_POST = 200;

/** Publicaciones por hora que admite un mismo dispositivo, contra el spam. */
export const MAX_POSTS_PER_HOUR = 10;
const HOUR_MS = 3_600_000;

/** El dispositivo ya publicó el máximo de la hora: la ruta lo traduce a 429. */
export class PostRateLimitError extends Error {
  constructor() {
    super('Se alcanzó el límite de publicaciones por hora.');
    this.name = 'PostRateLimitError';
  }
}

export type AddCommentResult =
  | { status: 'created' | 'existing'; comment: CommunityComment }
  | { status: 'not-found' }
  | { status: 'full' };

export type DeleteResult = 'deleted' | 'forbidden' | 'not-found';

export interface CommunityStore {
  /** Las publicaciones más recientes primero, hasta `COMMUNITY_LIMITS.feedSize`. */
  getFeed(): CommunityFeed;
  createPost(input: NewPostInput): Promise<{ post: CommunityPost; created: boolean }>;
  addComment(postId: string, input: NewCommentInput): Promise<AddCommentResult>;
  /** Total de aplausos, o `undefined` si la publicación no existe. */
  applaud(postId: string, deviceKey: string): Promise<number | undefined>;
  deletePost(postId: string, deviceKey: string): Promise<DeleteResult>;
  /** Si el archivo de la Comunidad se puede escribir ahora; las publicaciones fallarían si no. */
  isWritable(): Promise<boolean>;
}

export interface CommunityStoreOptions {
  file: string;
  /** Reloj inyectable para las pruebas. */
  now?: () => Date;
  /** Tope de publicaciones por dispositivo y hora; por defecto `MAX_POSTS_PER_HOUR`. */
  maxPostsPerHour?: number;
}

// Lo que se guarda por publicación: la parte pública más los datos privados.
interface StoredPost {
  post: CommunityPost;
  clientId: string;
  authorHash: string;
  applauderHashes: string[];
  /** `clientId` de cada comentario ya recibido, con el id que se le asignó. */
  commentClientIds: Record<string, string>;
}

// Más recientes primero.
interface State {
  nextPost: number;
  nextComment: number;
  posts: StoredPost[];
  /** Instantes (ms) de las publicaciones recientes por dispositivo; borrar una no los libera. */
  postTimes?: Record<string, number[]>;
}

const hashKey = (deviceKey: string) => createHash('sha256').update(deviceKey).digest('hex');
const makeId = (prefix: string, n: number) => `${prefix}-${String(n).padStart(4, '0')}`;

function isState(value: unknown): value is State {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<State>;
  return (
    typeof state.nextPost === 'number' &&
    typeof state.nextComment === 'number' &&
    Array.isArray(state.posts)
  );
}

// Dos publicaciones de demostración para que la Comunidad no esté vacía: alias ficticios y
// recetas reales del recetario. Su autor es un token que nadie conoce, así que no se pueden borrar.
function buildSeed(now: Date): State {
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  const posts: StoredPost[] = [];
  // Una copia nueva por publicación: no deben compartir arreglos ni objetos.
  const base = () => ({ applauderHashes: [], commentClientIds: {} });

  const rice = getRecipe('REC-007');
  if (rice) {
    posts.push({
      ...base(),
      clientId: 'seed-1',
      authorHash: hashKey(randomUUID()),
      post: {
        id: makeId('PUB', 1),
        kind: 'recipe',
        alias: 'Sazón Norteña',
        recipeId: rice.id,
        recipeName: rice.name,
        createdAt: ago(5),
        recipe: scaleRecipe(rice, 2),
        changes: [
          {
            kind: 'servings',
            before: `${rice.servings} porciones`,
            after: '2 porciones',
          },
        ],
        applause: 2,
        comments: [],
      },
    });
  }

  const aji = getRecipe('REC-001');
  if (aji) {
    posts.unshift({
      ...base(),
      clientId: 'seed-2',
      authorHash: hashKey(randomUUID()),
      commentClientIds: { 'seed-comment-1': makeId('COM', 1) },
      post: {
        id: makeId('PUB', 2),
        kind: 'achievement',
        alias: 'Cocinera Curiosa',
        recipeId: aji.id,
        recipeName: aji.name,
        createdAt: ago(2),
        rating: 'up',
        message: '¡Me salió cremoso y sin grumos!',
        applause: 3,
        comments: [
          {
            id: makeId('COM', 1),
            alias: 'Chef de Barrio',
            text: 'Se ve riquísimo, lo pruebo este fin de semana.',
            createdAt: ago(1),
          },
        ],
      },
    });
  }

  return { nextPost: 3, nextComment: 2, posts };
}

function readState(file: string): State | undefined {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (isState(parsed)) return parsed;
  } catch {
    // Archivo dañado: se aparta abajo.
  }
  // Se conserva copia del archivo dañado para no perder lo que haya servido de él.
  try {
    renameSync(file, `${file}.dañado-${Date.now()}`);
  } catch {
    // Si ni siquiera se puede apartar, la próxima escritura lo reemplaza.
  }
  return undefined;
}

function writeStateSync(file: string, state: State): void {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(state));
  renameSync(temp, file);
}

async function writeState(file: string, state: State): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(state));
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

export function createCommunityStore({
  file,
  now = () => new Date(),
  maxPostsPerHour = MAX_POSTS_PER_HOUR,
}: CommunityStoreOptions): CommunityStore {
  let state = readState(file);
  if (!state) {
    state = buildSeed(now());
    try {
      writeStateSync(file, state);
    } catch {
      // Sin permiso de escritura la Comunidad funciona en memoria; las escrituras fallarán.
    }
  }

  // Cada cambio se hace sobre una copia y solo reemplaza al estado si se pudo guardar: si el
  // disco falla, memoria y archivo siguen iguales. La cola evita que dos cambios se pisen.
  let tail: Promise<unknown> = Promise.resolve();
  function update<T>(change: (draft: State) => { result: T; changed: boolean }): Promise<T> {
    const run = tail.then(async () => {
      const draft = structuredClone(state!);
      const { result, changed } = change(draft);
      if (changed) {
        await writeState(file, draft);
        state = draft;
      }
      return result;
    });
    tail = run.catch(() => undefined);
    return run;
  }

  const find = (draft: State, postId: string) => draft.posts.find((s) => s.post.id === postId);

  return {
    getFeed() {
      const posts = state!.posts.slice(0, COMMUNITY_LIMITS.feedSize).map((s) => s.post);
      return { posts: structuredClone(posts), serverTime: now().toISOString() };
    },

    createPost(input) {
      return update<{ post: CommunityPost; created: boolean }>((draft) => {
        const existing = draft.posts.find((s) => s.clientId === input.clientId);
        if (existing) {
          return {
            result: { post: structuredClone(existing.post), created: false },
            changed: false,
          };
        }
        // El reenvío de algo ya publicado no cuenta; lo nuevo sí, aunque luego se borre.
        const authorHash = hashKey(input.deviceKey);
        const since = now().getTime() - HOUR_MS;
        const recent: Record<string, number[]> = {};
        for (const [hash, times] of Object.entries(draft.postTimes ?? {})) {
          const inHour = times.filter((time) => time > since);
          if (inHour.length > 0) recent[hash] = inHour;
        }
        if ((recent[authorHash]?.length ?? 0) >= maxPostsPerHour) throw new PostRateLimitError();
        (recent[authorHash] ??= []).push(now().getTime());
        draft.postTimes = recent;

        const post: CommunityPost = {
          id: makeId('PUB', draft.nextPost++),
          kind: input.kind,
          alias: input.alias,
          recipeId: input.recipeId,
          recipeName: input.recipeName,
          createdAt: now().toISOString(),
          ...(input.recipe && { recipe: input.recipe }),
          ...(input.changes && { changes: input.changes }),
          ...(input.rating && { rating: input.rating }),
          ...(input.message && { message: input.message }),
          applause: 0,
          comments: [],
        };
        draft.posts.unshift({
          post,
          clientId: input.clientId,
          authorHash,
          applauderHashes: [],
          commentClientIds: {},
        });
        draft.posts.length = Math.min(draft.posts.length, MAX_POSTS);
        return { result: { post: structuredClone(post), created: true }, changed: true };
      });
    },

    addComment(postId, input) {
      return update<AddCommentResult>((draft) => {
        const stored = find(draft, postId);
        if (!stored) return { result: { status: 'not-found' }, changed: false };
        const knownId = stored.commentClientIds[input.clientId];
        const known = stored.post.comments.find((c) => c.id === knownId);
        if (known) {
          return {
            result: { status: 'existing', comment: structuredClone(known) },
            changed: false,
          };
        }
        if (stored.post.comments.length >= MAX_COMMENTS_PER_POST) {
          return { result: { status: 'full' }, changed: false };
        }
        const comment: CommunityComment = {
          id: makeId('COM', draft.nextComment++),
          alias: input.alias,
          text: input.text,
          createdAt: now().toISOString(),
        };
        stored.post.comments.push(comment);
        stored.commentClientIds[input.clientId] = comment.id;
        return { result: { status: 'created', comment: structuredClone(comment) }, changed: true };
      });
    },

    applaud(postId, deviceKey) {
      return update<number | undefined>((draft) => {
        const stored = find(draft, postId);
        if (!stored) return { result: undefined, changed: false };
        const hash = hashKey(deviceKey);
        if (stored.applauderHashes.includes(hash)) {
          return { result: stored.post.applause, changed: false };
        }
        stored.applauderHashes.push(hash);
        stored.post.applause += 1;
        return { result: stored.post.applause, changed: true };
      });
    },

    async isWritable() {
      try {
        await mkdir(dirname(file), { recursive: true });
        await access(dirname(file), constants.W_OK);
        // Si el archivo ya existe, el `rename` lo reemplaza, pero conviene que él también sea escribible.
        await access(file, constants.W_OK).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error;
        });
        return true;
      } catch {
        return false;
      }
    },

    deletePost(postId, deviceKey) {
      return update<DeleteResult>((draft) => {
        const stored = find(draft, postId);
        if (!stored) return { result: 'not-found', changed: false };
        if (stored.authorHash !== hashKey(deviceKey)) {
          return { result: 'forbidden', changed: false };
        }
        draft.posts = draft.posts.filter((s) => s !== stored);
        return { result: 'deleted', changed: true };
      });
    },
  };
}
