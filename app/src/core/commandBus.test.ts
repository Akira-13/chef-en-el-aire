import { describe, expect, it, vi } from 'vitest';
import { commandBus } from './commandBus';

describe('commandBus', () => {
  it('entrega el mismo comando sin importar el canal (RF-12)', () => {
    const received: string[] = [];
    const unsubscribe = commandBus.subscribe((event) =>
      received.push(`${event.command.type}:${event.channel}`),
    );
    commandBus.emit({ type: 'next' }, 'voice', { confidence: 0.9 });
    commandBus.emit({ type: 'next' }, 'gesture');
    commandBus.emit({ type: 'next' }, 'touch');
    unsubscribe();
    expect(received).toEqual(['next:voice', 'next:gesture', 'next:touch']);
  });

  it('deja de notificar al cancelar la suscripción', () => {
    const handler = vi.fn();
    const unsubscribe = commandBus.subscribe(handler);
    unsubscribe();
    commandBus.emit({ type: 'pause' }, 'keyboard');
    expect(handler).not.toHaveBeenCalled();
  });
});
