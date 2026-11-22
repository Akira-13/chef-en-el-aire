# Arquitectura (C4)

**Responsable:** Aarón Flores (Integrante 3)

Modelo C4 de **Chef en el Aire** en tres niveles: contexto, contenedores y componentes. Los diagramas están en Mermaid y GitHub los muestra directamente. Las referencias `RF-nn` / `RNF-nn` remiten a los requerimientos y `HU-nn` a las [historias de usuario](../07-historias-usuario.md).

---

## Nivel 1 · Contexto del sistema

Quién usa el sistema y con qué sistemas externos se relaciona.

```mermaid
flowchart TB
    cocinero["Cocinero<br/><small>Novato, experimentado, con alergias,<br/>con discapacidad motriz, visual,<br/>auditiva o del habla, adulto mayor</small>"]
    otros["Otras personas de la Comunidad<br/><small>Publican y comentan en otro momento</small>"]
    cuidador["Cuidador<br/><small>Configura el perfil de otra persona</small>"]

    sistema["Chef en el Aire<br/><small>PWA de cocina manos libres:<br/>voz, gestos, LLM, Comunidad</small>"]

    llmRemoto["Proveedor LLM remoto<br/><small>Claude u otro, vía API</small>"]
    llmLocal["LLM local<br/><small>Ollama</small>"]
    navegador["APIs del navegador<br/><small>Cámara + MediaPipe Hands,<br/>Web Speech (voz y TTS),<br/>notificaciones</small>"]

    cocinero -- "Sigue y adapta recetas<br/>por voz, gesto o toque" --> sistema
    otros -- "Comparten recetas adaptadas<br/>de forma asíncrona" --> sistema
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
        pwa["PWA · Interfaz<br/><small>HTML/JS · modo cocina, perfiles,<br/>Comunidad, ayuda contextual</small>"]
        sw["Service worker<br/><small>Caché offline de la app,<br/>receta en curso y perfil</small>"]
        gestos["Motor de gestos<br/><small>MediaPipe Hands en el navegador;<br/>el video no sale del equipo</small>"]
        voz["Motor de voz<br/><small>Web Speech: palabra de activación,<br/>comandos y TTS</small>"]
        local[("Almacenamiento local<br/><small>IndexedDB: perfil, despensa,<br/>historial, temporizadores;<br/>cola de la Comunidad</small>")]
    end

    subgraph servidor["Servidor"]
        api["API de la aplicación<br/><small>REST: recetas, perfiles,<br/>sincronización</small>"]
        gateway["Gateway LLM<br/><small>Capa de abstracción + validador<br/>local de alérgenos</small>"]
        comunidad["API de la Comunidad<br/><small>REST /api/community: publicaciones,<br/>comentarios y aplausos</small>"]
        bd[("Archivos JSON<br/><small>Recetas y publicaciones<br/>de la Comunidad</small>")]
    end

    llmRemoto["LLM remoto"]
    llmLocal["Ollama"]

    usuario --> pwa
    gestos -- "eventos de gesto" --> pwa
    voz -- "comandos reconocidos" --> pwa
    pwa -- "lee / escribe" --> local
    sw -.-|intercepta y cachea| pwa
    pwa -- "HTTPS / JSON" --> api
    pwa -- "HTTPS / JSON<br/>(sondeo cada 3 s)" --> comunidad
    api --> gateway
    api --> bd
    comunidad --> bd
    gateway --> llmRemoto
    gateway --> llmLocal
```

| Contenedor | Responsabilidad | Requerimientos |
|---|---|---|
| PWA · Interfaz | Pantallas, modo cocina, fusión de canales, diseño emocional | RF-01, RF-11 a RF-14, RF-24 a RF-27, RF-38 a RF-42; RNF-07, RNF-08, RNF-13 |
| Service worker | Instalación y funcionamiento sin conexión | RF-43, RF-44; RNF-10, RNF-15 |
| Motor de gestos | Detección local de gestos, sensibilidad configurable | RF-20 a RF-23; RNF-02, RNF-05, RNF-11 |
| Motor de voz | Palabra de activación, comandos, confianza, TTS | RF-15, RF-18, RF-19; RNF-01, RNF-04 |
| Almacenamiento local | Perfil persistente, estado de la receta en curso y cola sin conexión de la Comunidad | RF-28 a RF-30; RNF-17, RNF-18 |
| API de la aplicación | Recetas, sincronización de perfiles, cuidador | RF-02 a RF-04, RF-32 |
| Gateway LLM | Interfaz única, adaptadores, respaldo, validación de alérgenos | RF-05 a RF-10, RF-13; RNF-03, RNF-06, RNF-14 |
| API de la Comunidad | Publicar recetas adaptadas y logros, comentar, aplaudir y borrar lo propio; guarda todo en un archivo JSON | RF-33 a RF-37; RNF-09 |

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
```

- `FusionadorDeCanales` garantiza que toda acción esencial llegue por al menos dos canales y que cada canal se pueda apagar (RF-12, RF-24).
- `SalidaMultimodal` emite cada evento por dos canales de salida: visual y audio (RF-17, RF-26, RF-39).

### Comunidad (asíncrona)

La Comunidad es un espacio compartido sin tiempo real: las personas publican recetas adaptadas y logros, comentan y aplauden en el momento que les sirva. No hay conexión permanente; el cliente consulta cada pocos segundos.

```mermaid
flowchart LR
    subgraph pwa["PWA · Comunidad"]
        pantalla["Pantalla de la Comunidad<br/><small>lista, publicar, comentar,<br/>aplaudir, borrar lo propio</small>"]
        sondeo["Sondeo<br/><small>consulta cada 3 s<br/>solo con la pantalla visible</small>"]
        cola["Cola sin conexión<br/><small>localStorage; reintenta con<br/>espera creciente</small>"]
        cliente["Cliente REST<br/><small>nunca lanza error</small>"]
        dispositivo["Identificadores<br/><small>deviceKey del dispositivo<br/>y clientId por envío</small>"]
    end

    subgraph api["Servidor · /api/community"]
        rutas["Rutas REST<br/><small>posts, comments,<br/>applause, delete</small>"]
        validacion["Validación con zod<br/><small>alias, textos, receta</small>"]
        almacen["Almacén<br/><small>memoria + JSON, escrituras<br/>en serie y atómicas</small>"]
    end

    archivo[("server/.data/community.json")]

    pantalla --> sondeo
    pantalla --> cola
    sondeo --> cliente
    cola --> cliente
    dispositivo -.-> cola
    cliente -- "HTTPS / JSON" --> rutas
    rutas --> validacion
    validacion --> almacen
    almacen --> archivo
```

Rutas (todas bajo `/api/community`):

| Método y ruta | Qué hace |
|---|---|
| `GET /posts` | Devuelve hasta 50 publicaciones, de la más reciente a la más antigua, y `serverTime` |
| `POST /posts` | Publica una receta adaptada o un logro; `201` si es nueva y `200` con la existente si el `clientId` ya llegó |
| `POST /posts/:id/comments` | Agrega un comentario; mismo criterio de idempotencia con su `clientId` |
| `POST /posts/:id/applause` | Suma un aplauso por dispositivo; repetirlo no lo cuenta dos veces |
| `DELETE /posts/:id` | Borra la publicación solo si la pide el dispositivo que la publicó (`403` en otro caso) |

- **Almacenamiento:** el almacén mantiene las publicaciones en memoria y las guarda en un JSON (`COMMUNITY_FILE`, por defecto `server/.data/community.json`). Las escrituras se encadenan en una sola cola y se hacen de forma atómica (archivo temporal y `rename`), así un corte no deja el archivo a medias. Se conservan como máximo 200 publicaciones (al pasarse se descartan las más antiguas) y 200 comentarios por publicación. Si el archivo no existe, se siembra con dos publicaciones de demostración.
- **Sondeo del cliente:** consulta cada 3 s solo mientras la pantalla está visible. Sin servidor, conserva lo último cargado y avisa que la Comunidad no está disponible (RNF-09).
- **Cola sin conexión:** publicar, comentar y aplaudir entran primero a una cola persistida en el dispositivo y se envían enseguida; lo que no llega se reintenta con una espera que crece (2 s, 4 s… hasta 60 s) y se descarta tras 6 intentos fallidos. Se vacía también al volver la conexión (RF-37, RNF-09).
- **Sin duplicados:** cada publicación y comentario lleva un `clientId` generado una vez; si la cola lo reenvía, el servidor devuelve el existente en lugar de crear otro.
- **Un aplauso por dispositivo y borrado de lo propio:** el dispositivo genera una `deviceKey` aleatoria que no identifica a la persona. El servidor la guarda **con hash (SHA-256)**, **nunca la devuelve** y solo la usa para saber quién aplaudió y quién puede borrar.
- **Validación:** el servidor está expuesto por el túnel, así que valida todo con zod (alias de hasta 30 caracteres, textos de hasta 500, receta con el mismo esquema del recetario) y responde errores en español sin detalles internos. Quien abre una receta publicada la pasa por su propio validador local de alérgenos (RF-35).

---

## Decisiones de arquitectura

### Asíncrono en vez de WebSocket (16/11/2026)

**Decisión:** el requisito multiusuario (RF-33 a RF-37) se cubre con la Comunidad, una API REST con sondeo del cliente, y no con salas en tiempo real sobre WebSocket.

**Motivo:** un servidor en tiempo real y las pruebas con varios dispositivos a la vez no caben en el tiempo restante, y cocinar con otros no exige coincidir en el horario. La Comunidad conserva el valor multiusuario (compartir recetas adaptadas, comentarlas y celebrar logros) sin sincronizar pasos ni mantener conexiones abiertas. Ver [alcance](../06-alcance.md), sección 4.

**Consecuencias:**

- Lo publicado se ve en los demás dispositivos con un retraso de unos segundos (el intervalo de sondeo), dentro del umbral de RNF-09 (≤ 5 s en el percentil 95).
- El servidor no guarda estado de conexiones: solo atiende pedidos REST y escribe su archivo JSON.
- Quedan fuera del alcance los pasos sincronizados, los avatares por participante y la resincronización.
