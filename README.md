# 🍳 Chef en el Aire: cocina manos libres


Proyecto del curso **CC451 · Interacción Humano-Computador**, entrega **PC2**.

**Chef en el Aire** es una aplicación web progresiva (PWA) que permite seguir una receta sin tocar la pantalla: el usuario avanza los pasos con **gestos en el aire** o con **la voz**, ve cada paso en una **superposición grande con temporizadores**, y un **asistente con LLM** adapta la receta a sus alergias, a su despensa y a su nivel de habilidad. También permite **cocinar a distancia con otra persona** con los pasos sincronizados.

---

## Miembros - Grupo 4

- Aarón Alberca (bxcowo)
- Amir Canto (amirmiir)
- Diego García (Akira-13)
- Jarem Villalobos (therake77)

---

## Problema

Al cocinar, las manos están sucias, mojadas u ocupadas, y la pantalla del celular queda inaccesible: hay que tocarla con el nudillo, ensuciarla o pedir ayuda. Las apps de recetas actuales dependen del toque o de un único canal (solo voz), lo que además excluye a personas con discapacidad motriz, visual, auditiva o del habla.

## Objetivo

Diseñar una interfaz de cocina **sin contacto, multimodal y accesible** que permita a cualquier persona seguir, adaptar y compartir una receta de forma segura y agradable.

### Objetivos específicos
- Control completo por **voz** y por **gestos** (MediaPipe), con respaldo táctil; ninguna acción depende de un solo canal.
- **Adaptación de recetas con LLM** detrás de una capa de abstracción, con validación local de alérgenos.
- **Perfil persistente** que aprende gustos, restricciones y preferencias de accesibilidad.
- **Salas multiusuario** para cocinar a distancia con los pasos sincronizados.
- **Diseño emocional** según los tres niveles de Norman (visceral, conductual y reflexivo).

---

## Documentación

| Documento | Enlace |
|---|---|
| Análisis de stakeholders | [docs/01-stakeholders.md](docs/01-stakeholders.md) |
| Análisis PACT | [docs/02-pact.md](docs/02-pact.md) |
| Sistemas similares | [docs/03-sistemas-similares.md](docs/03-sistemas-similares.md) |
| Diagrama de Gantt | [docs/04-gantt.md](docs/04-gantt.md) |
| Requerimientos y alcance | `docs/05-requerimientos.md` *(pendiente)* |
| Criterios de usabilidad | `docs/06-criterios-usabilidad.md` *(pendiente)* |
| Historias de usuario | [docs/07-historias-usuario.md](docs/07-historias-usuario.md) |
| Matriz de trazabilidad | `docs/08-matriz-trazabilidad.md` *(pendiente)* |
| Alternativas de diseño | `docs/09-alternativas-diseno.md` *(pendiente)* |
| Arquitectura (C4) | [docs/arquitectura/](docs/arquitectura/) |
| Diseño, bocetos y prototipo | [diseno/](diseno/) |

- **Prototipo en Figma:** [enlace pendiente]
- **Video de la PC2:** [Enlace](https://drive.google.com/file/d/1gzogmhDqzjGPIxW2cg_0yGTsGrCo4aZh/view?usp=sharing)

---

## Arquitectura

Diagrama C4: ver [docs/arquitectura/](docs/arquitectura/).

### Capa de abstracción del LLM

La interfaz nunca llama a un proveedor de LLM directamente. Todo pasa por el **Gateway LLM**, que expone tres operaciones (`adaptarReceta`, `responderDuda` y `explicarPaso`) y por dentro usa una interfaz única, `ProveedorLLM`, con un adaptador por proveedor:

```
ServicioAsistente → ConstructorDePrompts → SelectorDeProveedor → ProveedorLLM
                                                                  ├── AdaptadorRemoto (Claude u otro)
                                                                  └── AdaptadorOllama (local)
                  ← ValidadorDeAlergenos ← ParserDeReceta ←───────┘
```

- **Cambiar de proveedor** es cambiar la configuración, sin tocar la interfaz de usuario (RF-09):
  ```json
  { "llm": { "principal": "remoto", "alterno": "ollama", "tiempo_limite_ms": 8000 } }
  ```
- **Añadir un proveedor** es escribir un adaptador nuevo que implemente `ProveedorLLM` (RNF-14).
- **Respaldo:** si el principal falla o supera el tiempo límite, se usa el alterno; si ambos fallan, la receta sigue sin adaptar y se avisa al usuario (RF-10).
- **Seguridad:** toda respuesta se convierte al formato JSON de [`datos/recetas.json`](datos/recetas.json) y pasa por un **validador local de alérgenos** que no depende del LLM. Si encuentra un alérgeno del perfil, bloquea la receta y pide confirmación explícita (RF-07, RNF-06).

### Modelo del perfil de usuario persistente

El perfil se guarda en el dispositivo (IndexedDB) para funcionar sin conexión y se sincroniza con el servidor cuando hay red. Su estructura es la de [`datos/perfiles.json`](datos/perfiles.json):

| Bloque | Contenido | Quién lo escribe |
|---|---|---|
| `id`, `nombre`, `edad`, `nivel_habilidad` | Datos básicos | Usuario |
| `explicito` | Alergias y su severidad, restricciones de comensales, dieta | Usuario o cuidador |
| `accesibilidad` | Canal de entrada preferido y activos, canales de salida, gestos habilitados, sensibilidad, tiempo de sostener el gesto, fuente, contraste, TTS, verbosidad, subtítulos, tipo de alerta | Usuario o cuidador |
| `aprendido` | Gustos, rechazos, sustituciones aceptadas, hábitos (por ejemplo `salta_lectura_completa`) | Sistema, con el uso |
| `emocional` | Tono del asistente, tipo de celebración, música ambiente | Usuario y sistema |
| `despensa` | Ingredientes disponibles | Usuario (voz o texto) |
| `historial` | Recetas hechas, fecha, valoración y sustituciones usadas | Sistema |
| `salas` | Salas a las que pertenece | Sistema |

- **Separación explícito / aprendido:** lo que el usuario declara nunca se sobrescribe con lo que el sistema infiere. Las restricciones de `explicito` siempre tienen prioridad.
- **Aprendizaje continuo (RF-29):** calificaciones, sustituciones aceptadas o rechazadas, pasos repetidos y emociones declaradas actualizan `aprendido`, `emocional` e `historial`.
- **Transparencia (RF-30):** la pantalla "lo que aprendí de ti" muestra el bloque `aprendido` y permite corregir o borrar cada dato.
- **Privacidad (RNF-11):** el perfil se exporta o se borra en 2 pasos como máximo; el video de la cámara no se guarda ni se envía.

### Estructura de salas multiusuario

Una sala es un estado compartido que mantiene el **servidor de salas** (WebSocket). Su estructura es la de `salas_ejemplo` en [`datos/perfiles.json`](datos/perfiles.json):

```json
{
  "id": "SALA-7K2P",
  "codigo": "7K2P",
  "receta_id": "REC-004",
  "modo": "sincronizado",
  "anfitrion": "USR-002",
  "participantes": [
    { "usuario": "USR-002", "paso_actual": 3, "conectado": true },
    { "usuario": "invitado-mama-diego", "paso_actual": 2, "conectado": true }
  ]
}
```

- **`codigo`:** 4 caracteres fáciles de dictar; sirve para unirse por voz o texto (RF-33).
- **`modo`:** `sincronizado` ("juntos": el paso del anfitrión manda) o `libre` ("a mi ritmo": cada uno avanza solo) (RF-34).
- **`participantes`:** cada uno con su `paso_actual` y si está `conectado`; la interfaz los muestra como avatares con su número de paso (RF-35). Máximo 4 participantes.
- **Eventos:** `unirse`, `salir`, `cambiar_paso`, `compartir_receta`, `compartir_logro` y `resincronizar`. Al reconectar, el cliente pide `resincronizar` y recibe el estado completo de la sala (RF-36, RF-37).
- **Metas (RNF-09):** cambio de paso visible a los demás en ≤ 1 s (percentil 95) y resincronización en ≤ 5 s.

---

## Datos simulados

| Archivo | Contenido |
|---|---|
| [`datos/recetas.json`](datos/recetas.json) | 10 recetas (mayormente peruanas) con ingredientes, alérgenos, sustitutos, pasos con temporizador y mensaje de celebración |
| [`datos/perfiles.json`](datos/perfiles.json) | 4 perfiles de prueba, incluyendo usuarios con discapacidad motriz, visual, auditiva y del habla; y una sala de ejemplo |

---

## Estructura del repositorio

```
chef-en-el-aire/
├── README.md
├── LICENSE
├── INSTALACION.md
├── datos/
│   ├── recetas.json
│   └── perfiles.json
├── docs/
│   ├── 01-stakeholders.md … 09-alternativas-diseno.md
│   └── arquitectura/        # Diagrama C4
└── diseno/
    ├── bocetos/             # 3 alternativas
    └── prototipo/           # Enlace y exportaciones de Figma, diagrama de interacciones
```

---

## Instalación

Ver [INSTALACION.md](INSTALACION.md). Estado actual: **en desarrollo**.

## Licencia

Distribuido bajo la licencia **MIT**. Ver [LICENSE](LICENSE).
