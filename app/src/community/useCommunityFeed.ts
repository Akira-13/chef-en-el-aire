// Lista de la Comunidad por sondeo (RF-33, RNF-09). Consulta cada `pollIntervalMs` solo mientras
// la pantalla está visible, para no gastar batería ni datos. Sin servidor conserva lo último
// cargado. Al primer sondeo exitoso tras una falla, envía la cola pendiente.

import { useCallback, useEffect, useRef, useState } from 'react';
import { COMMUNITY_LIMITS, type CommunityPost } from '@chef/shared';
import { metrics } from '../core/metrics';
import { communityClient } from './client';
import { feedItems, newForeignItems, visibleDelayMs, type FeedItemRef } from './feedDiff';
import { flushOutbox, markReconnected } from './outbox';
import { loadQueue } from './queue';
import { getOwnCommentIds, getOwnPostIds } from './storage';

export type FeedStatus = 'loading' | 'ready' | 'unavailable';

export interface CommunityFeedState {
  posts: CommunityPost[];
  status: FeedStatus;
  /** Consulta ya, por ejemplo después de publicar o comentar. */
  refresh: () => Promise<void>;
}

export function useCommunityFeed(ownAlias?: string): CommunityFeedState {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const seen = useRef<Set<string> | null>(null);
  const failing = useRef(false);
  const alias = useRef(ownAlias);
  alias.current = ownAlias;

  const refresh = useCallback(async () => {
    const feed = await communityClient.feed();
    if ('status' in feed) {
      failing.current = true;
      setStatus('unavailable');
      return;
    }
    const offset = Date.parse(feed.serverTime) - Date.now();
    const ownPosts = new Set(getOwnPostIds());
    const ownComments = new Set(getOwnCommentIds());
    // Lo propio se reconoce por id y también por alias, porque un comentario recién enviado puede
    // llegar en la lista antes de que se guarde su id.
    const isOwn = (item: FeedItemRef) =>
      ownPosts.has(item.id) ||
      ownComments.has(item.id) ||
      (!!alias.current && item.alias === alias.current);

    if (seen.current) {
      for (const item of newForeignItems(feed.posts, seen.current, isOwn)) {
        metrics.record('community.visible', visibleDelayMs(item.createdAt, offset), 'ms', {
          id: item.id,
        });
      }
    }
    seen.current = new Set(feedItems(feed.posts).map((item) => item.id));
    setPosts(feed.posts);
    setStatus('ready');

    if (failing.current) markReconnected();
    failing.current = false;
    if (loadQueue().length > 0) void flushOutbox();
  }, []);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    poll();
    const timer = window.setInterval(poll, COMMUNITY_LIMITS.pollIntervalMs);
    document.addEventListener('visibilitychange', poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [refresh]);

  return { posts, status, refresh };
}
