// Estado visual de la salida, compartido entre el servicio y OutputLayer.

import { create } from 'zustand';
import type { CueKind } from '../core/contracts';

interface Timed {
  id: number;
}

export interface Caption extends Timed {
  text: string;
}

export interface Flash extends Timed {
  kind: CueKind;
}

export interface GestureNotice extends Timed {
  label: string;
}

interface OutputState {
  caption: Caption | null;
  flash: Flash | null;
  gestureNotice: GestureNotice | null;
}

export const useOutputStore = create<OutputState>(() => ({
  caption: null,
  flash: null,
  gestureNotice: null,
}));

const FLASH_MS = 700;
const GESTURE_NOTICE_MS = 1500;

let nextId = 1;
const timers = new Map<keyof OutputState, number>();

function show<K extends keyof OutputState>(
  key: K,
  value: Omit<NonNullable<OutputState[K]>, 'id'>,
  durationMs: number | null,
): number {
  const id = nextId++;
  useOutputStore.setState({ [key]: { ...value, id } } as Partial<OutputState>);
  window.clearTimeout(timers.get(key));
  if (durationMs !== null) {
    timers.set(
      key,
      window.setTimeout(() => clear(key, id), durationMs),
    );
  }
  return id;
}

/** Quita el elemento si sigue siendo el mismo que se mostró con `id`. */
export function clear(key: keyof OutputState, id?: number): void {
  const current = useOutputStore.getState()[key];
  if (!current || (id !== undefined && current.id !== id)) return;
  useOutputStore.setState({ [key]: null } as Partial<OutputState>);
}

/** Muestra un subtítulo; sin duración queda visible hasta que se llame a `clear`. */
export function showCaption(text: string, durationMs: number | null): number {
  return show('caption', { text }, durationMs);
}

export function showFlash(kind: CueKind): void {
  show('flash', { kind }, FLASH_MS);
}

/** Aviso de gesto reconocido, por ejemplo "Gesto: Siguiente" (CA-16.1). */
export function showGestureNotice(label: string): void {
  show('gestureNotice', { label }, GESTURE_NOTICE_MS);
}
