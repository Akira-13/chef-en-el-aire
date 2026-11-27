// Pantalla de la Comunidad (RF-33, RF-35, RF-36): publicaciones recientes, de la más nueva a la
// más antigua (CA-27.3). Se recorre con "siguiente" y "anterior" por voz, gesto o teclado; el
// pulgar arriba o "aplaude" aplauden la seleccionada y "comenta …" la comenta. Todo tiene además
// su botón táctil (RF-24). Lo que aún está en la cola sin conexión se muestra como "pendiente".
// Cada receta lleva una marca que dice si choca con las alergias de quien mira (sin ocultarla), y
// al entrar se avisa de los aplausos nuevos en lo que uno publicó (CA-29.2).

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactElement,
} from 'react';
import { useNavigate } from 'react-router';
import { COMMUNITY_LIMITS, COMMUNITY_UNAVAILABLE_MESSAGE, type CommunityPost } from '@chef/shared';
import { enterScreen } from '../core/commandContext';
import { useCommands } from '../core/commandBus';
import { setAdaptedRecipe } from '../core/recipes';
import { output, useProfile } from '../core/services';
import { useOnlineStatus } from '../core/useOnlineStatus';
import { Button, Chip, IconButton, Screen } from '../ui';
import { AliasField, saveAlias } from './AliasField';
import { applauseNotice, markApplauseSeen, newApplause } from './applause';
import {
  applauseLabel,
  commentsLabel,
  describePost,
  formatDate,
  kindLabel,
  postHeadline,
} from './format';
import { applaudPost, commentOn, removePost, type ActionResult } from './outbox';
import { postSafety } from './postSafety';
import { loadQueue, subscribeQueue, type QueueItem } from './queue';
import { getApplaudedPostIds, getOwnPostIds, getSeenApplause, setSeenApplause } from './storage';
import { useCommunityFeed } from './useCommunityFeed';
import styles from './community.module.css';

interface ListedPost {
  post: CommunityPost;
  /** Todavía en la cola: no se puede aplaudir, comentar ni borrar. */
  pending: boolean;
  pendingComments: { clientId: string; alias: string; text: string }[];
}

/** Une lo publicado con lo pendiente; lo pendiente va primero porque es lo más reciente. */
function listPosts(posts: CommunityPost[], queue: QueueItem[]): ListedPost[] {
  const pendingPosts: ListedPost[] = queue.flatMap((item) =>
    item.kind === 'post'
      ? [
          {
            post: {
              ...item.body,
              id: `pendiente-${item.clientId}`,
              createdAt: item.queuedAt,
              applause: 0,
              comments: [],
            },
            pending: true,
            pendingComments: [],
          },
        ]
      : [],
  );
  const published = posts.map((post) => ({
    post,
    pending: false,
    pendingComments: queue.flatMap((item) =>
      item.kind === 'comment' && item.postId === post.id
        ? [{ clientId: item.clientId, alias: item.body.alias, text: item.body.text }]
        : [],
    ),
  }));
  return [...pendingPosts.reverse(), ...published];
}

function announceResult(result: ActionResult, sent: string) {
  if (result === 'sent') {
    output.cue('success');
    output.announce({ text: sent, kind: 'success' });
  } else if (result === 'pending') {
    output.announce({ text: COMMUNITY_UNAVAILABLE_MESSAGE, kind: 'info' });
  }
}

function CommentForm({
  postId,
  alias,
  profileName,
  onDone,
}: {
  postId: string;
  alias: string | undefined;
  profileName: string;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [draftAlias, setDraftAlias] = useState('');
  const [error, setError] = useState<string>();
  const [aliasError, setAliasError] = useState<string>();
  const counterId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    let author = alias;
    if (!author) {
      const saved = saveAlias(draftAlias, profileName);
      if (!saved.ok) {
        setAliasError(saved.error);
        return;
      }
      author = saved.alias;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Escribe tu comentario.');
      return;
    }
    announceResult(await commentOn(postId, author, trimmed), 'Publiqué tu comentario.');
    onDone();
  }

  return (
    <form className={styles.commentForm} onSubmit={(e) => void submit(e)} noValidate>
      {!alias && (
        <AliasField
          value={draftAlias}
          error={aliasError}
          onChange={(value) => {
            setDraftAlias(value);
            setAliasError(undefined);
          }}
        />
      )}
      <label className={styles.field}>
        <span>Tu comentario</span>
        <textarea
          className={styles.textInput}
          value={text}
          maxLength={COMMUNITY_LIMITS.textMaxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={counterId}
          autoFocus
          onChange={(event) => {
            setText(event.target.value);
            setError(undefined);
          }}
        />
      </label>
      <span id={counterId} className={styles.muted}>
        {text.length} de {COMMUNITY_LIMITS.textMaxLength} caracteres
      </span>
      {error && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit">Enviar comentario</Button>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function CommunityScreen(): ReactElement {
  const navigate = useNavigate();
  const profile = useProfile();
  const alias = profile.community?.alias;
  const online = useOnlineStatus();
  const { posts, status, refresh } = useCommunityFeed(alias);
  const queue = useSyncExternalStore(subscribeQueue, loadQueue);
  const [selectedId, setSelectedId] = useState<string>();
  const [commentingId, setCommentingId] = useState<string>();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>();
  const [newApplauseText, setNewApplauseText] = useState<string>();
  const entryChecked = useRef(false);
  // Sube tras aplaudir o borrar, para releer lo guardado en el dispositivo.
  const [, setVersion] = useState(0);
  const items = useRef(new Map<string, HTMLLIElement>());

  // Publica la pantalla para que la ayuda y los reconocedores ofrezcan sus comandos.
  useEffect(() => enterScreen('community'), []);

  // CA-29.2: al entrar, avisa de los aplausos que llegaron a lo propio desde la última vez. Solo
  // en la primera lista cargada; después, lo que se ve en pantalla ya cuenta como visto.
  useEffect(() => {
    if (status !== 'ready') return;
    const own = new Set(getOwnPostIds());
    const applaudedIds = new Set(getApplaudedPostIds());
    if (!entryChecked.current) {
      entryChecked.current = true;
      const text = applauseNotice(newApplause(posts, own, applaudedIds, getSeenApplause()));
      if (text) {
        setNewApplauseText(text);
        output.announce({ text, kind: 'info' });
      }
    }
    setSeenApplause(markApplauseSeen(posts, own, applaudedIds));
  }, [posts, status]);

  const listed = listPosts(posts, queue);
  // La marca depende solo de las recetas y de las alergias del perfil, no de cada render.
  const safetyById = useMemo(
    () =>
      new Map(
        listed.flatMap(({ post }) => {
          const safety = postSafety(post, profile);
          return safety ? [[post.id, safety] as const] : [];
        }),
      ),

    [posts, queue, profile.explicit],
  );
  const index = Math.max(
    0,
    listed.findIndex((l) => l.post.id === selectedId),
  );
  const selected = listed[index];
  const applauded = new Set(getApplaudedPostIds());
  const own = new Set(getOwnPostIds());
  const confirmItem = listed.find((l) => l.post.id === confirmDeleteId);

  function select(target: number, cue?: 'next' | 'previous') {
    const item = listed[target];
    if (!item) {
      output.announce({
        text: listed.length === 0 ? 'Todavía no hay publicaciones.' : 'No hay más publicaciones.',
        kind: 'info',
      });
      return;
    }
    setSelectedId(item.post.id);
    const element = items.current.get(item.post.id);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView?.({ block: 'nearest' });
    if (cue) output.cue(cue);
    const safety = safetyById.get(item.post.id);
    output.announce({
      text: `${postHeadline(item.post)}.${safety ? ` ${safety.text}.` : ''}${item.pending ? ' Pendiente de enviar.' : ''}`,
      kind: 'info',
    });
  }

  async function applaud(item: ListedPost | undefined) {
    if (!item) return;
    if (item.pending) {
      output.announce({ text: 'Esta publicación todavía no se envía.', kind: 'info' });
      return;
    }
    if (applauded.has(item.post.id)) {
      output.announce({ text: 'Ya aplaudiste esta publicación.', kind: 'info' });
      return;
    }
    const result = await applaudPost(item.post.id);
    setVersion((v) => v + 1);
    announceResult(result, `Aplaudiste a ${item.post.alias}.`);
    if (result === 'sent') void refresh();
  }

  async function commentByVoice(item: ListedPost | undefined, text: string) {
    if (!item || item.pending) {
      output.announce({ text: 'Elige una publicación ya enviada para comentar.', kind: 'info' });
      return;
    }
    // El servidor rechaza un comentario vacío: se avisa antes de encolarlo.
    const trimmed = text.trim().slice(0, COMMUNITY_LIMITS.textMaxLength);
    if (!trimmed) {
      output.announce({
        text: 'No escuché tu comentario. Di "comenta" y lo que quieras escribir.',
        kind: 'info',
      });
      return;
    }
    if (!alias) {
      setSelectedId(item.post.id);
      setCommentingId(item.post.id);
      output.announce({ text: 'Para comentar, primero escribe tu alias.', kind: 'info' });
      return;
    }
    announceResult(await commentOn(item.post.id, alias, trimmed), 'Publiqué tu comentario.');
    void refresh();
  }

  async function remove(item: ListedPost) {
    const result = await removePost(item.post.id);
    setConfirmDeleteId(undefined);
    setVersion((v) => v + 1);
    if (result === 'deleted') {
      output.announce({ text: 'Borré tu publicación.', kind: 'success' });
      void refresh();
    } else {
      output.announce({
        text:
          result === 'unavailable'
            ? 'No hay conexión: no pude borrar tu publicación.'
            : 'La Comunidad no me dejó borrarla.',
        kind: 'error',
      });
    }
  }

  function cook(post: CommunityPost) {
    if (!post.recipe) return;
    // RF-35: se abre como receta adaptada; la pantalla de la receta la revisa con el perfil de
    // quien la abre y bloquea si choca con sus alergias.
    setAdaptedRecipe(post.recipe);
    output.announce({
      text: `Abrí la receta de ${post.alias}. Revisaré sus alérgenos con tu perfil.`,
      kind: 'info',
    });
    navigate(`/receta/${encodeURIComponent(post.recipeId)}`);
  }

  useCommands(({ command }) => {
    switch (command.type) {
      case 'next':
        select(index + 1, 'next');
        break;
      case 'previous':
        select(index - 1, 'previous');
        break;
      case 'whereAmI':
        output.announce({
          text: selected
            ? describePost(
                selected.post,
                index + 1,
                listed.length,
                safetyById.get(selected.post.id)?.text,
              )
            : 'Estás en la Comunidad. Todavía no hay publicaciones.',
          kind: 'info',
        });
        break;
      case 'applaud':
        void applaud(selected);
        break;
      // El pulgar arriba emite `confirm`: con el diálogo de borrar abierto lo confirma; si no,
      // en la Comunidad equivale a aplaudir (RF-36).
      case 'confirm':
        if (confirmItem) void remove(confirmItem);
        else void applaud(selected);
        break;
      case 'cancel':
        if (confirmItem) setConfirmDeleteId(undefined);
        break;
      case 'comment':
        void commentByVoice(selected, command.text);
        break;
      default:
        break;
    }
  });

  const unavailable = status === 'unavailable' || !online;

  return (
    <Screen
      title="Comunidad"
      header={
        <>
          <IconButton aria-label="Volver" onClick={() => navigate(-1)}>
            ←
          </IconButton>
          <h1>Comunidad</h1>
          <span />
        </>
      }
    >
      <p className={styles.muted}>
        {alias
          ? `Publicas como ${alias}.`
          : 'Aquí solo se muestra tu alias. Puedes elegirlo en Mi perfil o al publicar.'}
      </p>
      {newApplauseText && <p className={styles.notice}>👏 {newApplauseText}</p>}
      {unavailable && (
        <p className={styles.notice} role="status">
          {COMMUNITY_UNAVAILABLE_MESSAGE}
        </p>
      )}
      {status === 'loading' && listed.length === 0 && <p role="status">Cargando publicaciones…</p>}
      {status !== 'loading' && listed.length === 0 && (
        <p>Todavía no hay publicaciones. Comparte tu receta adaptada o tu plato terminado.</p>
      )}
      <ul className={styles.list} aria-label="Publicaciones de la Comunidad">
        {listed.map((item, i) => {
          const { post } = item;
          const isSelected = i === index;
          const titleId = `titulo-${post.id}`;
          const canCook = post.kind === 'recipe' && post.recipe?.id === post.recipeId;
          const safety = safetyById.get(post.id);
          return (
            <li
              key={post.id}
              ref={(el) => {
                if (el) items.current.set(post.id, el);
                else items.current.delete(post.id);
              }}
              tabIndex={-1}
              className={styles.post}
              aria-current={isSelected ? 'true' : undefined}
              aria-labelledby={titleId}
            >
              <div className={styles.postHeader}>
                <h2 id={titleId} className={styles.postTitle}>
                  {post.recipeName}
                </h2>
                <span className={styles.muted}>
                  {post.alias} · {formatDate(post.createdAt)}
                </span>
              </div>
              <div className={styles.badges}>
                <Chip>{kindLabel(post)}</Chip>
                {safety && (
                  <Chip tone={safety.safe ? 'have' : 'missing'}>
                    {safety.safe ? '✅' : '⚠️'} {safety.text}
                  </Chip>
                )}
                {item.pending && <Chip tone="substitute">Pendiente</Chip>}
                {post.kind === 'achievement' && post.rating && (
                  <Chip>{post.rating === 'up' ? '👍 Le gustó' : '👎 No le gustó'}</Chip>
                )}
              </div>
              {post.message && <p>{post.message}</p>}
              {post.changes && post.changes.length > 0 && (
                <ul className={styles.changes} aria-label="Cambios">
                  {post.changes.map((change, c) => (
                    <li key={c} className={styles.change}>
                      {change.before} → {change.after}
                      {change.reason && <span className={styles.reason}>{change.reason}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <span className={styles.stat}>
                👏 {applauseLabel(post.applause)} · 💬 {commentsLabel(post.comments.length)}
              </span>
              {(post.comments.length > 0 || item.pendingComments.length > 0) && (
                <ul className={styles.comments} aria-label="Comentarios">
                  {post.comments.map((c) => (
                    <li key={c.id} className={styles.comment}>
                      <span className={styles.commentAlias}>{c.alias}:</span> {c.text}
                    </li>
                  ))}
                  {item.pendingComments.map((c) => (
                    <li key={c.clientId} className={styles.comment}>
                      <span className={styles.commentAlias}>{c.alias}:</span> {c.text}{' '}
                      <Chip tone="substitute">Pendiente</Chip>
                    </li>
                  ))}
                </ul>
              )}
              {!item.pending && (
                <div className={styles.actions}>
                  <Button
                    variant="secondary"
                    aria-disabled={applauded.has(post.id) || undefined}
                    onClick={() => {
                      setSelectedId(post.id);
                      void applaud(item);
                    }}
                  >
                    {applauded.has(post.id) ? '👏 Aplaudiste' : '👏 Aplaudir'}
                  </Button>
                  <Button
                    variant="secondary"
                    aria-expanded={commentingId === post.id}
                    onClick={() => {
                      setSelectedId(post.id);
                      setCommentingId(commentingId === post.id ? undefined : post.id);
                    }}
                  >
                    💬 Comentar
                  </Button>
                  {canCook && <Button onClick={() => cook(post)}>🍳 Cocinar esta receta</Button>}
                  {own.has(post.id) && confirmDeleteId !== post.id && (
                    <Button variant="ghost" onClick={() => setConfirmDeleteId(post.id)}>
                      🗑️ Borrar
                    </Button>
                  )}
                </div>
              )}
              {confirmDeleteId === post.id && (
                <div className={styles.notice} role="alertdialog" aria-label="Borrar publicación">
                  <p>¿Borrar tu publicación de la Comunidad?</p>
                  <div className={styles.actions}>
                    <Button onClick={() => void remove(item)} autoFocus>
                      Sí, borrar
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmDeleteId(undefined)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
              {commentingId === post.id && (
                <CommentForm
                  postId={post.id}
                  alias={alias}
                  profileName={profile.name}
                  onDone={() => {
                    setCommentingId(undefined);
                    void refresh();
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
