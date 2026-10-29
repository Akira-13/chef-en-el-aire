// Bus de comandos: todos los canales de entrada publican aquí y las pantallas se suscriben.
// Así una pantalla no sabe ni le importa si el comando vino por voz, gesto, toque o teclado.

import { useEffect, useRef } from 'react';
import type { Channel, Command, CommandEvent } from '@chef/shared';

type Handler = (event: CommandEvent) => void;

const handlers = new Set<Handler>();

export const commandBus = {
  emit(
    command: Command,
    channel: Channel,
    extra: Pick<CommandEvent, 'confidence' | 'transcript'> = {},
  ): CommandEvent {
    const event: CommandEvent = { command, channel, at: performance.now(), ...extra };
    for (const handler of [...handlers]) handler(event);
    return event;
  },

  subscribe(handler: Handler): () => void {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  },
};

/** Suscribe un componente al bus; el manejador siempre ve el estado más reciente del render. */
export function useCommands(handler: Handler): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => commandBus.subscribe((event) => latest.current(event)), []);
}
