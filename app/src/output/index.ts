// Salida multimodal. Esta versión solo publica los mensajes en regiones ARIA para que los
// lectores de pantalla los anuncien (RF-27); voz, subtítulos y sonidos se agregan aquí.
// core/services.ts crea el servicio al cargar: este módulo no debe importar core/services ni
// componentes que lo usen, o se forma un ciclo de imports.

import type { Announcement, OutputDeps, OutputService } from '../core/contracts';

type Politeness = 'polite' | 'assertive';

export function createOutputService(_deps: OutputDeps): OutputService {
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

  return {
    announce({ text, kind }: Announcement) {
      const target = region(kind === 'alert' || kind === 'error' ? 'assertive' : 'polite');
      // Vaciar y volver a escribir hace que el lector repita aunque el texto sea el mismo.
      target.textContent = '';
      window.setTimeout(() => {
        target.textContent = text;
      }, 50);
    },
    cue() {},
    stop() {},
  };
}
