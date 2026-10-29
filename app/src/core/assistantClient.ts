// Cliente del Gateway LLM. Si la red o el servidor fallan, devuelve "no disponible" en vez de
// lanzar un error, para que la interfaz siga con la receta original (RF-10, CA-35.2).

import {
  ASSISTANT_ROUTES,
  ASSISTANT_UNAVAILABLE_MESSAGE,
  type AdaptRequest,
  type AdaptResponse,
  type AskRequest,
  type AskResponse,
  type AssistantUnavailable,
  type ExplainRequest,
  type ExplainResponse,
} from '@chef/shared';

const unavailable: AssistantUnavailable = {
  status: 'unavailable',
  message: ASSISTANT_UNAVAILABLE_MESSAGE,
};

async function post<TResponse extends { status: string }>(
  url: string,
  body: unknown,
): Promise<TResponse | AssistantUnavailable> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: unknown = await res.json().catch(() => null);
    if (data && typeof data === 'object' && 'status' in data) return data as TResponse;
    return unavailable;
  } catch {
    return unavailable;
  }
}

export const assistantClient = {
  adapt: (request: AdaptRequest) => post<AdaptResponse>(ASSISTANT_ROUTES.adapt, request),
  ask: (request: AskRequest) => post<AskResponse>(ASSISTANT_ROUTES.ask, request),
  explain: (request: ExplainRequest) => post<ExplainResponse>(ASSISTANT_ROUTES.explain, request),
};
