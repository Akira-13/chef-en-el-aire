// Emoji de cada aviso visual (RF-39). Cada acción tiene el suyo: la dirección del emoji dice
// hacia dónde se va, para entender el aviso sin leer ni oír nada.

import type { CueKind } from '../core/contracts';

export const CUE_ICONS: Record<CueKind, string> = {
  success: '✅',
  error: '❌',
  gesture: '✋',
  next: '➡️',
  previous: '⬅️',
  repeat: '🔁',
  listening: '🎙️',
  pause: '⏸️',
  resume: '▶️',
  timer: '⏱',
  celebration: '🎉',
};
