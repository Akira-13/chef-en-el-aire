# Guía de instalación

## Requisitos

- Node.js 22.12 o superior (con npm).
- Para probar en el teléfono: Chrome en Android y [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/), que crea un túnel HTTPS gratuito sin cuenta.
- Opcional: una clave de [DeepSeek](https://platform.deepseek.com/api_keys) para el asistente. Sin clave, la app funciona igual y el asistente aparece como "no disponible".
- Opcional: [Ollama](https://ollama.com/download) como respaldo local del asistente (ver "Configuración del asistente").

## Instalación

```bash
npm install
cp server/.env.example server/.env   # y completa DEEPSEEK_API_KEY
```

## Desarrollo

```bash
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3001 (la app le redirige `/api`)

## Probar en el teléfono

La cámara, el micrófono, la instalación de la PWA y el modo sin conexión requieren HTTPS. Con el túnel, el teléfono abre la app por una URL `https://….trycloudflare.com`:

```bash
npm run demo                                  # compila la app y sirve todo en :3000
cloudflared tunnel --url http://localhost:3000
```

Para desarrollar con recarga en caliente desde el teléfono, deja `npm run dev` corriendo y abre el túnel a `http://localhost:5173`.

## Configuración del asistente

El proveedor de LLM se elige en `server/llm.config.json`, sin tocar la interfaz:

```json
{ "llm": { "principal": "remoto", "alterno": "ollama", "tiempo_limite_ms": 8000 } }
```

- `principal` y `alterno` son `remoto` (DeepSeek) u `ollama`. Si el principal falla, expira o devuelve una respuesta que no se puede interpretar, se prueba el alterno.
- `tiempo_limite_ms` es el límite de cada intento. Si los dos proveedores fallan, el asistente responde "no disponible" y la receta original sigue usable.
- La configuración se lee en cada pedido: cambiar el archivo no exige reiniciar el servidor.

Las claves y los modelos van en `server/.env` (a partir de `server/.env.example`). La clave nunca llega al navegador.

| Variable            | Para qué sirve                  | Valor por defecto               |
| ------------------- | ------------------------------- | ------------------------------- |
| `DEEPSEEK_API_KEY`  | Clave de DeepSeek (`remoto`)    | vacía: el proveedor se omite    |
| `DEEPSEEK_MODEL`    | Modelo de DeepSeek              | `deepseek-flash`                |
| `DEEPSEEK_BASE_URL` | Dirección de la API de DeepSeek | `https://api.deepseek.com`      |
| `OLLAMA_URL`        | Servidor de Ollama (`ollama`)   | `http://localhost:11434`        |
| `OLLAMA_MODEL`      | Modelo local de Ollama          | `llama3.1`                      |
| `PORT`              | Puerto del servidor             | 3001 con `dev`, 3000 con `demo` |

### Ollama como respaldo (opcional)

Con [Ollama](https://ollama.com/download) el asistente sigue respondiendo cuando DeepSeek no está disponible o no hay clave. El primer modelo se descarga una sola vez y necesita varios GB de disco:

```bash
ollama pull llama3.1      # o el modelo que pongas en OLLAMA_MODEL
ollama serve              # si no corre ya como servicio; escucha en :11434
curl localhost:11434/api/tags   # debe listar el modelo descargado
```

Para comprobar el respaldo, deja `DEEPSEEK_API_KEY` vacía (o con una clave inválida) y llama a una de las rutas de abajo: la consola del servidor muestra `[llm] remoto no está configurado, se omite` o `[llm] remoto falló` y luego `[llm] respondió ollama en … ms`. Para usar solo el modelo local, pon `"principal": "ollama"`.

### Probar el asistente con `curl`

Con el servidor en marcha (`npm run dev`, o `npm run dev -w @chef/server` si no necesitas la app), en otra terminal:

```bash
curl localhost:3001/api/health     # muestra el proveedor principal y el alterno
```

Adaptar la ocopa (REC-008) para una persona alérgica al maní. Debe responder en unos 8 s como máximo; `status` es `ok` si la receta quedó sin alérgenos o `blocked` (con `findings`) si el validador local encontró alguno:

```bash
curl -X POST localhost:3001/api/assistant/adapt -H 'Content-Type: application/json' \
  -d '{"recipeId":"REC-008","constraints":{"allergies":["mani"],"dinerRestrictions":[],"diet":"omnivora"},"pantry":[],"skillLevel":"novato"}'
```

Preguntar sobre un paso (`answer` de 2 frases como máximo y, a veces, `moreDetail`):

```bash
curl -X POST localhost:3001/api/assistant/ask -H 'Content-Type: application/json' \
  -d '{"recipeId":"REC-008","stepNumber":4,"question":"¿Cuánto hiervo las papas?","skillLevel":"novato","constraints":{"allergies":["mani"],"dinerRestrictions":[],"diet":"omnivora"}}'
```

Explicar un paso. Si el paso trae su señal de "cuándo está listo" (por ejemplo el paso 1), responde al instante con `readyCueSource: "recipe"` y sin llamar al modelo; si no (paso 4), la genera el asistente y la marca como `"assistant"`:

```bash
curl -X POST localhost:3001/api/assistant/explain -H 'Content-Type: application/json' \
  -d '{"recipeId":"REC-008","stepNumber":4,"skillLevel":"novato","constraints":{"allergies":["mani"],"dinerRestrictions":[],"diet":"omnivora"}}'
```

Si la respuesta de `ask` o `explain` nombra un alérgeno del perfil, trae `allergenWarnings`. Si ningún proveedor responde, las tres rutas devuelven `503` con `{"status":"unavailable","message":"El asistente no está disponible, sigues con la receta original."}`; la app muestra ese aviso y, en la pantalla de la receta, ofrece los sustitutos del recetario que no necesitan al asistente.

## Verificación

```bash
npm run check   # formato, tipos, pruebas y build
```
