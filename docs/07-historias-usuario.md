# 07 · Historias de usuario

**Proyecto:** Chef en el Aire, cocina manos libres
**Responsable:** Aarón Flores (Integrante 3)
**Base:** Requerimientos `RF-01`–`RF-44` y `RNF-01`–`RNF-18` (Integrante 2), [stakeholders](01-stakeholders.md) (S01–S16) y [PACT](02-pact.md) (A1–A10)

---

## 1. Convenciones

- **IDs definitivos:** `HU-nn`. Cada criterio de aceptación tiene ID `CA-nn.m` (HU `nn`, criterio `m`), para citarlo en la columna *Evidencia/Criterio de Aceptación* de la matriz de trazabilidad.
- **Cubre:** lista los RF y RNF que la historia satisface. Toda la cobertura se resume en la [tabla inversa](#4-cobertura-requerimiento--historia) del final.
- **Prioridad:** la más alta de los requerimientos que cubre (Alta, Media, Baja).
- **Formato:** *Como* (stakeholder) *quiero* (acción) *para* (beneficio). Criterios en *Dado / Cuando / Entonces*.
- **Métricas:** los criterios de los RNF repiten literalmente la métrica del requerimiento.
- **Personas:** se usan los perfiles de [`datos/perfiles.json`](../datos/perfiles.json): Rosa (USR-001, artritis, motriz), Diego (USR-002, novato, alergia al maní), Carmen (USR-003, baja visión) y Javier (USR-004, sordera y habla poco inteligible para el reconocimiento de voz). Las recetas (`REC-nnn`) son las de [`datos/recetas.json`](../datos/recetas.json).
- **Nombres de modos de sala:** "juntos" se guarda como `sincronizado` y "a mi ritmo" como `libre`.

### Resumen

| Épica | Historias |
|---|---|
| E1 · Recetas y despensa | HU-01 a HU-03 |
| E2 · Adaptación con LLM | HU-04 a HU-08 |
| E3 · Modo cocina y temporizadores | HU-09 a HU-12 |
| E4 · Voz | HU-13, HU-14 |
| E5 · Gestos | HU-15 a HU-17 |
| E6 · Accesibilidad (discapacidad) | HU-18 a HU-22 |
| E7 · Personalización continua | HU-23 a HU-26 |
| E8 · Multiusuario | HU-27 a HU-29 |
| E9 · Diseño emocional | HU-30 a HU-33 |
| E10 · PWA y calidad | HU-34 a HU-37 |

---

## 2. Historias de usuario

### E1 · Recetas y despensa

#### HU-01 · Sugerencias personalizadas al abrir la app
**Cubre:** RF-01 · **Prioridad:** Alta · **Stakeholders:** S01, S08 · **Actividad:** A1

> **Como** cocinero novato, **quiero** ver tres recetas sugeridas al abrir la aplicación, **para** decidir rápido qué cocinar sin recorrer un catálogo enorme.

- **CA-01.1** · **Dado** que Diego tiene alergia al maní, nivel novato y 40 minutos disponibles, **cuando** abre la pantalla de inicio, **entonces** ve exactamente 3 recetas, ninguna con maní ni con dificultad mayor a "intermedio", y todas con `tiempo_total_min` ≤ 40.
- **CA-01.2** · **Dado** que la despensa contiene papa amarilla, pollo y cebolla, **cuando** se calculan las sugerencias, **entonces** las recetas que aprovechan más ingredientes de la despensa aparecen primero.
- **CA-01.3** · **Dado** que ninguna receta cumple todos los filtros, **cuando** se muestra el inicio, **entonces** el sistema lo explica y ofrece relajar un filtro (por ejemplo, el tiempo), nunca la restricción de alérgenos.

#### HU-02 · Buscar receta por voz o por texto
**Cubre:** RF-02 · **Prioridad:** Media · **Stakeholders:** S08 · **Actividad:** A1

> **Como** adulto mayor, **quiero** buscar una receta diciendo su nombre o un ingrediente que tengo, **para** no tener que escribir en el celular.

- **CA-02.1** · **Dado** que el usuario está en la pantalla de inicio, **cuando** dice "busca recetas con quinua", **entonces** aparece "Ensalada de quinua" (REC-006) entre los resultados.
- **CA-02.2** · **Dado** que el usuario escribe "lomo" en el buscador, **cuando** confirma, **entonces** aparece "Lomo saltado" (REC-002).
- **CA-02.3** · **Dado** que la búsqueda no tiene resultados, **cuando** termina, **entonces** el sistema lo dice en voz y en texto y propone una receta similar.

#### HU-03 · Registrar mi despensa y ver qué me falta
**Cubre:** RF-03 · **Prioridad:** Media · **Stakeholders:** S01, S02 · **Actividad:** A2

> **Como** cocinero doméstico, **quiero** decirle a la app qué ingredientes tengo y ver cuáles me faltan, **para** saber antes de empezar si puedo cocinar la receta.

- **CA-03.1** · **Dado** que el usuario dice "tengo papa, pollo y ají amarillo", **cuando** el sistema procesa la frase, **entonces** los tres ingredientes se agregan a la despensa del perfil.
- **CA-03.2** · **Dado** que abre "Ají de gallina" (REC-001), **cuando** ve la lista de ingredientes, **entonces** cada uno aparece marcado como "tengo", "falta" o "sustituir" (este último si existe un sustituto en la receta).
- **CA-03.3** · **Dado** que falta la leche evaporada, **cuando** toca o dice "sustituir", **entonces** se ofrece "caldo de pollo + 2 cda de maicena" como alternativa.

---

### E2 · Adaptación con LLM

#### HU-04 · Adaptar una receta a mi alergia, despensa y nivel
**Cubre:** RF-05, RF-04 · **Prioridad:** Alta · **Stakeholders:** S01, S03 · **Actividad:** A3

> **Como** persona con alergias, **quiero** pedir que la receta se adapte a mis restricciones, a lo que tengo y a mi nivel, **para** cocinarla sin riesgo y sin comprar nada más.

- **CA-04.1** · **Dado** que el perfil tiene alergia a frutos secos, **cuando** pide adaptar "Ají de gallina" (REC-001), **entonces** la receta adaptada no contiene "pecanas picadas" y explica el reemplazo.
- **CA-04.2** · **Dado** que pide "para 2 porciones", **cuando** se adapta una receta de 4 porciones, **entonces** todas las cantidades se reducen a la mitad, en unidades caseras (cda, taza, unidad).
- **CA-04.3** · **Dado** que la receta se adapta, **cuando** se guarda, **entonces** conserva la estructura JSON de la receta original (ingredientes con unidades, pasos, tiempos, alérgenos y `pista_listo`), el mismo formato del recetario de ejemplo.

#### HU-05 · Ver qué cambió en la receta adaptada
**Cubre:** RF-06 · **Prioridad:** Alta · **Stakeholders:** S15, S16 · **Actividad:** A3

> **Como** cocinero que cocina para su familia, **quiero** ver la receta original y la adaptada lado a lado, **para** confiar en los cambios y poder volver a la original.

- **CA-05.1** · **Dado** que una receta fue adaptada, **cuando** se abre la vista "antes / después", **entonces** cada ingrediente o paso cambiado aparece resaltado con su motivo (por ejemplo, "leche → caldo + maicena · intolerancia a la lactosa").
- **CA-05.2** · **Dado** que el usuario no está conforme, **cuando** elige "usar original", **entonces** la receta original se muestra intacta, sin cambios.

#### HU-06 · Bloqueo de alérgenos aunque el LLM se equivoque
**Cubre:** RF-07, RNF-06 · **Prioridad:** Alta · **Stakeholders:** S03, S16 · **Actividad:** A3

> **Como** Diego, alérgico al maní con severidad alta, **quiero** que el sistema verifique la receta adaptada con reglas propias, **para** que un error del LLM nunca me haga comer maní.

- **CA-06.1** · **Dado** que el LLM sugiere "salsa de maní" en una adaptación del lomo saltado (REC-002), **cuando** la receta pasa por el validador local, **entonces** queda bloqueada y se muestra una advertencia con el ingrediente y el alérgeno.
- **CA-06.2** · **Dado** que la receta está bloqueada, **cuando** el usuario quiere continuar, **entonces** debe confirmarlo explícitamente (voz "confirmo" o botón dedicado), no con un gesto genérico.
- **CA-06.3 (RNF-06)** · **Dado** el conjunto de prueba de 10 recetas × 4 perfiles, **cuando** se ejecuta el validador sobre todas las adaptaciones, **entonces** se obtiene **100 % de detección (0 falsos negativos)**.

#### HU-07 · Preguntar dudas al asistente mientras cocino
**Cubre:** RF-08, RNF-03 · **Prioridad:** Alta · **Stakeholders:** S01 · **Actividad:** A7

> **Como** cocinero novato, **quiero** preguntar en voz alta "¿puedo usar mantequilla en vez de aceite?" durante un paso, **para** resolver mi duda sin salir de la receta.

- **CA-07.1** · **Dado** que el usuario está en el paso 4 de REC-001, **cuando** pregunta algo, **entonces** la respuesta considera el paso actual y la receta, y ocupa como máximo 2 frases, con la opción "más detalle".
- **CA-07.2 (RNF-03)** · **Dado** que la pregunta se envía al LLM, **cuando** pasa el tiempo de espera, **entonces** el indicador "pensando…" aparece en **≤ 1 s**, y la respuesta completa llega en **≤ 8 s con proveedor remoto y ≤ 15 s con proveedor local (percentil 90)**.
- **CA-07.3** · **Dado** que la pregunta se hizo por texto, **cuando** llega la respuesta, **entonces** se muestra escrita y además se lee si el TTS está activo.

#### HU-08 · Cambiar de proveedor de LLM sin tocar la interfaz
**Cubre:** RF-09, RF-10, RNF-14 · **Prioridad:** Alta · **Stakeholders:** S11, S12, S13

> **Como** equipo de desarrollo, **quiero** que el acceso al LLM pase por una interfaz única con adaptadores por proveedor, **para** cambiar entre un proveedor remoto y uno local (Ollama) por configuración.

- **CA-08.1** · **Dado** que la configuración indica `proveedor: "remoto"`, **cuando** se cambia a `proveedor: "ollama"` y se reinicia el servicio, **entonces** la adaptación de recetas sigue funcionando sin modificar ningún archivo de la interfaz de usuario.
- **CA-08.2 (RNF-14)** · **Dado** un proveedor nuevo, **cuando** se integra, **entonces** basta con **un adaptador nuevo y cero cambios en la interfaz de usuario** (verificable en el diff).
- **CA-08.3** · **Dado** que el proveedor principal no responde en el tiempo límite, **cuando** el usuario pide una adaptación, **entonces** se usa el proveedor alterno configurado; si también falla, la receta continúa sin adaptar y se informa "el asistente no está disponible, sigues con la receta original".

---

### E3 · Modo cocina y temporizadores

#### HU-09 · Ver un paso a la vez en grande
**Cubre:** RF-11, RNF-07 · **Prioridad:** Alta · **Stakeholders:** S05, S08 · **Actividad:** A4, A5

> **Como** adulto mayor, **quiero** ver un solo paso en letra grande con sus ingredientes y temporizadores, **para** leerlo desde la cocina sin acercarme a la pantalla.

- **CA-09.1** · **Dado** que el usuario entra a modo cocina, **cuando** se muestra un paso, **entonces** la superposición incluye solo ese paso, sus ingredientes y su temporizador si lo tiene.
- **CA-09.2 (RNF-07)** · **Dado** un dispositivo a 1 a 2 m, **cuando** se mide la interfaz, **entonces** el texto del paso es **≥ 32 px** y el contraste es **≥ 4,5:1 por defecto y ≥ 7:1 en modo alto contraste**.

#### HU-10 · Saber cuándo un paso está listo
**Cubre:** RF-13 · **Prioridad:** Alta · **Stakeholders:** S01 · **Actividad:** A5, A7

> **Como** cocinero novato, **quiero** que cada paso me diga cómo reconocer que ya está listo, **para** no quemar ni dejar crudo el plato.

- **CA-10.1** · **Dado** que el usuario está en el paso 4 de REC-001, **cuando** dice "explícame" o toca "más", **entonces** ve la explicación ampliada y la señal "La cebolla está transparente y el aderezo suelta aceite".
- **CA-10.2** · **Dado** que un paso no tiene `pista_listo` en los datos, **cuando** el usuario la pide, **entonces** el asistente la genera con el LLM y la marca como "sugerencia del asistente".

#### HU-11 · Varios temporizadores con nombre
**Cubre:** RF-16, RNF-18 · **Prioridad:** Alta · **Stakeholders:** S01, S02 · **Actividad:** A6

> **Como** cocinero, **quiero** iniciar varios temporizadores con nombre desde el paso y preguntar cuánto falta, **para** controlar el pollo y el aderezo a la vez.

- **CA-11.1** · **Dado** que el paso 1 de REC-001 tiene temporizador "pollo" de 25 min, **cuando** el usuario dice "inicia temporizador", **entonces** se crea el temporizador "pollo" y queda visible en la barra.
- **CA-11.2** · **Dado** que corren "pollo" y "aderezo", **cuando** dice "¿cuánto falta del pollo?", **entonces** responde en voz y texto con el tiempo restante del temporizador correcto.
- **CA-11.3 (RNF-18)** · **Dado** un temporizador de 30 minutos, **cuando** la pestaña pasa a segundo plano, **entonces** el error es **≤ ±1 s en 30 min** y la alerta suena **≤ 1 s tras vencer**, también con la pestaña en segundo plano.

#### HU-12 · Navegar pasos por cualquier canal
**Cubre:** RF-12, RF-14 · **Prioridad:** Alta · **Stakeholders:** S01, S04–S07 · **Actividad:** A5

> **Como** cocinero con las manos sucias, **quiero** avanzar, retroceder, repetir y pausar pasos por voz, gesto o toque, y ver qué comandos tengo disponibles, **para** no tener que recordar nada ni tocar la pantalla.

- **CA-12.1** · **Dado** que el usuario está en el paso 3, **cuando** dice "siguiente", desliza la mano o toca "→", **entonces** en los tres casos pasa al paso 4.
- **CA-12.2** · **Dado** que dice "repetir", **cuando** se procesa, **entonces** el paso actual se vuelve a leer y mostrar sin cambiar de paso.
- **CA-12.3** · **Dado** que el paso tiene temporizador, **cuando** se muestra la ayuda contextual, **entonces** aparecen (y se leen si el TTS está activo) los comandos y gestos válidos en ese paso, incluido "inicia temporizador".

---

### E4 · Voz

#### HU-13 · Comandos de voz con palabra de activación
**Cubre:** RF-18, RF-15, RNF-01, RNF-04 · **Prioridad:** Alta · **Stakeholders:** S04, S05 · **Actividad:** A5, A6

> **Como** Rosa, que tiene artritis y prefiere la voz, **quiero** controlar la receta con comandos cortos tras decir la palabra de activación, **para** no usar las manos y que la app no reaccione a conversaciones ajenas.

- **CA-13.1** · **Dado** que el modo cocina está activo, **cuando** Rosa dice la palabra de activación seguida de "siguiente", "anterior", "repetir", "pausar", "inicia temporizador", "¿cuánto falta?", "explícame" o "sustituye leche", **entonces** cada comando ejecuta su acción.
- **CA-13.2** · **Dado** que alguien dice "siguiente" sin la palabra de activación, **cuando** el micrófono lo capta, **entonces** no se ejecuta ninguna acción.
- **CA-13.3** · **Dado** que la lectura está en modo "breve" (como en el perfil de Rosa), **cuando** se avanza de paso, **entonces** se lee solo el `texto_corto`; en modo "detallada" se lee el texto completo; en "desactivada" no se lee nada.
- **CA-13.4 (RNF-01)** · **Dado** un comando reconocido, **cuando** se mide, **entonces** pasan **≤ 1,5 s desde el fin de la frase hasta el cambio en pantalla (percentil 95)**.
- **CA-13.5 (RNF-04)** · **Dado** una prueba con los 8 comandos esenciales, **cuando** se mide la tasa de aciertos, **entonces** es **≥ 90 % con ruido ≤ 60 dB y ≥ 80 % con ruido de 70 a 80 dB** (licuadora o extractor encendido).

#### HU-14 · La app me pide repetir cuando no me entiende
**Cubre:** RF-19 · **Prioridad:** Media · **Stakeholders:** S07 · **Actividad:** A5

> **Como** usuario con dificultades del habla, **quiero** que la app me pida repetir cuando no me entiende y que me sugiera otro canal si sigue fallando, **para** no quedarme atascado.

- **CA-14.1** · **Dado** que un comando tiene confianza baja, **cuando** se reconoce, **entonces** el sistema pregunta "¿dijiste siguiente?" en voz y texto y espera confirmación.
- **CA-14.2** · **Dado** que fallan 2 comandos seguidos, **cuando** ocurre el segundo fallo, **entonces** se muestra y se dice "puedes usar un gesto o tocar la pantalla", con el gesto equivalente ilustrado.

---

### E5 · Gestos

#### HU-15 · Controlar la receta con gestos en el aire
**Cubre:** RF-20, RNF-02, RNF-05 · **Prioridad:** Alta · **Stakeholders:** S04, S06, S07 · **Actividad:** A5

> **Como** cocinero con las manos mojadas, **quiero** pasar los pasos con gestos frente a la cámara, **para** no tocar la pantalla.

- **CA-15.1** · **Dado** que la cámara está activa, **cuando** el usuario desliza la mano a la izquierda o derecha, muestra la palma o el pulgar arriba, **entonces** se ejecuta siguiente/anterior, pausar o confirmar, respectivamente.
- **CA-15.2 (RNF-02)** · **Dado** un equipo de gama media, **cuando** se mide, **entonces** pasan **≤ 300 ms del gesto a la acción** y el video corre a **≥ 15 cuadros/s**.
- **CA-15.3 (RNF-05)** · **Dado** una prueba con los 4 gestos básicos, **cuando** se mide, **entonces** hay **≥ 90 % de aciertos** y **≤ 1 falso positivo cada 5 minutos** de cocina normal.

#### HU-16 · Saber que mi gesto fue reconocido y controlar la cámara
**Cubre:** RF-21, RNF-11 · **Prioridad:** Alta · **Stakeholders:** S05, S06, S13 · **Actividad:** A4

> **Como** usuario preocupado por la privacidad, **quiero** saber cuándo la cámara está activa, apagarla cuando quiera y recibir una confirmación de cada gesto, **para** sentir control sobre el sistema.

- **CA-16.1** · **Dado** que un gesto es reconocido, **cuando** se ejecuta, **entonces** aparece un indicador visual y suena un sonido corto (ambos, para cubrir a S05 y S06).
- **CA-16.2** · **Dado** que la cámara está encendida, **cuando** el usuario mira la pantalla, **entonces** hay un indicador visible de "cámara activa" y un control para apagarla (también por voz: "apaga la cámara").
- **CA-16.3 (RNF-11)** · **Dado** el modo cocina con gestos, **cuando** se inspecciona el tráfico de red, **entonces** el **100 % del procesamiento de gestos es local** (ningún cuadro de video sale del dispositivo) y los **permisos de cámara y micrófono se piden de forma explícita**.

#### HU-17 · Que otra persona en la cocina no active comandos
**Cubre:** RF-22 · **Prioridad:** Media · **Stakeholders:** S10 · **Actividad:** A5

> **Como** madre que cocina con su hijo al lado, **quiero** que solo se acepten gestos tras un gesto de activación y poder bloquearlos por voz, **para** que los movimientos del niño no cambien el paso.

- **CA-17.1** · **Dado** que el gesto de activación no se ha hecho, **cuando** otra persona desliza la mano frente a la cámara, **entonces** no se ejecuta ninguna acción.
- **CA-17.2** · **Dado** que el usuario dice "bloquea gestos", **cuando** pasa el tiempo de bloqueo configurado, **entonces** los gestos se reactivan solos y se avisa.

---

### E6 · Accesibilidad (discapacidad)

#### HU-18 · Rosa (motriz): gestos ajustados a su movilidad
**Cubre:** RF-23, RF-24 · **Prioridad:** Alta · **Stakeholders:** S04 · **Actividad:** A5

> **Como** Rosa, con artritis en las manos, **quiero** ajustar la sensibilidad y la amplitud de los gestos y poder hacer todo también por voz, **para** cocinar sin dolor.

- **CA-18.1** · **Dado** que Rosa elige sensibilidad "alta tolerancia" y sostener el gesto 400 ms, **cuando** hace un deslizamiento corto a la altura del pecho, **entonces** se reconoce como "siguiente".
- **CA-18.2** · **Dado** que la mano no se detecta bien (luz baja o fuera de cuadro), **cuando** pasan 3 s sin detección, **entonces** el sistema avisa "no veo bien tu mano" en voz y texto.
- **CA-18.3** · **Dado** cualquier acción esencial (navegar, temporizador, confirmar, pedir ayuda), **cuando** se revisa la configuración, **entonces** está disponible por al menos dos canales de entre voz, gestos y táctil, y Rosa puede desactivar el canal táctil sin perder ninguna acción.

#### HU-19 · Carmen (visual): cocinar solo con audio
**Cubre:** RF-27, RF-15, RNF-08 · **Prioridad:** Alta · **Stakeholders:** S05 · **Actividad:** A5, A6

> **Como** Carmen, con baja visión, **quiero** conocer el paso, los temporizadores y las alertas por audio y con mi lector de pantalla, **para** cocinar sin depender de la pantalla.

- **CA-19.1** · **Dado** que Carmen dice "¿dónde estoy?", **cuando** el sistema responde, **entonces** lee el número de paso, el texto del paso y los temporizadores activos con su tiempo restante.
- **CA-19.2** · **Dado** que usa un lector de pantalla, **cuando** navega el modo cocina, **entonces** el paso actual, los temporizadores y las alertas tienen roles y regiones ARIA (`aria-live`) que el lector anuncia al cambiar.
- **CA-19.3 (RNF-08)** · **Dado** una auditoría de accesibilidad, **cuando** se revisa la interfaz, **entonces** cumple **WCAG 2.1 nivel AA**, los **objetivos táctiles miden ≥ 44 px** y es **navegable por teclado**.

#### HU-20 · Javier (auditiva): ver todo lo que suena
**Cubre:** RF-26, RF-17 · **Prioridad:** Alta · **Stakeholders:** S06 · **Actividad:** A6, A7, A9

> **Como** Javier, que es sordo, **quiero** que toda respuesta hablada tenga subtítulos y que cada alarma sea visual, **para** no quemar la comida por no oír el temporizador.

- **CA-20.1** · **Dado** que vence el temporizador "arroz", **cuando** suena la alerta, **entonces** también aparece a pantalla completa con destello y nombre del temporizador, y permanece hasta que Javier la confirme por gesto (pulgar arriba), voz o toque.
- **CA-20.2** · **Dado** que el asistente responde una duda, **cuando** la lee en voz alta, **entonces** el mismo texto aparece como subtítulo sincronizado.
- **CA-20.3** · **Dado** cualquier sonido del sistema (confirmación de gesto, error, celebración), **cuando** se reproduce, **entonces** tiene un equivalente visual (icono o destello).

#### HU-21 · Javier (habla): usar la app sin voz
**Cubre:** RF-24, RF-25, RNF-15 · **Prioridad:** Alta · **Stakeholders:** S07 · **Actividad:** A5

> **Como** Javier, cuyo habla no reconoce bien el sistema, **quiero** desactivar la voz y hacer todo con gestos y toques, **para** no frustrarme con comandos que no funcionan.

- **CA-21.1** · **Dado** que Javier desactiva la entrada por voz en su perfil, **cuando** cocina una receta completa, **entonces** puede navegar, iniciar y detener temporizadores, confirmar y pedir ayuda solo con gestos y táctil.
- **CA-21.2** · **Dado** que el perfil fija un tiempo de espera de voz mayor, **cuando** otro usuario con habla lenta la usa, **entonces** el sistema espera ese tiempo antes de dar el comando por terminado.
- **CA-21.3 (RNF-15)** · **Dado** que un canal falla (micrófono sin permiso o cámara ocupada), **cuando** el sistema lo detecta, **entonces** **cambia a un canal alterno en ≤ 3 s con aviso**.

#### HU-22 · Perfil de accesibilidad configurable
**Cubre:** RF-25 · **Prioridad:** Alta · **Stakeholders:** S02, S05, S07, S08

> **Como** usuario, **quiero** guardar mi canal preferido, verbosidad, tamaño de letra, contraste, volumen y tiempo de espera de voz, **para** no configurarlos cada vez que cocino.

- **CA-22.1** · **Dado** que Carmen guarda fuente "extragrande", alto contraste y verbosidad "detallada", **cuando** vuelve a abrir la app, **entonces** el modo cocina se muestra así sin pasos adicionales.
- **CA-22.2** · **Dado** que un adulto mayor configura su primera vez, **cuando** termina, **entonces** la configuración de accesibilidad se hizo en ≤ 3 pantallas, con valores por defecto generosos (fuente grande, volumen alto).

---

### E7 · Personalización continua

#### HU-23 · Un perfil que recuerda mis gustos y restricciones
**Cubre:** RF-28, RNF-17 · **Prioridad:** Alta · **Stakeholders:** S01–S08 · **Actividad:** A10

> **Como** cocinero habitual, **quiero** que la app recuerde mis restricciones, gustos, nivel, ritmo, sustituciones y forma de interactuar, **para** que cada receta salga a mi medida.

- **CA-23.1** · **Dado** que Rosa registró que su esposo es intolerante a la lactosa, **cuando** abre cualquier receta con leche, **entonces** se le propone la sustitución sin que lo vuelva a indicar.
- **CA-23.2 (RNF-17)** · **Dado** que el usuario cambia una preferencia, **cuando** cierra y reabre la app, **entonces** hay **100 % de persistencia entre sesiones** y el **guardado tarda ≤ 1 s**.

#### HU-24 · Que el sistema aprenda de cómo cocino
**Cubre:** RF-29 · **Prioridad:** Alta · **Stakeholders:** S01, S02 · **Actividad:** A10

> **Como** cocinero experimentado, **quiero** que la app aprenda que salto las lecturas largas y qué sustituciones acepto, **para** no tener que configurarlo yo.

- **CA-24.1** · **Dado** que el usuario salta la lectura completa en 3 recetas seguidas, **cuando** inicia la siguiente, **entonces** el perfil registra `salta_lectura_completa: true` y la lectura pasa a "breve" (avisándolo).
- **CA-24.2** · **Dado** que acepta "caldo + maicena" en lugar de leche evaporada, **cuando** termina la receta, **entonces** la sustitución queda en `sustituciones_aceptadas` y se propone primero la próxima vez.
- **CA-24.3** · **Dado** que repite 3 veces el mismo paso o dice "estoy nervioso", **cuando** termina la sesión, **entonces** el perfil registra la dificultad o la emoción declarada para ajustar el ritmo.

#### HU-25 · Ver y corregir lo que la app aprendió de mí
**Cubre:** RF-30, RNF-11 · **Prioridad:** Alta · **Stakeholders:** S01–S08, S13 · **Actividad:** A10

> **Como** usuario, **quiero** ver la pantalla "lo que aprendí de ti" y corregir o borrar lo que no sea cierto, **para** confiar en la personalización y controlar mis datos.

- **CA-25.1** · **Dado** que el perfil tiene datos aprendidos, **cuando** se abre "lo que aprendí de ti", **entonces** se lista cada dato aprendido con su origen (por ejemplo, "aceptaste esta sustitución el 5/10").
- **CA-25.2** · **Dado** un dato incorrecto, **cuando** el usuario lo borra, **entonces** desaparece y no vuelve a usarse en sugerencias.
- **CA-25.3 (RNF-11)** · **Dado** que el usuario quiere sus datos, **cuando** elige exportar o borrar el perfil, **entonces** puede hacerlo en **≤ 2 pasos**.

#### HU-26 · Calificar la receta al terminar y configurar el perfil de otra persona
**Cubre:** RF-31, RF-32 · **Prioridad:** Media · **Stakeholders:** S01, S10 · **Actividad:** A10

> **Como** cocinero, **quiero** calificar la receta con el pulgar o con la voz; **y como** cuidador, **quiero** configurar el perfil de la persona que cuido desde mi celular, **para** que el sistema mejore sus sugerencias.

- **CA-26.1** · **Dado** que el usuario terminó la receta, **cuando** hace pulgar arriba o abajo, o dice "me gustó", **entonces** la valoración queda en el `historial` del perfil.
- **CA-26.2** · **Dado** que un cuidador tiene permiso sobre el perfil de Carmen, **cuando** cambia el tamaño de fuente desde otro dispositivo, **entonces** Carmen ve el cambio en su próxima sesión.

---

### E8 · Multiusuario

#### HU-27 · Crear una sala y unirse con un código
**Cubre:** RF-33, RF-34 · **Prioridad:** Alta · **Stakeholders:** S09 · **Actividad:** A8

> **Como** Diego, que vive lejos de su mamá, **quiero** crear una sala con un código corto y elegir si cocinamos "juntos" o "a mi ritmo", **para** preparar la misma receta a distancia.

- **CA-27.1** · **Dado** que Diego crea una sala para "Tortilla de verduras" (REC-004), **cuando** se genera, **entonces** recibe un código de 4 caracteres (por ejemplo `7K2P`) que puede dictar o compartir.
- **CA-27.2** · **Dado** el código, **cuando** su mamá lo ingresa por voz o texto, **entonces** se une a la sala y ve la misma receta.
- **CA-27.3** · **Dado** el modo "juntos" (`sincronizado`), **cuando** el anfitrión avanza de paso, **entonces** todos avanzan; en modo "a mi ritmo" (`libre`) cada participante avanza por separado.

#### HU-28 · Ver en qué paso va cada participante
**Cubre:** RF-35, RF-36, RNF-09 · **Prioridad:** Alta · **Stakeholders:** S09 · **Actividad:** A8

> **Como** co-cocinero remoto, **quiero** ver el avatar de cada participante con su número de paso y volver a la sala si se corta la conexión, **para** esperarlo o ayudarlo.

- **CA-28.1** · **Dado** una sala en modo `libre`, **cuando** un participante cambia de paso, **entonces** su avatar muestra el nuevo número de paso en la vista de los demás.
- **CA-28.2 (RNF-09)** · **Dado** una sala de **hasta 4 participantes**, **cuando** alguien cambia de paso, **entonces** el cambio es visible a los demás en **≤ 1 s (percentil 95)**.
- **CA-28.3 (RNF-09)** · **Dado** que un participante pierde la conexión, **cuando** se reconecta, **entonces** se **resincroniza en ≤ 5 s** con el paso y los temporizadores de la sala, y su avatar pasa de "desconectado" a "conectado".

#### HU-29 · Compartir la receta adaptada y el logro con la sala
**Cubre:** RF-37 · **Prioridad:** Media · **Stakeholders:** S09 · **Actividad:** A8, A9

> **Como** participante de una sala, **quiero** compartir mi receta adaptada y mi plato terminado, **para** que los demás cocinen la misma versión y celebremos juntos.

- **CA-29.1** · **Dado** que Diego adaptó la receta sin huevo, **cuando** elige "compartir con la sala", **entonces** los demás participantes pueden usar esa versión adaptada (pasando por su propio validador de alérgenos).
- **CA-29.2** · **Dado** que un participante termina, **cuando** comparte su logro, **entonces** los demás ven una notificación con el nombre del plato.

---

### E9 · Diseño emocional (Norman)

#### HU-30 · Nivel visceral: una interfaz que dé ganas de cocinar
**Cubre:** RF-38 · **Prioridad:** Alta · **Stakeholders:** S01, S05, S08 · **Actividad:** A1, A9

> **Como** usuario, **quiero** una interfaz cálida, con ilustraciones y buena tipografía, que siga siendo atractiva en alto contraste, **para** sentir que cocinar es agradable y no una tarea técnica.

- **CA-30.1** · **Dado** el tema por defecto, **cuando** se abre la app, **entonces** usa la paleta cálida, ilustraciones de los platos y la tipografía definida en el prototipo.
- **CA-30.2** · **Dado** que Carmen activa alto contraste, **cuando** navega, **entonces** se mantienen ilustraciones e iconos (adaptados al contraste), no una pantalla en blanco y negro plano.

#### HU-31 · Nivel conductual: respuesta inmediata a cada acción
**Cubre:** RF-39 · **Prioridad:** Alta · **Stakeholders:** S01–S08 · **Actividad:** A5, A6

> **Como** cocinero, **quiero** que cada acción tenga una microinteracción visual y sonora, **para** saber siempre que el sistema me entendió.

- **CA-31.1** · **Dado** cualquier comando ejecutado (voz, gesto o toque), **cuando** se procesa, **entonces** hay una microinteracción visual (transición o pulso) y un sonido corto que respeta el volumen del perfil.
- **CA-31.2** · **Dado** un comando no reconocido, **cuando** ocurre, **entonces** la retroalimentación es distinta a la de éxito (otro sonido e icono), sin tono de reproche.

#### HU-32 · Nivel reflexivo: celebrar al terminar
**Cubre:** RF-40, RNF-16 · **Prioridad:** Alta · **Stakeholders:** S01 · **Actividad:** A9

> **Como** cocinero novato, **quiero** una pequeña celebración y que el plato quede en mi historial, **para** sentir que logré algo y querer volver a cocinar.

- **CA-32.1** · **Dado** que el usuario termina "Ají de gallina", **cuando** confirma el último paso, **entonces** ve y oye la celebración ("¡Tu ají de gallina está listo!") y el plato se registra en su historial con la fecha.
- **CA-32.2 (RNF-16)** · **Dado** la celebración, **cuando** se mide, **entonces** dura **≤ 5 s y es saltable en 1 acción** (voz, gesto o toque); para Javier se muestra sin sonido.
- **CA-32.3 (RNF-16)** · **Dado** una prueba de usabilidad con el cuestionario de experiencia emocional, **cuando** se promedian los resultados, **entonces** la **puntuación es ≥ 4 de 5**.

#### HU-33 · Un asistente con un tono adaptado a cómo me siento
**Cubre:** RF-41, RF-42 · **Prioridad:** Alta · **Stakeholders:** S01, S02 · **Actividad:** A5, A7, A10

> **Como** cocinero novato y nervioso, **quiero** que el asistente me hable con calma y más despacio cuando le digo que estoy nervioso, **para** sentirme acompañado; **y como** experimentado, quiero que sea breve.

- **CA-33.1** · **Dado** que Diego es novato, **cuando** el asistente explica un paso, **entonces** usa un tono tranquilizador y explicativo; para Rosa (avanzado, tono "cordial y directo") las respuestas son de 1 frase.
- **CA-33.2** · **Dado** que Diego dice "estoy nervioso", **cuando** el asistente responde, **entonces** contesta con un mensaje de apoyo, ofrece pausar y reduce el ritmo de lectura para el resto de la sesión.

---

### E10 · PWA y calidad

#### HU-34 · Instalar la app y cocinar sin conexión
**Cubre:** RF-43, RF-44, RNF-10, RNF-13 · **Prioridad:** Alta · **Stakeholders:** S13 · **Actividad:** A5, A6

> **Como** usuario con conexión inestable, **quiero** instalar la app en mi celular o laptop y seguir cocinando si se cae el internet, **para** no perder la receta a mitad.

- **CA-34.1** · **Dado** Chrome en Android, **cuando** el usuario abre la app, **entonces** se ofrece "instalar" y la app se abre desde el ícono como aplicación independiente.
- **CA-34.2** · **Dado** que la receta en curso ya cargó, **cuando** se corta la conexión, **entonces** los pasos, temporizadores y el perfil siguen funcionando, y se muestra un aviso discreto de "sin conexión".
- **CA-34.3 (RNF-10)** · **Dado** una auditoría Lighthouse, **cuando** se ejecuta, **entonces** la app es **"instalable"**, la **carga inicial es ≤ 3 s en 4G** y el **modo cocina funciona completo sin conexión tras la primera carga**.
- **CA-34.4 (RNF-13)** · **Dado** **Chrome, Edge y Safari en sus 2 últimas versiones**, **cuando** se prueba en **anchos desde 360 px**, en **laptop y móvil**, **entonces** todas las pantallas se ven y funcionan sin desbordes.

#### HU-35 · Seguir cocinando si falla un canal o la red
**Cubre:** RNF-15, RF-10, RF-44 · **Prioridad:** Alta · **Stakeholders:** S07, S12, S13 · **Actividad:** A5

> **Como** cocinero, **quiero** que si el micrófono, la cámara, la red o el LLM fallan, la app me avise y me deje continuar por otro medio, **para** no abandonar la receta.

- **CA-35.1 (RNF-15)** · **Dado** que el reconocimiento de voz deja de responder, **cuando** el sistema lo detecta, **entonces** propone gestos o táctil y hace el **cambio a un canal alterno en ≤ 3 s con aviso**.
- **CA-35.2 (RNF-15)** · **Dado** que se pierde la red durante la receta, **cuando** el usuario sigue, **entonces** la **receta en curso sigue sin conexión** y las funciones del LLM se marcan como no disponibles.

#### HU-36 · Aprender a usar la app en dos minutos
**Cubre:** RNF-12, RF-14 · **Prioridad:** Alta · **Stakeholders:** S01, S08

> **Como** usuario nuevo, **quiero** un recorrido inicial corto que me enseñe los gestos y comandos básicos, **para** empezar a cocinar sin leer un manual.

- **CA-36.1 (RNF-12)** · **Dado** un usuario que abre la app por primera vez, **cuando** completa el onboarding, **entonces** el **onboarding toma ≤ 2 min** e incluye practicar "siguiente" por voz y por gesto.
- **CA-36.2 (RNF-12)** · **Dado** una prueba de usabilidad, **cuando** los participantes cocinan una receta de 10 pasos, **entonces** **≥ 90 % de los participantes la completa sin ayuda externa**.

#### HU-37 · Validación del conjunto de pruebas y métricas
**Cubre:** RNF-01, RNF-02, RNF-03, RNF-04, RNF-05, RNF-06, RNF-09, RNF-18 · **Prioridad:** Alta · **Stakeholders:** S11, S14

> **Como** equipo de desarrollo, **quiero** un protocolo de prueba que mida todas las latencias y tasas de acierto, **para** demostrar que el sistema cumple los requerimientos no funcionales.

- **CA-37.1** · **Dado** el protocolo de prueba, **cuando** se ejecuta con los 4 perfiles de `datos/perfiles.json` y las recetas de `datos/recetas.json`, **entonces** genera un informe con: latencia de voz (p95), latencia de gestos y cuadros/s, latencia del LLM (p90 remoto y local), aciertos de voz por nivel de ruido, aciertos de gestos y falsos positivos, detección de alérgenos, latencia de sincronización de salas (p95) y deriva de temporizadores.
- **CA-37.2** · **Dado** el informe, **cuando** alguna métrica no cumple su umbral, **entonces** el requerimiento se marca "No cumple" en la matriz de trazabilidad con el valor medido.

---

## 3. Historias por tipo de usuario con discapacidad

| Stakeholder | Persona | Historias dedicadas | Historias que lo consideran |
|---|---|---|---|
| S04 · Motriz | Rosa (USR-001) | HU-18, HU-13 | HU-12, HU-15 |
| S05 · Visual | Carmen (USR-003) | HU-19, HU-22 | HU-09, HU-16, HU-30 |
| S06 · Auditiva | Javier (USR-004) | HU-20 | HU-16, HU-32 |
| S07 · Habla | Javier (USR-004) | HU-21, HU-14 | HU-15, HU-35 |

---

## 4. Cobertura requerimiento → historia

### Requerimientos funcionales

| RF | HU | RF | HU | RF | HU |
|---|---|---|---|---|---|
| RF-01 | HU-01 | RF-16 | HU-11 | RF-31 | HU-26 |
| RF-02 | HU-02 | RF-17 | HU-20 | RF-32 | HU-26 |
| RF-03 | HU-03 | RF-18 | HU-13 | RF-33 | HU-27 |
| RF-04 | HU-04 | RF-19 | HU-14 | RF-34 | HU-27 |
| RF-05 | HU-04 | RF-20 | HU-15 | RF-35 | HU-28 |
| RF-06 | HU-05 | RF-21 | HU-16 | RF-36 | HU-28 |
| RF-07 | HU-06 | RF-22 | HU-17 | RF-37 | HU-29 |
| RF-08 | HU-07 | RF-23 | HU-18 | RF-38 | HU-30 |
| RF-09 | HU-08 | RF-24 | HU-18, HU-21 | RF-39 | HU-31 |
| RF-10 | HU-08, HU-35 | RF-25 | HU-21, HU-22 | RF-40 | HU-32 |
| RF-11 | HU-09 | RF-26 | HU-20 | RF-41 | HU-33 |
| RF-12 | HU-12 | RF-27 | HU-19 | RF-42 | HU-33 |
| RF-13 | HU-10 | RF-28 | HU-23 | RF-43 | HU-34 |
| RF-14 | HU-12, HU-36 | RF-29 | HU-24 | RF-44 | HU-34, HU-35 |
| RF-15 | HU-13, HU-19 | RF-30 | HU-25 | | |

### Requerimientos no funcionales (con criterio de aceptación que mide la métrica)

| RNF | HU | Criterio | RNF | HU | Criterio |
|---|---|---|---|---|---|
| RNF-01 | HU-13, HU-37 | CA-13.4 | RNF-10 | HU-34 | CA-34.3 |
| RNF-02 | HU-15, HU-37 | CA-15.2 | RNF-11 | HU-16, HU-25 | CA-16.3, CA-25.3 |
| RNF-03 | HU-07, HU-37 | CA-07.2 | RNF-12 | HU-36 | CA-36.1, CA-36.2 |
| RNF-04 | HU-13, HU-37 | CA-13.5 | RNF-13 | HU-34 | CA-34.4 |
| RNF-05 | HU-15, HU-37 | CA-15.3 | RNF-14 | HU-08 | CA-08.2 |
| RNF-06 | HU-06, HU-37 | CA-06.3 | RNF-15 | HU-21, HU-35 | CA-21.3, CA-35.1, CA-35.2 |
| RNF-07 | HU-09 | CA-09.2 | RNF-16 | HU-32 | CA-32.2, CA-32.3 |
| RNF-08 | HU-19 | CA-19.3 | RNF-17 | HU-23 | CA-23.2 |
| RNF-09 | HU-28, HU-37 | CA-28.2, CA-28.3 | RNF-18 | HU-11, HU-37 | CA-11.3 |

### Requerimientos sin cobertura

Ninguno: los 44 RF y los 18 RNF tienen al menos una historia, y cada RNF tiene un criterio de aceptación con su métrica.

### Observaciones para la matriz (Integrante 2)

- **RF-04 y RNF-06** mencionan 10 recetas de ejemplo, pero [`datos/recetas.json`](../datos/recetas.json) tiene 7 por ahora. Hay que completar el recetario o ajustar la cifra del requerimiento.
- **RF-34:** "juntos" y "a mi ritmo" se corresponden con los valores `sincronizado` y `libre` del campo `modo` de la sala.
