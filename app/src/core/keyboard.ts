// Canal de teclado: atajos para navegar sin ratón (RNF-08). Se ignoran mientras se escribe
// en un campo de texto o con teclas modificadoras.

import type { Command } from '@chef/shared';
import { commandBus } from './commandBus';

const KEY_COMMANDS: Record<string, Command> = {
  ArrowRight: { type: 'next' },
  ArrowLeft: { type: 'previous' },
  r: { type: 'repeat' },
  p: { type: 'pause' },
  c: { type: 'resume' },
  t: { type: 'startTimer' },
  h: { type: 'help' },
  Escape: { type: 'dismissAlert' },
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function startKeyboardInput(): () => void {
  function onKeyDown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;
    const command = KEY_COMMANDS[event.key];
    if (!command) return;
    event.preventDefault();
    commandBus.emit(command, 'keyboard');
  }
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
