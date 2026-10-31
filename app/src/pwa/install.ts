// Oferta de instalación de la PWA (CA-34.1). Chrome avisa una sola vez y puede hacerlo antes de
// que React monte, por eso el evento se captura al cargar este módulo.

import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

const useInstallEvent = create<{ event: BeforeInstallPromptEvent | null }>(() => ({ event: null }));

export function startInstallListener(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    useInstallEvent.setState({ event: event as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstallEvent.setState({ event: null }));
}

/** Devuelve la función que abre el diálogo de instalación, si Chrome la ofrece. */
export function useInstallPrompt(): (() => void) | null {
  const event = useInstallEvent((state) => state.event);
  if (!event) return null;
  return () => {
    void event.prompt();
    useInstallEvent.setState({ event: null });
  };
}
