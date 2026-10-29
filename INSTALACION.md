# Guía de instalación

## Requisitos

- Node.js 22.12 o superior (con npm).
- Para probar en el teléfono: Chrome en Android y [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/), que crea un túnel HTTPS gratuito sin cuenta.
- Opcional: una clave de [Groq](https://console.groq.com/keys) para el asistente. Sin clave, la app funciona igual y el asistente aparece como "no disponible".

## Instalación

```bash
npm install
cp server/.env.example server/.env   # y completa GROQ_API_KEY
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

- `remoto` usa Groq (`GROQ_API_KEY` y `GROQ_MODEL` en `server/.env`).
- `ollama` usa un modelo local (`OLLAMA_URL` y `OLLAMA_MODEL`).

## Verificación

```bash
npm run check   # formato, tipos, pruebas y build
```
