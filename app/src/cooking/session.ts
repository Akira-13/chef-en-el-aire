// Receta en curso. Se guarda en el dispositivo para retomarla en el mismo paso si el sistema
// cierra la pestaña o se recarga la app, incluso sin conexión (RF-44).

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface CookingSession {
  recipeId: string | null;
  stepIndex: number;
}

export const useCookingSession = create<CookingSession>()(
  persist(() => ({ recipeId: null, stepIndex: 0 }) as CookingSession, {
    name: 'chef.cooking',
    storage: createJSONStorage(() => localStorage),
  }),
);

export function savedStepIndex(recipeId: string | undefined): number {
  const session = useCookingSession.getState();
  return session.recipeId === recipeId ? session.stepIndex : 0;
}

export function saveCookingStep(recipeId: string, stepIndex: number): void {
  useCookingSession.setState({ recipeId, stepIndex });
}

export function clearCookingSession(): void {
  useCookingSession.setState({ recipeId: null, stepIndex: 0 });
}
