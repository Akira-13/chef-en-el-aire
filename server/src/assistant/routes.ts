// Rutas del asistente (adaptar, preguntar, explicar). Mientras no haya un proveedor conectado,
// todas responden "no disponible" y la interfaz sigue con la receta original (RF-10).

import { Router } from 'express';
import { ASSISTANT_UNAVAILABLE_MESSAGE, type AssistantUnavailable } from '@chef/shared';

const unavailable: AssistantUnavailable = {
  status: 'unavailable',
  message: ASSISTANT_UNAVAILABLE_MESSAGE,
};

export const assistantRouter = Router();

assistantRouter.post(['/adapt', '/ask', '/explain'], (_req, res) => {
  res.status(503).json(unavailable);
});
