# Parte 4 · Auditorías: PWA, accesibilidad y navegadores

**Proyecto:** Chef en el Aire, cocina manos libres
**Fecha de la revisión:** 23/11/2026
**Rama:** `amir-2`
**Referencias:** RF-24 a RF-27 (canales, sonido, ARIA), RNF-07 (contraste), RNF-08 (objetivos táctiles y foco), RNF-10 (sin conexión).

> **Método.** Esta es una revisión estática del código: se leyeron las pantallas, los componentes de `ui/`, los tokens de `theme/tokens.css` y la configuración de `vite.config.ts`. No se usó navegador, así que nada de lo que depende de la pantalla, el lector de pantalla, el teclado o el teléfono está marcado como cumplido sin prueba. Esos casos aparecen como **Revisar en dispositivo**. Los contrastes se calcularon con la fórmula WCAG 2.1 sobre los valores de `tokens.css`.

---

## 1. PWA

| Indicador | Resultado | Estado |
|---|---|---|
| Lighthouse móvil | Pendiente de medir por el humano | Pendiente |
| Manifest | Completo según `app/vite.config.ts`: `name`, `short_name`, `lang: es`, `start_url` y `scope` en `/`, `display: standalone`, `orientation: portrait`, `theme_color` y `background_color` en `#fff8f0`, íconos de 192 y 512 px y un ícono `maskable` de 512 px. Los archivos existen en `app/public/icons/`. | Completo (por código) |
| Tamaño del bundle | Antes: 120 kB gzip. Después: ≈109 kB gzip (Perfil 4,5 kB y Celebración 1,2 kB en chunks aparte; la Comunidad sigue en el principal por una importación de `assistant/`) | Pendiente |
| Sin conexión | Pendiente de prueba en teléfono (modo cocina con la red apagada y recetas en caché) | Pendiente |

---

## 2. WCAG 2.1 AA

Cada celda da el veredicto por pantalla. Las notas que siguen la tabla dan la base de cada uno.

| Criterio | Inicio | Receta | Cocina | Celebración | Perfil | Comunidad | Bienvenida |
|---|---|---|---|---|---|---|---|
| 1.1.1 Contenido no textual | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple |
| 1.3.1 Información y relaciones | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple |
| 1.4.3 Contraste (texto) | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple |
| 1.4.11 Contraste (no textual) | **Incumple** | Cumple | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Cumple |
| 1.4.4 / 1.4.10 Redimensionar y reflujo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo |
| 2.1.1 Teclado | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo |
| 2.4.3 / 2.4.7 Orden de foco y foco visible | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo |
| 2.5.5 Tamaño del objetivo (AAA, se usa como referencia) | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple |
| 3.3.1 Identificación de errores | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple |
| 3.3.2 Etiquetas o instrucciones | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple | Cumple |
| 4.1.2 Nombre, función y valor | Cumple | Cumple | Revisar en dispositivo | Cumple | **Incumple** | Revisar en dispositivo | Cumple |
| 4.1.3 Mensajes de estado | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo | Revisar en dispositivo |

### Notas por pantalla

- **Inicio.** 1.4.11: `.searchInput` tiene el borde transparente. Sobre el crema queda blanco contra `#fff8f0`, con un contraste de unos 1,05:1, y solo la sombra marca el límite del campo. Los chips de tiempo (`.timeChip`) tienen el mismo problema, aunque su texto los identifica. 4.1.3: «Cargando recetas» y «No encontré recetas» son `role="status"` o `role="alert"`, pero se insertan ya con texto; hay que comprobar que el lector los anuncie. Los encabezados (`h1` del saludo, `h2` de secciones) y las etiquetas del buscador están bien.
- **Receta.** Encabezados correctos y el bloque de alérgenos tiene `aria-labelledby`. El estado sin receta no tiene `h1` (ver hallazgo A3). El contraste de la advertencia (acento sobre blanco, 4,74:1) cumple.
- **Cocina.** El nombre de la receta va en un `h1` oculto y el paso se anuncia por la región de `output` (`aria-live`). Los botones de navegación tienen `aria-label`. El pie del modo cocina (`--color-on-dark` sobre `--color-cork`, 4,54:1) cumple con poco margen. Los controles de voz y cámara del encabezado tienen un problema de nombre (ver «Para el dueño»).
- **Celebración.** Calificación con `aria-pressed` y etiqueta fija, correcto. Blanco sobre `--color-primary` da 4,51:1: cumple, con el margen mínimo. Los botones de 64 px cumplen el tamaño.
- **Perfil.** 4.1.2: las estrellas del historial son un `span` con `aria-label` y sin rol (`ProfileSections.tsx`, línea 215). El nombre accesible no se anuncia en ese elemento, así que el valor de la valoración se pierde para el lector. Hay que corregirlo en el dueño de `profile/`.
- **Comunidad.** 4.1.2: el botón «Aplaudir» usa `aria-pressed` y cambia la etiqueta a «Aplaudiste» (ver «Para el dueño»). 2.4.3: al aplaudir, el botón queda `disabled` y puede perder el foco. El formulario de comentario y el alias tienen etiquetas y `aria-invalid` con `role="alert"`, por lo que 3.3.1 y 3.3.2 cumplen.
- **Bienvenida.** Cada paso que pide voz o gesto tiene el botón «Continuar» como alternativa táctil (RF-24). Un `h1` por paso.

---

## 3. Hallazgos

### A. Carpetas propias (`screens/`, `ui/`, `theme/`, `cooking/`)

Los hallazgos de esta lista no se corrigen en esta revisión; se describen para el otro agente o el dueño.

| # | Severidad | Criterio | Ubicación | Hallazgo y corrección sugerida |
|---|---|---|---|---|
| A1 | Alta | 1.4.11 | `app/src/screens/screens.module.css`, `.searchInput` | Campo de búsqueda sin borde visible (`border: 2px solid transparent`) sobre fondo crema, contraste ≈1,05:1. Corregir con un borde de 2 px en `var(--color-text-2)` (6,2:1 sobre el crema). **Corregido.** |
| A2 | Media | 1.4.4 / 1.4.10 | `app/src/cooking/cooking.module.css`, `.bar` | La barra de temporizadores es un desplazamiento horizontal con la barra oculta (`scrollbar-width: none`). A 360 px con varios temporizadores, los que quedan fuera no se ven ni hay indicio de que existan. Corregir con un ajuste de línea o un indicador de más elementos. **Corregido.** |
| A3 | Baja | 1.3.1 | `RecipeScreen.tsx` (rama `!recipe`) y `CookingScreen.tsx` (rama `!recipe \|\| !step`) | Los estados de carga y de error no tienen `h1`; solo el título del documento identifica la pantalla. Añadir un `h1` visualmente oculto en esas ramas. **Corregido.** |
| A4 | Media | 1.1.1 | `RecipeScreen.tsx` («👩‍🍳 Empezar a cocinar», «⚠️ Cuidado» en `h2`), `HomeScreen.tsx` («📲 Instalar la app»), `CookingScreen.tsx` (pista «🎙️ voz · ✋ gesto · toque» y «⏱ Iniciar …») | Los emojis dentro de textos visibles los lee el lector de pantalla por su nombre. Envolver cada emoji decorativo en un `<span aria-hidden="true">`. **Corregido.** |
| A5 | Baja | 1.4.3 (margen) | `app/src/theme/tokens.css` | Varios pares cumplen 4,5:1 con poco margen: blanco sobre `--color-primary` (4,51:1), acento `#c24f1c` como texto sobre crema (4,50:1) y `--color-on-dark` sobre `--color-cork` (4,54:1). No se encontró ningún par que incumpla. Los tokens `--color-have` y `--color-substitute` dan 4,27 a 4,30:1 como texto sobre crema, así que no deben usarse como color de texto sin fondo oscuro. No cambiar los valores sin revisar el contraste otra vez. |
| A6 | Baja | 2.4.3 / 4.1.2 | `app/src/cooking/TimerHost.tsx`, `TimerAlert` | El diálogo `alertdialog` con `aria-modal` en pantalla completa mueve el foco al botón «Listo», pero no lo retiene: el Tab puede salir al contenido que queda detrás. Confirmar en dispositivo y, si es así, retener el foco dentro del diálogo. **Corregido.** |
| A7 | Revisar | 1.4.11 | `app/src/screens/screens.module.css`, `.timeChip` | Los chips de tiempo no tienen borde; sobre el crema el fondo tiene ≈1,05:1. El texto los identifica, pero conviene decidir si basta. **Corregido.** |

Se revisaron y no se encontraron incumplimientos en: los objetivos táctiles (todos los botones tienen `min-height` de 44 px o más, y los `IconButton` son de 48 px o más), los `aria-label` de los `IconButton`, el orden de encabezados en las pantallas, `prefers-reduced-motion`, el foco visible global (`:focus-visible` con 3 px) y el tamaño del texto del paso (2 rem, 32 px).

### Para el dueño

| Carpeta (dueño) | Pantalla | Criterio | Hallazgo y corrección sugerida |
|---|---|---|---|
| `profile/ProfileSections.tsx`, línea 215 (Aarón) | Perfil | **4.1.2 Incumple** | `<span aria-label="N de 5">` con estrellas sin rol: el `aria-label` no se anuncia en un elemento genérico. Usar `role="img"` con el `aria-label`, o texto visible oculto («4 de 5»). |
| `profile/profile.module.css`, `.persona` (Aarón) | Perfil | 1.4.11 Revisar | El borde de cada persona es transparente sin seleccionar. La selección se ve al marcarla, pero la tarjeta sin marcar no tiene límite visible. |
| `community/CommunityScreen.tsx`, botón «Aplaudir» (Comunidad) | Comunidad | 4.1.2 Revisar; 2.4.3 Revisar | Combina `aria-pressed` con una etiqueta que cambia a «Aplaudiste», y queda `disabled` al aplaudir, lo que puede hacer perder el foco. Dejar una sola forma de estado (etiqueta fija con `aria-pressed`, o etiqueta cambiante sin `aria-pressed`) y mover el foco a un elemento estable. |
| `community/CommunityScreen.tsx`, botón «Comentar» (Comunidad) | Comunidad | 4.1.2 (menor) | Tiene `aria-expanded` pero no `aria-controls` hacia el formulario. |
| `input/ChannelStatus.tsx`, líneas 59 a 83 (Jarem) | Cocina, y todas las pantallas que muestran el estado de canales | 4.1.2 Revisar | Los botones de voz y de cámara combinan `aria-pressed` con una etiqueta que cambia («Activar voz» / «Desactivar voz», «Encender cámara» / «Apagar cámara»). Revisar la combinación con el lector; una etiqueta fija («Voz», «Cámara») con `aria-pressed` es suficiente. |
| `output/index.ts`, función `region` (Jarem) | Todas | 4.1.3 Revisar | Las regiones `aria-live` se crean al primer anuncio y se añaden a `body`. Algunos lectores no anuncian regiones creadas después de cargar la página. Confirmar en el teléfono que «Paso N», los temporizadores y las alertas se oyen. |
| `assistant/AssistantPanel.tsx`, líneas 359 a 362 (Akira) | Cocina | 2.5.3 (menor) | El botón visible dice «Más» y su `aria-label` es «Más: explícame este paso». El nombre empieza con el texto visible, así que cumple, pero «Más» es ambiguo a la vista. Un texto visible como «Explicar» sería más claro. |

---

## 4. Navegadores

Matriz pendiente de la prueba humana. Ninguna celda está verificada.

| Pantalla | Chrome Android | Chrome escritorio | Edge escritorio | Safari |
|---|---|---|---|---|
| Inicio | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana |
| Receta | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana |
| Cocina | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana |
| Celebración | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana |
| Perfil | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana |
| Comunidad | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana |
| Bienvenida | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana | Pendiente de prueba humana |

**Limitación de Safari sin voz.** La entrada por voz usa `SpeechRecognition` o `webkitSpeechRecognition` (`app/src/input/voice/recognizer.ts`, línea 50). Safari no ofrece reconocimiento de voz en la web de forma fiable, sobre todo en iOS. En ese caso la voz no está disponible, y la aplicación debe seguir funcionando con gestos y toque (RF-24). Falta comprobar que el control de voz se oculte o se explique cuando `voiceAllowed` es falso. Tampoco hay `navigator.vibrate` en Safari, así que la alerta de temporizador pierde la vibración; el destello visual y el sonido cubren el equivalente (RF-26), pero hay que comprobarlo.

---

## 5. Pendientes para cerrar la auditoría

1. Medir Lighthouse móvil y el tamaño del bundle, y completar la tabla de la sección 1.
2. Probar en un teléfono Android con Chrome, por el túnel HTTPS: lector de pantalla (TalkBack), zoom al 200 %, teclado externo, modo sin conexión y la alerta de temporizador.
3. Corregir A1 y A3 a A4 (carpetas propias) y los hallazgos de la sección «Para el dueño» en sus carpetas.
4. Completar la matriz de navegadores de la sección 4.
