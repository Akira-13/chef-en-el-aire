# Diseño e interacción

Aporte del Integrante 4. Ver la justificación completa en [`docs/09-alternativas-diseno.md`](../docs/09-alternativas-diseno.md).

**Prototipo en Penpot:** enlace pendiente (pegar aquí el link de "Compartir" del archivo en `design.penpot.app`).

## Contenido

- **`bocetos/`** — las 3 alternativas de diseño (misma pantalla crítica, "modo cocina", en tres enfoques de interacción distintos):
  - `alternativa-a-voz-primero.png` — tarjeta única, voz como canal principal.
  - `alternativa-b-gestos-camara.png` — panel de cámara siempre visible, gestos como canal principal.
  - `alternativa-c-tablero-calido.png` — tablero ilustrado, los tres canales (voz/gesto/toque) en igualdad, con presencia multiusuario. **Alternativa elegida.**
- **`prototipo/`** — prototipo de fidelidad media de la Alternativa C, navegable dentro de Penpot (interacciones de click conectando las 6 pantallas):
  1. `1-inicio.png` — sugerencias del día, búsqueda, despensa.
  2. `2-receta-detalle.png` — ingredientes (tengo/falta/sustituir), adaptar con IA.
  3. `3-modo-cocina.png` — paso a paso con voz/gestos/toque, temporizador, multiusuario.
  4. `4-sala-multiusuario.png` — participantes, modo juntos/a mi ritmo.
  5. `5-perfil.png` — accesibilidad y "lo que aprendí de ti" (transparencia del perfil).
  6. `6-celebracion.png` — cierre emocional (nivel reflexivo de Norman).
  - `diagrama-interacciones.png` — mapa de navegación entre las 6 pantallas.

## Cómo se construyó

El prototipo se generó con IA conectada directamente a Penpot (open source) vía su servidor MCP — ver la nota de herramientas en [`reparto-PC2-CC451.md`](../reparto-PC2-CC451.md). Las capturas en este repo son una referencia estática; el archivo real en Penpot tiene las interacciones de navegación cableadas (click → pantalla destino) para la simulación del flujo.
