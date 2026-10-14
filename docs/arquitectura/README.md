# Arquitectura (C4)

**Responsable:** Aarón Flores (Integrante 3)

Modelo C4 de **Chef en el Aire** en tres niveles: contexto, contenedores y componentes. Los diagramas están en Mermaid y GitHub los muestra directamente. Las referencias `RF-nn` / `RNF-nn` remiten a los requerimientos y `HU-nn` a las [historias de usuario](../07-historias-usuario.md).

---

## Nivel 1 · Contexto del sistema

Quién usa el sistema y con qué sistemas externos se relaciona.

```mermaid
flowchart TB
    cocinero["Cocinero<br/><small>Novato, experimentado, con alergias,<br/>con discapacidad motriz, visual,<br/>auditiva o del habla, adulto mayor</small>"]
    remoto["Co-cocinero remoto<br/><small>Se une a una sala con un código</small>"]
    cuidador["Cuidador<br/><small>Configura el perfil de otra persona</small>"]

    sistema["Chef en el Aire<br/><small>PWA de cocina manos libres:<br/>voz, gestos, LLM, salas</small>"]

    llmRemoto["Proveedor LLM remoto<br/><small>Claude u otro, vía API</small>"]
    llmLocal["LLM local<br/><small>Ollama</small>"]
    navegador["APIs del navegador<br/><small>Cámara + MediaPipe Hands,<br/>Web Speech (voz y TTS),<br/>notificaciones</small>"]

    cocinero -- "Sigue y adapta recetas<br/>por voz, gesto o toque" --> sistema
    remoto -- "Cocina en la misma sala" --> sistema
    cuidador -- "Ajusta perfil y accesibilidad" --> sistema
    sistema -- "Adaptaciones y dudas<br/>(HTTPS)" --> llmRemoto
    sistema -- "Alternativa local<br/>(HTTP)" --> llmLocal
    sistema -- "Reconocimiento de gestos y voz<br/>en el dispositivo" --> navegador
```

---

## Nivel 2 · Contenedores

Piezas desplegables y cómo se comunican.

```mermaid
flowchart TB
    usuario["Usuario"]

    subgraph dispositivo["Dispositivo del usuario (navegador)"]
        pwa["PWA · Interfaz<br/><small>HTML/JS · modo cocina, perfiles,<br/>salas, ayuda contextual</small>"]
        sw["Service worker<br/><small>Caché offline de la app,<br/>receta en curso y perfil</small>"]
        gestos["Motor de gestos<br/><small>MediaPipe Hands en el navegador;<br/>el video no sale del equipo</small>"]
        voz["Motor de voz<br/><small>Web Speech: palabra de activación,<br/>comandos y TTS</small>"]
        local[("Almacenamiento local<br/><small>IndexedDB: perfil, despensa,<br/>historial, temporizadores</small>")]
    end

    subgraph servidor["Servidor"]
        api["API de la aplicación<br/><small>REST: recetas, perfiles,<br/>sincronización</small>"]
        gateway["Gateway LLM<br/><small>Capa de abstracción + validador<br/>local de alérgenos</small>"]
        salas["Servidor de salas<br/><small>WebSocket: estado de salas<br/>y participantes</small>"]
        bd[("Base de datos<br/><small>Recetas (JSON), perfiles,<br/>salas activas</small>")]
    end

    llmRemoto["LLM remoto"]
    llmLocal["Ollama"]

    usuario --> pwa
    gestos -- "eventos de gesto" --> pwa
    voz -- "comandos reconocidos" --> pwa
    pwa -- "lee / escribe" --> local
    sw -.-|intercepta y cachea| pwa
    pwa -- "HTTPS / JSON" --> api
    pwa -- "WebSocket" --> salas
    api --> gateway
    api --> bd
    salas --> bd
    gateway --> llmRemoto
    gateway --> llmLocal
```

| Contenedor | Responsabilidad | Requerimientos |
|---|---|---|
| PWA · Interfaz | Pantallas, modo cocina, fusión de canales, diseño emocional | RF-01, RF-11 a RF-14, RF-24 a RF-27, RF-38 a RF-42; RNF-07, RNF-08, RNF-13 |
| Service worker | Instalación y funcionamiento sin conexión | RF-43, RF-44; RNF-10, RNF-15 |
| Motor de gestos | Detección local de gestos, sensibilidad configurable | RF-20 a RF-23; RNF-02, RNF-05, RNF-11 |
| Motor de voz | Palabra de activación, comandos, confianza, TTS | RF-15, RF-18, RF-19; RNF-01, RNF-04 |
| Almacenamiento local | Perfil persistente y estado de la receta en curso | RF-28 a RF-30; RNF-17, RNF-18 |
| API de la aplicación | Recetas, sincronización de perfiles, cuidador | RF-02 a RF-04, RF-32 |
| Gateway LLM | Interfaz única, adaptadores, respaldo, validación de alérgenos | RF-05 a RF-10, RF-13; RNF-03, RNF-06, RNF-14 |
| Servidor de salas | Crear/unirse, sincronizar pasos, resincronizar | RF-33 a RF-37; RNF-09 |

---

## Nivel 3 · Componentes

### Gateway LLM (capa de abstracción)

```mermaid
flowchart LR
    api["API de la aplicación"]

    subgraph gateway["Gateway LLM"]
        servicio["ServicioAsistente<br/><small>adaptarReceta · responderDuda ·<br/>explicarPaso</small>"]
        prompts["ConstructorDePrompts<br/><small>receta + perfil + paso actual<br/>+ unidades caseras</small>"]
        selector["SelectorDeProveedor<br/><small>lee la configuración;<br/>respaldo si falla o expira</small>"]
        interfaz{{"«interfaz» ProveedorLLM<br/><small>completar(prompt, opciones)</small>"}}
        adRemoto["AdaptadorRemoto<br/><small>Claude u otro</small>"]
        adOllama["AdaptadorOllama"]
        parser["ParserDeReceta<br/><small>respuesta → JSON de receta</small>"]
        validador["ValidadorDeAlergenos<br/><small>reglas locales, sin LLM</small>"]
    end

    llmRemoto["LLM remoto"]
    llmLocal["Ollama"]

    api --> servicio
    servicio --> prompts
    prompts --> selector
    selector --> interfaz
    interfaz -.-|implementa| adRemoto
    interfaz -.-|implementa| adOllama
    adRemoto --> llmRemoto
    adOllama --> llmLocal
    selector -- "respuesta" --> parser
    parser --> validador
    validador -- "receta validada<br/>o bloqueada" --> servicio
```

- **Cambiar de proveedor** = cambiar la configuración que lee `SelectorDeProveedor`. **Añadir un proveedor** = escribir un adaptador nuevo que implemente `ProveedorLLM` (RF-09, RNF-14).
- `SelectorDeProveedor` aplica el respaldo: proveedor alterno y, si también falla, receta sin adaptar con aviso (RF-10).
- `ValidadorDeAlergenos` corre **después** del LLM y no depende de él: compara cada ingrediente con los alérgenos del perfil y de los comensales (RF-07, RNF-06).

### PWA · Modo cocina

```mermaid
flowchart LR
    gestos["Motor de gestos"]
    voz["Motor de voz"]
    tactil["Táctil / teclado"]

    subgraph pwa["PWA · Modo cocina"]
        fusion["FusionadorDeCanales<br/><small>normaliza voz, gesto y toque<br/>en comandos únicos</small>"]
        pasos["ControladorDePasos<br/><small>siguiente, anterior, repetir, pausar</small>"]
        timers["GestorDeTemporizadores<br/><small>varios en paralelo, con nombre</small>"]
        ayuda["AyudaContextual<br/><small>comandos válidos por paso</small>"]
        salida["SalidaMultimodal<br/><small>superposición, TTS, subtítulos,<br/>alertas, microinteracciones</small>"]
        perfil["ServicioDePerfil<br/><small>preferencias y aprendizaje</small>"]
        clienteSala["ClienteDeSala<br/><small>WebSocket</small>"]
    end

    gestos --> fusion
    voz --> fusion
    tactil --> fusion
    fusion --> pasos
    fusion --> timers
    pasos --> ayuda
    pasos --> salida
    timers --> salida
    perfil -.->|"configura canales,<br/>verbosidad y tono"| fusion
    perfil -.-> salida
    pasos <--> clienteSala
```

- `FusionadorDeCanales` garantiza que toda acción esencial llegue por al menos dos canales y que cada canal se pueda apagar (RF-12, RF-24).
- `SalidaMultimodal` emite cada evento por dos canales de salida: visual y audio (RF-17, RF-26, RF-39).
- `ClienteDeSala` publica los cambios de paso y aplica los recibidos según el modo de la sala (RF-34, RF-35).
