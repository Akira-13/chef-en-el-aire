// Aviso de canal caído con sugerencia del canal alterno (RNF-15, CA-21.3, CA-35.1).

import { metrics } from '../core/metrics';
import { output } from '../core/services';

export type FallbackReason =
  'unsupported' | 'not-allowed' | 'network' | 'offline' | 'camera' | 'model';

const MESSAGES: Record<FallbackReason, string> = {
  unsupported: 'Este navegador no reconoce la voz. Usa gestos o toca la pantalla.',
  'not-allowed': 'No tengo permiso para usar el micrófono. Usa gestos o toca la pantalla.',
  network: 'La voz necesita internet. Mientras tanto, usa gestos o toca la pantalla.',
  offline: 'Sin internet la voz no funciona. Usa gestos o toca la pantalla.',
  camera: 'No puedo usar la cámara. Usa la voz o toca la pantalla.',
  model: 'No pude cargar los gestos. Usa la voz o toca la pantalla.',
};

/** Avisa y registra cuánto tardó el aviso desde `since` (performance.now()). */
export function reportFallback(reason: FallbackReason, since: number): void {
  output.cue('error');
  output.announce({ text: MESSAGES[reason], kind: 'error' });
  metrics.record('channel.fallback', performance.now() - since, 'ms', { reason });
}
