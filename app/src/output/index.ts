// Salida multimodal: regiones ARIA (RF-27), voz (RF-15), subtítulos (RF-26) y sonidos.
// core/services.ts crea el servicio al cargar: este módulo no debe importar core/services ni
// componentes que lo usen, o se forma un ciclo de imports.

import type { Announcement, OutputDeps, OutputService } from '../core/contracts';
import { playCue } from './sounds';
import { speak, stopSpeaking, textFor, wantsAudio, wantsSubtitles } from './speech';
import { clear, showCaption, showFlash } from './store';

export { showGestureNotice, showHint } from './store';

type Politeness = 'polite' | 'assertive';

/** Tiempo de lectura de un subtítulo sin audio. */
function readingTimeMs(text: string): number {
  return 4000 + text.length * 60;
}

export function createOutputService(deps: OutputDeps): OutputService {
  const regions = new Map<Politeness, HTMLElement>();

  function region(politeness: Politeness): HTMLElement {
    let element = regions.get(politeness);
    if (!element) {
      element = document.createElement('div');
      element.setAttribute('aria-live', politeness);
      element.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
      element.className = 'visually-hidden';
      document.body.append(element);
      regions.set(politeness, element);
    }
    return element;
  }

  function announceAria({ kind }: Announcement, text: string): void {
    const target = region(kind === 'alert' || kind === 'error' ? 'assertive' : 'polite');
    // Vaciar y volver a escribir hace que el lector repita aunque el texto sea el mismo.
    target.textContent = '';
    window.setTimeout(() => {
      target.textContent = text;
    }, 50);
  }

  return {
    announce(announcement: Announcement) {
      const prefs = deps.getProfile().accessibility;
      const text = textFor(announcement, prefs.verbosity);
      announceAria(announcement, text);

      const subtitles = wantsSubtitles(prefs);
      if (wantsAudio(prefs)) {
        let captionId: number | undefined;
        const spoken = speak(text, {
          volume: prefs.volume ?? 1,
          // Un paso nuevo corta la lectura del anterior.
          interrupt: announcement.kind === 'step',
          onStart: () => {
            if (subtitles) captionId = showCaption(text, null);
          },
          onEnd: () => clear('caption', captionId),
        });
        if (spoken) return;
      }
      if (subtitles) showCaption(text, readingTimeMs(text));
    },

    cue(kind) {
      const prefs = deps.getProfile().accessibility;
      showFlash(kind);
      if (prefs.outputs.includes('audio')) playCue(kind, prefs.volume ?? 1);
    },

    stop() {
      stopSpeaking();
      clear('caption');
    },
  };
}
