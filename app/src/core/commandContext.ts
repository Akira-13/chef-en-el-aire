// Contexto actual de la interfaz (pantalla, paso, temporizadores). Lo escriben las pantallas
// y lo lee la ayuda contextual para decir qué comandos y gestos valen ahora (RF-14).

import { create } from 'zustand';
import type { CommandContext, ScreenId } from '@chef/shared';

const initialContext: CommandContext = { screen: 'home', activeTimers: [], alertActive: false };

export const useCommandContext = create<CommandContext>(() => initialContext);

export function getCommandContext(): CommandContext {
  return useCommandContext.getState();
}

/** Cambia de pantalla y descarta el contexto de la pantalla anterior. */
export function enterScreen(screen: ScreenId, extra: Partial<CommandContext> = {}): void {
  useCommandContext.setState({ ...initialContext, ...extra, screen }, true);
}

/** Actualiza parte del contexto sin cambiar de pantalla. */
export function updateCommandContext(patch: Partial<CommandContext>): void {
  useCommandContext.setState(patch);
}
