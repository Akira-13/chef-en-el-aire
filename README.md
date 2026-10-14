# 🍳 Chef en el Aire: cocina manos libres

Proyecto del curso **CC451 · Interacción Humano-Computador**, entrega **PC2**.

**Chef en el Aire** es una aplicación web progresiva (PWA) que permite seguir una receta sin tocar la pantalla: el usuario avanza los pasos con **gestos en el aire** o con **la voz**, ve cada paso en una **superposición grande con temporizadores**, y un **asistente con LLM** adapta la receta a sus alergias, a su despensa y a su nivel de habilidad. También permite **cocinar a distancia con otra persona** con los pasos sincronizados.

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

## Integrantes

-  Diego García 
-  Jarem Villalobos 
-  Aarón Flores 
-  Amir Canto 

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
| Historias de usuario | `docs/07-historias-usuario.md` *(pendiente)* |
| Matriz de trazabilidad | `docs/08-matriz-trazabilidad.md` *(pendiente)* |
| Alternativas de diseño | `docs/09-alternativas-diseno.md` *(pendiente)* |
| Arquitectura (C4) | [docs/arquitectura/](docs/arquitectura/) |
| Diseño, bocetos y prototipo | [diseno/](diseno/) |

- **Prototipo en Figma:** [enlace pendiente]
- **Video de la PC2:** [enlace pendiente]

---

## Arquitectura

Diagrama C4: ver [docs/arquitectura/](docs/arquitectura/).

### Capa de abstracción del LLM
*(A cargo del Integrante 3.)*

### Modelo del perfil de usuario persistente
*(A cargo del Integrante 3. Ejemplo de datos en [`datos/perfiles.json`](datos/perfiles.json).)*

### Estructura de salas multiusuario
*(A cargo del Integrante 3. Ejemplo en `salas_ejemplo` dentro de [`datos/perfiles.json`](datos/perfiles.json).)*

---

## Datos simulados

| Archivo | Contenido |
|---|---|
| [`datos/recetas.json`](datos/recetas.json) | 7 recetas (mayormente peruanas) con ingredientes, alérgenos, sustitutos, pasos con temporizador y mensaje de celebración |
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
