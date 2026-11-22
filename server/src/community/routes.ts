// Rutas de la Comunidad (RF-33 a RF-37). Es REST sin tiempo real: el cliente consulta cada pocos
// segundos. Todo error de validación es `400 { error }` en español y nunca expone trazas.

import { Router, type Response } from 'express';
import { COMMUNITY_UNAVAILABLE_MESSAGE } from '@chef/shared';
import { parseDeviceKey, parseNewComment, parseNewPost } from './schemas';
import type { CommunityStore } from './store';

const NOT_FOUND = 'La publicación no existe.';

function reject(res: Response, error: string, status = 400): void {
  res.status(status).json({ error });
}

/** Recibe el almacén o una función que lo entrega: así se crea al primer pedido y no al arrancar. */
export function createCommunityRouter(source: CommunityStore | (() => CommunityStore)): Router {
  const router = Router();
  const store = () => (typeof source === 'function' ? source() : source);

  router.get('/posts', (_req, res) => {
    res.json(store().getFeed());
  });

  router.post('/posts', async (req, res) => {
    const parsed = parseNewPost(req.body);
    if (!parsed.ok) return reject(res, parsed.error);
    const { post, created } = await store().createPost(parsed.data);
    res.status(created ? 201 : 200).json(post);
  });

  router.post('/posts/:id/comments', async (req, res) => {
    const parsed = parseNewComment(req.body);
    if (!parsed.ok) return reject(res, parsed.error);
    const result = await store().addComment(req.params.id, parsed.data);
    if (result.status === 'not-found') return reject(res, NOT_FOUND, 404);
    if (result.status === 'full') {
      return reject(res, 'Esta publicación ya no admite más comentarios.');
    }
    res.status(result.status === 'created' ? 201 : 200).json(result.comment);
  });

  router.post('/posts/:id/applause', async (req, res) => {
    const parsed = parseDeviceKey(req.body);
    if (!parsed.ok) return reject(res, parsed.error);
    const applause = await store().applaud(req.params.id, parsed.data.deviceKey);
    if (applause === undefined) return reject(res, NOT_FOUND, 404);
    res.json({ applause });
  });

  router.delete('/posts/:id', async (req, res) => {
    const parsed = parseDeviceKey(req.body);
    if (!parsed.ok) return reject(res, parsed.error);
    const result = await store().deletePost(req.params.id, parsed.data.deviceKey);
    if (result === 'not-found') return reject(res, NOT_FOUND, 404);
    if (result === 'forbidden') return reject(res, 'Solo quien la publicó puede borrarla.', 403);
    res.status(204).end();
  });

  // Si el disco falla, el cliente recibe "no disponible" y su cola reintenta (RNF-09).
  router.use((_error: unknown, _req: unknown, res: Response, _next: unknown) => {
    reject(res, COMMUNITY_UNAVAILABLE_MESSAGE, 503);
  });

  return router;
}
