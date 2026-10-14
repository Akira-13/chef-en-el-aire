# 02 · Análisis PACT (People, Activities, Contexts, Technologies)

**Responsable:** Diego García

---

## P · People (personas)

### Diferencias físicas
| Grupo | Característica | Consecuencia para el sistema |
|---|---|---|
| Usuarios sin discapacidad | Manos ocupadas, sucias o mojadas; a 1 a 2 m de la pantalla | Control sin contacto; texto legible a 2 m |
| Discapacidad motriz (S04) | Dolor o rigidez, temblor, alcance reducido | Gestos amplios pero cortos, a la altura del pecho; voz completa; sensibilidad configurable |
| Discapacidad visual (S05) | Baja visión o ceguera | Salida por audio completa; alto contraste; fuente extragrande; compatibilidad con lector de pantalla |
| Discapacidad auditiva (S06) | No percibe alarmas ni respuestas habladas | Equivalente visual para todo sonido; subtítulos |
| Discapacidad del habla (S07) | Reconocimiento de voz no fiable | Gestos y táctil cubren todas las acciones; voz desactivable |
| Adultos mayores (S08) | Posible baja de vista, oído y destreza combinada | Valores por defecto generosos (fuente, volumen, tiempos) |

### Diferencias psicológicas
- **Nivel de habilidad culinaria:** novato (necesita explicación y seguridad), intermedio, experimentado (necesita rapidez y brevedad).
- **Familiaridad tecnológica:** desde nativos digitales hasta adultos mayores con poca experiencia; el modelo mental de "hablarle a la app" no es universal.
- **Carga cognitiva:** cocinar ya exige atención (fuego, cuchillos, tiempos); la interfaz debe exigir el mínimo de memoria (no recordar comandos complejos).
- **Estado emocional:** ansiedad del novato ante el error, desconfianza de quien tiene alergias, satisfacción al terminar un plato.

### Diferencias sociales
- Cocina individual, para la familia, o conjunta a distancia (familia en otra ciudad, amigos).
- Presencia de otras personas en la cocina (niños, pareja, cuidador) que pueden interferir con gestos o voz.

---

## A · Activities (actividades)

### Actividades principales al cocinar

| # | Actividad | Descripción |
|---|---|---|
| A1 | Elegir receta | Buscar o recibir una sugerencia según gustos, tiempo disponible y lo que hay en la despensa |
| A2 | Revisar despensa e ingredientes | Comparar lo que pide la receta con lo que se tiene |
| A3 | Adaptar la receta | Sustituir ingredientes por alergia, por falta en la despensa o por preferencia; ajustar porciones y nivel de dificultad |
| A4 | Preparar (mise en place) | Lavar, pelar, cortar, medir; manos sucias desde aquí |
| A5 | Seguir los pasos | Avanzar, retroceder, repetir un paso, pedir explicación |
| A6 | Gestionar temporizadores | Iniciar, consultar y detener uno o varios temporizadores en paralelo |
| A7 | Resolver dudas en marcha | "¿Puedo usar esto en vez de aquello?", "¿cómo sé si ya está?" |
| A8 | Cocinar con otra persona a distancia | Unirse a una sala, ver el avance del otro, esperar o ayudar |
| A9 | Terminar, servir y celebrar | Cerrar la receta, registrar el logro, sentir satisfacción |
| A10 | Valorar y aprender | Calificar, guardar adaptaciones, que el sistema aprenda gustos y restricciones |

### Características de las actividades

| Actividad | Frecuencia | Tiempo / concurrencia | Complejidad | Seguridad / criticidad | Datos involucrados |
|---|---|---|---|---|---|
| A1 Elegir | 1 por sesión | Sin prisa, manos limpias | Baja | Baja | Recetas, perfil, despensa |
| A2 Despensa | 1 por sesión | Sin prisa | Baja | Media | Despensa |
| A3 Adaptar | 0 a varias | Antes o durante la cocción | **Alta** (LLM) | **Crítica** (alergias) | Receta, perfil, alérgenos |
| A4 Preparar | Continua | Manos sucias, uso de cuchillos | Media | Media (cortes) | Pasos |
| A5 Seguir pasos | 5 a 20 por receta | Manos sucias, atención dividida | Baja por acción | Media | Pasos |
| A6 Temporizadores | 1 a 4 en paralelo | **Concurrente** con otros pasos | Media | **Alta** (quemar comida) | Temporizadores |
| A7 Dudas | Esporádica | Interrumpe el flujo, respuesta inmediata | Alta (LLM) | Media | Receta, contexto del paso |
| A8 Remota | Ocasional | Sincrónica, depende de la red | Alta | Baja | Sala, estado de pasos |
| A9 Terminar | 1 por sesión | Momento de cierre | Baja | Baja | Historial |
| A10 Valorar | 1 por sesión | Tras cocinar, manos limpias | Baja | Baja | Perfil, historial |

### De la actividad al requerimiento y a la decisión de diseño

| Actividad | Requerimientos que genera | Decisión de diseño |
|---|---|---|
| A1 Elegir receta | Sugerir recetas filtradas por restricciones, despensa, tiempo y nivel; búsqueda por voz y por texto | Pantalla de inicio con 3 sugerencias personalizadas, no un catálogo infinito (baja carga para S08) |
| A2 Revisar despensa | Registrar despensa por voz o texto; marcar ingredientes faltantes | Lista de ingredientes con estado "tengo / falta / sustituir" |
| A3 Adaptar receta | Adaptación por LLM mediante una capa de abstracción; validación local de alérgenos; mostrar cambios respecto a la original | Vista "antes / después" con los cambios resaltados y el motivo; confirmación explícita si involucra un alérgeno |
| A4 Preparar | Control sin contacto desde el inicio de la preparación | La cámara y la escucha se activan al entrar en "modo cocina"; indicador visible de cámara activa |
| A5 Seguir pasos | Avanzar, retroceder y repetir por voz, gesto y táctil; lectura automática configurable; explicación ampliada | Superposición con un paso a la vez en tipografía grande; gestos: deslizar = siguiente/anterior, palma = pausar, pulgar arriba = confirmar |
| A6 Temporizadores | Varios temporizadores simultáneos con nombre; alerta visual + sonora persistente; consulta "¿cuánto falta?" | Barra de temporizadores siempre visible con nombre y color; alerta a pantalla completa que no desaparece hasta confirmarla |
| A7 Dudas en marcha | Preguntas libres al asistente con contexto del paso actual; latencia acotada; respuesta subtitulada | Respuesta breve primero, con opción de "más detalle"; aviso "pensando…" si tarda |
| A8 Cocinar a distancia | Crear y unirse a salas con código corto; sincronizar pasos; mostrar el paso de cada participante; resincronizar tras desconexión | Avatares con el número de paso de cada participante; modos "juntos" o "a mi ritmo" |
| A9 Terminar y celebrar | Celebración multimodal, breve y saltable; registro del logro | Animación + sonido + mensaje; respeta las preferencias del perfil (sin sonido para S06) |
| A10 Valorar y aprender | Perfil persistente que aprende gustos, restricciones, sustituciones aceptadas y preferencias de interacción | Calificación por gesto (pulgar arriba/abajo) o voz; el perfil muestra "lo que aprendí de ti" y se puede corregir |

---

## C · Contexts (contextos)

### Contexto físico
- **Ruido:** extractor de humo, licuadora, agua corriendo, aceite friendo (60 a 80 dB). Afecta el reconocimiento de voz → palabra de activación, umbral de confianza y alternativa por gestos.
- **Iluminación:** variable (luz cálida, contraluz de ventana, de noche). Afecta la detección de manos de MediaPipe → mensaje cuando la mano no se detecta bien y opción de ajustar sensibilidad.
- **Vapor y salpicaduras:** el dispositivo debe quedar lejos del fuego; la interfaz debe leerse a 1 a 2 m.
- **Espacio:** cocinas pequeñas (común en departamentos de Lima); el dispositivo suele apoyarse contra la pared o en una repisa → la cámara ve parcialmente al usuario.
- **Manos:** sucias, mojadas, con guantes o con utensilios en la mano.
- **Seguridad:** fuego, cuchillos y líquidos calientes; la interfaz no debe exigir mirar la pantalla en momentos de riesgo (el audio informa).

### Contexto social
- Cocina individual, familiar (otras personas presentes) o remota (salas).
- Presencia de niños o mascotas que generan movimiento y ruido → gesto de activación.
- La cocina conjunta a distancia tiene un componente afectivo (familia lejos): la experiencia debe sentirse cálida, no técnica.

### Contexto organizacional / cultural
- Uso doméstico, sin organización que imponga reglas; posible uso futuro en talleres de cocina.
- Recetario local (cocina peruana: ají de gallina, causa, lomo saltado) con medidas caseras ("una taza", "un tarro") → el LLM debe entender unidades locales.
- Español peruano con variaciones regionales (vocabulario: "choclo", "palta", "ají").

### Contexto técnico
- Conexión doméstica variable; a veces solo datos móviles → modo sin conexión para la receta en curso.
- Dispositivos de gama media → MediaPipe debe correr con una tasa de cuadros aceptable; degradar a voz/táctil si no es posible.

---

## T · Technologies (tecnologías)

| Componente | Tecnología prevista | Justificación desde P, A y C |
|---|---|---|
| Entrada por gestos | Cámara + MediaPipe Hands (en el navegador) | Control sin contacto (A4–A6); procesamiento local por privacidad y latencia |
| Entrada por voz | Web Speech API o servicio de reconocimiento intercambiable; palabra de activación | Manos ocupadas; canal principal para S04 y S05 |
| Entrada táctil / teclado | Interfaz web estándar | Respaldo para todos; necesaria para S07 cuando los gestos fallan |
| Salida visual | Superposición de pasos en tipografía grande, alto contraste, subtítulos, alertas a pantalla completa | Legibilidad a 2 m; canal principal para S06 |
| Salida auditiva | Síntesis de voz (TTS) y sonidos diferenciados | Canal principal para S05; confirmación de gestos |
| Inteligencia | LLM detrás de una capa de abstracción (adaptadores por proveedor) | Adaptación de recetas y dudas (A3, A7); independencia del proveedor |
| Comunicación | WebSockets o WebRTC para salas | Sincronización de pasos (A8) |
| Plataforma | PWA (instalable, service worker, caché offline) | Multidispositivo sin tienda de apps; funciona con mala conexión |
| Datos | Perfil persistente (almacenamiento local + sincronización) y recetario en JSON | Personalización continua (A10) |
