# 05 · Requerimientos funcionales y no funcionales

**Proyecto:** Chef en el Aire, cocina manos libres  
**Responsable:** Jarem Villalobos  


---

## 1. Requerimientos funcionales (RF)
**Área:** V = Voz, LLM = Capa de abstracción del LLM, PWA, PER = Personalización continua, MU = Multiusuario, EMO = Diseño emocional (Norman). Se añaden dos áreas propias: GES = Gestos y ACC = Accesibilidad multimodal.

### 1.1 Recetas y despensa

| ID | Requerimiento | Prioridad | Origen | Área |
|---|---|---|---|---|
| RF-01 | El sistema sugiere 3 recetas en la pantalla de inicio, filtradas por las restricciones del perfil, la despensa, el tiempo disponible y el nivel de habilidad. | Alta | A1; S01, S08 | PER |
| RF-02 | El usuario busca recetas por nombre o por ingrediente disponible, por voz y por texto. | Media | A1; S08 | V |
| RF-03 | El usuario registra su despensa por voz o texto y cada ingrediente de la receta se marca como "tengo / falta / sustituir". | Media | A2 | V |
| RF-04 | Las recetas se almacenan en formato estructurado (JSON): ingredientes con unidades caseras locales, pasos, tiempos, alérgenos y la señal de "cuándo está listo" de cada paso. Se incluyen 10 recetas de ejemplo. | Alta | A1, A5; S15 | LLM |

### 1.2 Adaptación con LLM y capa de abstracción

| ID | Requerimiento | Prioridad | Origen | Área |
|---|---|---|---|---|
| RF-05 | El asistente adapta una receta con el LLM según alergias, despensa, porciones y nivel de dificultad. | Alta | A3; S01, S03 | LLM |
| RF-06 | La adaptación se muestra en una vista "antes / después" con los cambios resaltados y su motivo; la receta original se conserva. | Alta | A3; S15, S16 | LLM |
| RF-07 | Toda receta adaptada pasa por una validación local de alérgenos, independiente del LLM. Si contiene un alérgeno del perfil, se bloquea y exige confirmación explícita. | Alta | A3; S03, S16 | LLM |
| RF-08 | El usuario hace preguntas libres al asistente, por voz o texto, con el contexto del paso actual. La respuesta es breve y ofrece "más detalle". | Alta | A7; S01 | LLM |
| RF-09 | El acceso al LLM se hace mediante una capa de abstracción con una interfaz única y adaptadores por proveedor (remoto como Claude u otros, y local con Ollama). El proveedor se cambia por configuración, sin modificar la interfaz de usuario. | Alta | A3, A7; S11, S12 | LLM |
| RF-10 | Si el proveedor del LLM falla o no responde, el sistema usa el proveedor alterno configurado o continúa con la receta sin adaptar, informando al usuario. | Media | S12, S13 | LLM |

### 1.3 Modo cocina, ayuda contextual y temporizadores

| ID | Requerimiento | Prioridad | Origen | Área |
|---|---|---|---|---|
| RF-11 | El modo cocina muestra un paso a la vez en una superposición de tipografía grande, con los ingredientes y temporizadores del paso. | Alta | A4, A5; S08 | ACC |
| RF-12 | El usuario avanza, retrocede, repite y pausa los pasos por voz, por gesto y por táctil. | Alta | A5; S04–S07 | ACC |
| RF-13 | Cada paso ofrece una explicación ampliada y la señal concreta de "cuándo está listo". | Alta | A5, A7; S01 | LLM |
| RF-14 | Ayuda contextual: según el paso actual, el sistema muestra y dice los gestos y comandos disponibles. | Alta | A5; S01, S08 | ACC |
| RF-15 | Los pasos se leen en voz alta (síntesis de voz). La lectura es configurable: activada, desactivada, breve o detallada. | Alta | A5; S02, S05 | V |
| RF-16 | El usuario inicia varios temporizadores simultáneos con nombre desde el propio paso y consulta "¿cuánto falta?" por voz. | Alta | A6 | V |
| RF-17 | Al vencer un temporizador, la alerta es visual (pantalla completa), sonora y persistente hasta que el usuario la confirma por voz, gesto o toque. | Alta | A6; S06 | ACC |

### 1.4 Interfaz de voz

| ID | Requerimiento | Prioridad | Origen | Área |
|---|---|---|---|---|
| RF-18 | Comandos de voz esenciales con palabra de activación: siguiente, anterior, repetir, pausar, iniciar temporizador, "¿cuánto falta?", "explícame" y "sustituye X". | Alta | A5, A6; S04, S05 | V |
| RF-19 | Si un comando no se entiende o la confianza es baja, el sistema pide repetir o confirmar, y tras 2 fallos seguidos sugiere un canal alterno (gestos o táctil). | Media | A5; S07 | V |

### 1.5 Gestos

| ID | Requerimiento | Prioridad | Origen | Área |
|---|---|---|---|---|
| RF-20 | Control por gestos con la cámara (MediaPipe): deslizar = siguiente/anterior, palma = pausar, pulgar arriba = confirmar. | Alta | A5; S04, S06, S07 | GES |
| RF-21 | Cada gesto reconocido se confirma con un indicador visual y un sonido. Hay un indicador visible de cámara activa y un control para apagarla. | Alta | A4; S05, S06 | GES |
| RF-22 | Un gesto o comando de activación y un bloqueo temporal de gestos por voz evitan activaciones involuntarias de terceros. | Media | S10 | GES |
| RF-23 | La sensibilidad y la amplitud de los gestos son configurables; el sistema avisa cuando no detecta bien la mano. | Media | A5; S04 | GES |

### 1.6 Accesibilidad multimodal

| ID | Requerimiento | Prioridad | Origen | Área |
|---|---|---|---|---|
| RF-24 | Toda acción esencial (navegar, temporizador, confirmar, pedir ayuda) está disponible por al menos dos canales de entre voz, gestos y táctil. Cada canal puede desactivarse. | Alta | S04–S07 | ACC |
| RF-25 | Perfil de accesibilidad: canal preferido, verbosidad, tamaño de fuente, contraste, volumen y tiempo de espera de la voz. | Alta | S02, S05, S07, S08 | ACC |
| RF-26 | Toda respuesta hablada y todo sonido tienen un equivalente visual (subtítulos, iconos, destello). | Alta | A6, A7, A9; S06 | ACC |
| RF-27 | El estado completo (paso, temporizadores, alertas) es accesible por audio y con lector de pantalla (ARIA). | Alta | A5, A6; S05 | ACC |

### 1.7 Personalización continua

| ID | Requerimiento | Prioridad | Origen | Área |
|---|---|---|---|---|
| RF-28 | El sistema mantiene un perfil persistente: restricciones, gustos, nivel de habilidad, ritmo, sustituciones aceptadas y preferencias de interacción. | Alta | A10 | PER |
| RF-29 | El perfil se actualiza con el uso: calificaciones, sustituciones aceptadas o rechazadas, repeticiones de pasos, errores y emociones declaradas o inferidas por la interacción. | Alta | A10 | PER |
| RF-30 | La pantalla "lo que aprendí de ti" permite ver, corregir y borrar lo que el sistema aprendió. | Alta | A10 | PER |
| RF-31 | Al terminar, el usuario califica la receta por gesto (pulgar arriba/abajo) o por voz. | Media | A10 | PER |
| RF-32 | Un cuidador configura el perfil de otra persona desde otro dispositivo. | Baja | S10 | PER |

### 1.8 Multiusuario

| ID | Requerimiento | Prioridad | Origen | Área |
|---|---|---|---|---|
| RF-33 | El usuario crea una sala con un código corto y otros participantes se unen con él. | Alta | A8; S09 | MU |
| RF-34 | Los pasos se sincronizan en modo "juntos" o "a mi ritmo", elegido al crear la sala. | Alta | A8; S09 | MU |
| RF-35 | La sala muestra el paso en el que va cada participante (avatares con número de paso). | Alta | A8; S09 | MU |
| RF-36 | Tras una desconexión, el participante se resincroniza con el estado de la sala. | Media | A8; S09 | MU |
| RF-37 | Los participantes comparten con la sala la receta adaptada y el logro final. | Media | A8, A9 | MU |

### 1.9 Diseño emocional (Norman)

| ID | Requerimiento | Prioridad | Origen | Área |
|---|---|---|---|---|
| RF-38 | **Nivel visceral:** ambientación visual atractiva (paleta cálida, ilustraciones, tipografía) con una opción de alto contraste que no pierde atractivo. | Alta | A1, A9 | EMO |
| RF-39 | **Nivel conductual:** toda interacción da retroalimentación inmediata mediante microinteracciones visuales y sonoras. | Alta | A5, A6 | EMO |
| RF-40 | **Nivel reflexivo:** al terminar, una celebración multimodal, breve y saltable, y un registro del logro (historial de platos). | Alta | A9; S01 | EMO |
| RF-41 | El tono del asistente es cercano y se adapta al nivel: tranquilizador y explicativo para el novato, breve para el experimentado. | Alta | A5, A7; S01, S02 | EMO |
| RF-42 | Retroalimentación afectiva: el usuario declara cómo se siente (por ejemplo "estoy nervioso") y el asistente ajusta tono y ritmo. | Media | A10; S01 | EMO |

### 1.10 Plataforma (PWA)

| ID | Requerimiento | Prioridad | Origen | Área |
|---|---|---|---|---|
| RF-43 | La aplicación es una PWA instalable (manifest y service worker) que corre en laptop y móvil. | Alta | S13 | PWA |
| RF-44 | La receta en curso, sus temporizadores y el perfil funcionan sin conexión. | Alta | A5, A6; contexto técnico | PWA |


---

## 2. Requerimientos no funcionales (RNF)

Todos tienen una métrica verificable cuyos umbrales se validan en las pruebas de usabilidad.

| ID | Categoría | Requerimiento | Métrica | Prioridad | Origen |
|---|---|---|---|---|---|
| RNF-01 | Rendimiento (voz) | Un comando de voz reconocido se ejecuta rápido. | ≤ 1,5 s desde el fin de la frase hasta el cambio en pantalla (percentil 95). | Alta | A5; S01 |
| RNF-02 | Rendimiento (gestos) | Un gesto reconocido se ejecuta rápido y el video fluye. | ≤ 300 ms del gesto a la acción; ≥ 15 cuadros/s en un equipo de gama media. | Alta | A5; S13 |
| RNF-03 | Rendimiento (LLM) | El usuario recibe aviso de que el asistente trabaja y una respuesta acotada. | Indicador "pensando…" en ≤ 1 s; respuesta completa ≤ 8 s con proveedor remoto y ≤ 15 s con proveedor local (percentil 90). | Alta | A3, A7; S12 |
| RNF-04 | Precisión (voz) | Reconocimiento fiable de los comandos esenciales. | ≥ 90 % de aciertos con ruido ≤ 60 dB y ≥ 80 % con ruido de 70 a 80 dB. | Alta | Contexto físico; S04, S05 |
| RNF-05 | Precisión (gestos) | Reconocimiento fiable y pocas activaciones involuntarias. | ≥ 90 % de aciertos en los 4 gestos básicos; ≤ 1 falso positivo cada 5 minutos. | Alta | A5; S10 |
| RNF-06 | Seguridad alimentaria | Ninguna receta adaptada con un alérgeno declarado llega al usuario sin advertencia. | 100 % de detección (0 falsos negativos) en el conjunto de prueba: 10 recetas × 4 perfiles. | Alta | A3; S03, S16 |
| RNF-07 | Legibilidad | El paso actual se lee a distancia y con poca luz. | Texto del paso ≥ 32 px a 1 a 2 m; contraste ≥ 4,5:1 por defecto y ≥ 7:1 en modo alto contraste. | Alta | Contexto físico; S05, S08 |
| RNF-08 | Accesibilidad | La interfaz cumple pautas de accesibilidad web. | WCAG 2.1 nivel AA; objetivos táctiles ≥ 44 px; navegable por teclado. | Alta | S04–S08 |
| RNF-09 | Multiusuario | La sala se mantiene sincronizada. | Cambio de paso visible a los demás en ≤ 1 s (percentil 95); resincronización en ≤ 5 s tras reconectar; salas de hasta 4 participantes. | Alta | A8; S09 |
| RNF-10 | PWA y rendimiento de carga | Instalación y carga ágiles, uso sin red. | Lighthouse "instalable"; carga inicial ≤ 3 s en 4G; modo cocina completo sin conexión tras la primera carga. | Alta | Contexto técnico |
| RNF-11 | Privacidad | El video no sale del dispositivo y el usuario controla sus datos. | 100 % del procesamiento de gestos local; permisos de cámara y micrófono pedidos de forma explícita; perfil exportable y borrable en ≤ 2 pasos. | Alta | S13; conflicto privacidad |
| RNF-12 | Usabilidad (aprendizaje) | Un usuario nuevo aprende a usar el sistema sin manual. | Onboarding ≤ 2 min; ≥ 90 % de los participantes completa una receta de 10 pasos sin ayuda externa. | Alta | S01, S08 |
| RNF-13 | Compatibilidad | Funciona en navegadores y pantallas habituales. | Chrome, Edge y Safari en sus 2 últimas versiones; anchos desde 360 px; laptop y móvil. | Alta | S13 |
| RNF-14 | Mantenibilidad | Cambiar de proveedor LLM es barato. | Añadir un proveedor requiere solo un adaptador nuevo y cero cambios en la interfaz de usuario. | Alta | S11, S12 |
| RNF-15 | Tolerancia a fallos | Si un canal o la red fallan, el usuario puede seguir. | Cambio a un canal alterno en ≤ 3 s con aviso; receta en curso sigue sin conexión. | Alta | Contexto físico y técnico; S07 |
| RNF-16 | Experiencia emocional | La experiencia genera satisfacción y sensación de logro. | Puntuación ≥ 4 de 5 en el cuestionario de experiencia emocional; celebración ≤ 5 s y saltable en 1 acción. | Media | A9; S01 |
| RNF-17 | Persistencia | El perfil no se pierde entre sesiones. | 100 % de persistencia entre sesiones; guardado ≤ 1 s. | Alta | A10 |
| RNF-18 | Precisión de temporizadores | Los temporizadores son fiables incluso en segundo plano. | Error ≤ ±1 s en 30 min; alerta en ≤ 1 s tras vencer, también con la pestaña en segundo plano. | Alta | A6 |

**Total: 18 requerimientos no funcionales.**

---

## 3. Cobertura de las áreas obligatorias

| Área obligatoria | RF | RNF |
|---|---|---|
| Interfaz de voz | RF-02, RF-03, RF-15, RF-16, RF-18, RF-19 | RNF-01, RNF-04 |
| Capa de abstracción del LLM | RF-04 a RF-10, RF-13 | RNF-03, RNF-06, RNF-14 |
| PWA | RF-43, RF-44 | RNF-10, RNF-13, RNF-15 |
| Personalización continua (perfil persistente) | RF-01, RF-28 a RF-32 | RNF-17, RNF-11 |
| Multiusuario (salas, compartición) | RF-33 a RF-37 | RNF-09 |
| Diseño emocional (visceral, conductual, reflexivo) | RF-38 (visceral), RF-39 (conductual), RF-40 (reflexivo), RF-41, RF-42 | RNF-16 |
| Gestos (GUI no convencional) | RF-20 a RF-23 | RNF-02, RNF-05 |
| Accesibilidad (discapacidad motriz, visual, auditiva y del habla) | RF-11, RF-12, RF-14, RF-17, RF-24 a RF-27 | RNF-07, RNF-08, RNF-15 |
| Ayuda contextual | RF-13, RF-14 | RNF-12 |

### Cobertura por usuario con discapacidad

| Stakeholder | Requerimientos principales |
|---|---|
| S04 Motriz | RF-12, RF-18, RF-20, RF-23, RF-24, RF-25 |
| S05 Visual | RF-15, RF-21, RF-25, RF-27; RNF-07, RNF-08 |
| S06 Auditiva | RF-17, RF-21, RF-26; RNF-18 |
| S07 Habla | RF-19, RF-20, RF-24, RF-25; RNF-15 |


