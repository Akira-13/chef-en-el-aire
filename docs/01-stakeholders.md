# 01 · Análisis de stakeholders

**Proyecto:** Chef en el Aire, cocina manos libres
**Responsable:** Diego García

---

## 1. Cómo identificamos a los stakeholders

Se siguieron estos tres pasos:

1. **Recorrido de la actividad real.** Qué pasa en una cocina desde que se decide qué cocinar hasta servir el plato, y quién interviene o se ve afectado en cada momento.
2. **Modelo por capas.** Cada actor se ubica por su cercanía al sistema: primarios (lo usan con las manos ocupadas), secundarios (interactúan de forma indirecta u ocasional), terciarios (afectados por su éxito o fracaso) y facilitadores (lo construyen o lo hacen posible).
3. **Preguntarnos "¿quién no puede usar esto como lo imaginamos?".** La idea original asume manos libres, habla clara, oído y vista a 1,5 m; cada suposición excluye a alguien, y por eso los usuarios con discapacidad son **usuarios primarios**.

---

## 2. Mapa de stakeholders (modelo por capas)

Cuatro capas, de mayor a menor cercanía al sistema:

- **Primarios** (lo usan con las manos ocupadas): novato, experimentado, persona con alergias, adulto mayor, usuarios con discapacidad visual, motriz o auditiva.
- **Secundarios** (interactúan de forma indirecta u ocasional): co-cocinero remoto, acompañante presente, cuidador, niños supervisados.
- **Terciarios** (afectados por su éxito o fracaso): docente/evaluador, creadores de recetas, nutricionistas, familia que come el plato.
- **Facilitadores** (lo construyen o lo hacen posible): equipo de desarrollo, proveedores de LLM, MediaPipe / navegadores, hosting.

El detalle de cada actor está en la tabla de §3 (S01–S16).

---

## 3. Tabla de stakeholders

| ID | Stakeholder | Categoría | Objetivos / necesidades | Limitaciones relevantes |
|---|---|---|---|---|
| S01 | Cocinero novato | Primario | Seguir una receta sin perderse; saber "cuándo está listo"; resolver dudas al momento | Desconoce términos ("sofreír", "a punto"); ansiedad ante el error |
| S02 | Cocinero doméstico experimentado | Primario | Rapidez; adaptar recetas a lo que tiene; no ser interrumpido con explicaciones obvias | Poca paciencia con asistentes verbosos |
| S03 | Persona con alergias o restricciones alimentarias | Primario | Garantía de que la receta adaptada no contiene su alérgeno; sustituciones fiables | Un error del sistema tiene consecuencia física |
| S04 | Usuario con discapacidad motriz (artritis, temblor, movilidad reducida de brazos, silla de ruedas) | Primario | Controlar el sistema sin gestos finos ni tocar la pantalla | Gestos amplios o sostenidos causan dolor o no son posibles; alcance limitado |
| S05 | Usuario con discapacidad visual (baja visión o ceguera) | Primario | Recibir los pasos y temporizadores por audio; ubicar el estado sin mirar | La "superposición grande" no basta; los gestos no tienen retroalimentación visible para él |
| S06 | Usuario con discapacidad auditiva | Primario | Enterarse de alarmas y respuestas sin depender del sonido | No oye el temporizador ni la respuesta hablada del asistente |
| S07 | Usuario con discapacidad del habla (disartria, tartamudez, persona sorda con habla poco inteligible) | Primario | Controlar el sistema sin depender del reconocimiento de voz | El reconocimiento de voz falla o lo frustra; los tiempos de espera cortos lo excluyen |
| S08 | Adulto mayor | Primario | Tipografía grande, pocos pasos de configuración, sensación de control | Menor familiaridad tecnológica; posible disminución de vista, oído o destreza |
| S09 | Co-cocinero remoto (familiar o amigo) | Secundario | Cocinar "juntos" a distancia, ver en qué paso va el otro, ayudar | Conexión variable; puede tener otro dispositivo |
| S10 | Acompañante presente, cuidador, niño supervisado | Secundario | Ayudar sin interferir; en el caso del cuidador, configurar el perfil de otra persona | Puede activar comandos sin querer (gestos o voz ajenos) |
| S11 | Equipo de desarrollo | Facilitador | Arquitectura mantenible, poder cambiar de proveedor de LLM | Tiempo y presupuesto académico |
| S12 | Proveedores de LLM (comerciales o locales) | Facilitador | Uso de su API dentro de sus políticas | Costos, latencia, posibles "alucinaciones" |
| S13 | Plataforma (MediaPipe, navegadores, sistema operativo) | Facilitador | — | Rendimiento de la cámara y del modelo de manos en equipos modestos; permisos de cámara y micrófono |
| S14 | Docente / evaluador del curso | Terciario | Evidencia de proceso de diseño centrado en el usuario | Rúbrica de la PC2 |
| S15 | Creadores de recetas y nutricionistas | Terciario | Que sus recetas se adapten sin desvirtuarse ni volverse inseguras | El LLM puede alterar proporciones o técnica |
| S16 | Quienes comen el plato (familia) | Terciario | Comida segura y rica | Pueden tener alergias distintas a las del cocinero |

---

## 4. Diferencias entre tipos de usuario

La diferencia principal no está en "cuánto saben de cocina", sino en **qué canales de entrada y salida pueden usar**. Aquí se comparan los canales; las características físicas de cada grupo y su consecuencia para el sistema se detallan en el [análisis PACT](02-pact.md) (§P · People). Esta tabla es la base de muchas decisiones posteriores:

| Tipo de usuario | Entrada por voz | Entrada por gestos | Entrada táctil | Salida visual | Salida por audio | Riesgo principal si no se considera |
|---|---|---|---|---|---|---|
| Novato (S01) | Sí | Sí | Sí, pero manos sucias | Sí | Sí | Abandona la receta a mitad |
| Experimentado (S02) | Sí | Sí | Sí, pero manos sucias | Sí | Sí, pero breve | Deja de usar la app por lenta o habladora |
| Alergias (S03) | Sí | Sí | Sí | Sí | Sí | **Daño a la salud** por sustitución insegura |
| Motriz (S04) | **Sí (canal principal)** | Limitada: solo gestos simples y cortos | Difícil | Sí | Sí | Dolor o imposibilidad de controlar la app |
| Visual (S05) | **Sí (canal principal)** | Posible, pero sin ver la confirmación | Con lector de pantalla | Limitada o nula | **Sí (canal principal)** | No sabe en qué paso está ni cuánto falta |
| Auditiva (S06) | Variable | **Sí** | Sí | **Sí (canal principal)** | No | No se entera de que el temporizador terminó (comida quemada) |
| Habla (S07) | **No fiable** | **Sí (canal principal)** | Sí | Sí | Sí | Frustración porque "la app no le entiende" |
| Adulto mayor (S08) | Sí | Sí, pero con aprendizaje | Sí | Sí, en tamaño grande | Sí, volumen alto | Se siente torpe y deja de usarla |

**Conclusión del análisis:** no existe un único canal que sirva a todos. La voz excluye a S07, los gestos complican a S04, la pantalla excluye a S05 y el audio excluye a S06. Por eso el sistema debe ser **multimodal y redundante**: toda acción importante debe poder hacerse por al menos dos canales, y toda información crítica debe comunicarse por al menos dos canales de salida.

---

## 5. Cómo cada tipo de usuario cambia decisiones concretas de diseño

Cada grupo obliga a un cambio concreto en el diseño. El desarrollo de estas decisiones está en el [análisis PACT](02-pact.md): las diferencias físicas, psicológicas y sociales de las personas en **§P · People** y la traducción de cada actividad en decisión de diseño en **§A · Activities**.

| Grupo | Qué cambia en el diseño | Detalle en el PACT |
|---|---|---|
| Novato (S01) | Explicación ampliable por paso y señales concretas de "cuándo está listo" | §A · A5, A7 |
| Experimentado (S02) | Modo "breve" configurable, aprendido del uso | §P · psicológicas |
| Alergias (S03) | Validación local de alérgenos que bloquea la receta, con confirmación explícita | §A · A3 |
| Motriz (S04) | Vocabulario de gestos reducido; la voz cubre el 100 % de las funciones | §P · físicas; §A · A5 |
| Visual (S05) | Audio como canal principal; confirmación sonora de gestos; ARIA y alto contraste | §P · físicas; §A · A5, A6 |
| Auditiva (S06) | Equivalente visual de todo sonido; celebración sin música | §P · físicas; §A · A9 |
| Habla (S07) | Gestos y táctil cubren todas las acciones; voz desactivable | §P · físicas |
| Adulto mayor (S08) | Onboarding corto y tipografía grande por defecto | §P · físicas; §A · A1 |
| Co-cocinero remoto (S09) | Salas con código corto, indicador de paso por participante y resincronización | §A · A8 |
| Acompañante y cuidador (S10) | Gesto de activación; el cuidador configura el perfil desde otro dispositivo | §A · A8 |
| Facilitadores (S11–S13) | Capa de abstracción del LLM; procesamiento local; PWA sin conexión | §T · Technologies |
| Recetas y comensales (S15–S16) | La receta original se conserva y los cambios se marcan | §A · A3 |

---

## 6. Conflictos entre stakeholders y cómo se resuelven

| Conflicto | Stakeholders | Resolución propuesta |
|---|---|---|
| El usuario con discapacidad visual necesita mucho audio; el experimentado quiere silencio | S05 vs S02 | Verbosidad configurable por perfil, no un valor global |
| La voz es el canal ideal para S04 pero el peor para S07 | S04 vs S07 | Ningún canal es obligatorio: redundancia voz + gestos + táctil, con canal preferido en el perfil |
| La cámara permanente da control por gestos pero preocupa la privacidad | S01–S08 vs S13 | Procesamiento local, indicador visible de cámara activa y botón/comando para apagarla |
| El LLM aporta creatividad, pero la seguridad alimentaria exige determinismo | S03, S16 vs S12 | Validación de alérgenos con reglas locales después del LLM |
| El co-cocinero remoto quiere ir a su ritmo; el anfitrión quiere ir juntos | S09 | Modo "sincronizado" o "libre" elegido al crear la sala |
| El acompañante presente puede activar gestos sin querer | S10 vs usuario principal | Gesto de activación y bloqueo temporal de gestos por voz |

