// API de la aplicación: recetas y Gateway LLM. Con `serveApp` también sirve la PWA compilada
// desde el mismo origen, para exponer todo por un solo túnel HTTPS.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { LLMProviderId } from '@chef/shared';
import { createAssistantRouter } from './assistant/routes';
import { createCommunityRouter } from './community/routes';
import { createCommunityStore, type CommunityStore } from './community/store';
import { loadConfig } from './config';
import { getRecipe, getRecipes } from './data/recipes';
import type { LLMProvider } from './llm/LLMProvider';
import { createSelector } from './llm/ProviderSelector';

const APP_DIST = fileURLToPath(new URL('../../app/dist', import.meta.url));

export interface AppOptions {
  serveApp?: boolean;
  /** Proveedores de LLM que reemplazan a los reales; las pruebas inyectan proveedores falsos. */
  providers?: Partial<Record<LLMProviderId, LLMProvider>>;
  /** Destino del registro de qué proveedor respondió; por defecto, la consola. */
  llmLog?: (message: string) => void;
  /** Almacén de la Comunidad; las pruebas inyectan uno con un archivo temporal. */
  communityStore?: CommunityStore;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Se crea al primer uso: leer o sembrar el archivo no ocurre al importar ni al arrancar.
  let defaultStore: CommunityStore | undefined;
  const communityStore = () =>
    options.communityStore ??
    (defaultStore ??= createCommunityStore({ file: loadConfig().communityFile }));

  app.get('/api/health', async (_req, res) => {
    const { llm } = loadConfig();
    // Una Comunidad que no puede escribir no tumba el estado: solo se informa.
    const writable = await Promise.resolve()
      .then(() => communityStore().isWritable())
      .catch(() => false);
    res.json({
      status: 'ok',
      llm: { primary: llm.primary, fallback: llm.fallback },
      community: { writable },
    });
  });

  app.get('/api/recipes', (_req, res) => {
    res.json(getRecipes());
  });

  app.get('/api/recipes/:id', (req, res) => {
    const recipe = getRecipe(req.params.id);
    if (!recipe) {
      res.status(404).json({ error: 'Receta no encontrada' });
      return;
    }
    res.json(recipe);
  });

  // La configuración se lee en cada pedido: cambiar de proveedor no exige reiniciar (RF-09).
  app.use(
    '/api/assistant',
    createAssistantRouter(() => createSelector(loadConfig(), options.providers, options.llmLog)),
  );

  app.use('/api/community', createCommunityRouter(communityStore));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  if (options.serveApp) {
    if (!existsSync(APP_DIST)) {
      throw new Error('No existe app/dist: ejecuta `npm run build` antes de `npm start`.');
    }
    app.use(express.static(APP_DIST));
    // Cualquier otra ruta GET es de la PWA (rutas del lado del cliente).
    app.use((req, res, next) => {
      if (req.method !== 'GET') {
        next();
        return;
      }
      res.sendFile('index.html', { root: APP_DIST });
    });
  }

  // Último recurso: un cuerpo roto o demasiado grande responde `{ error }` y no una página con trazas.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (error as { status?: number }).status;
    if (status === 413) {
      res.status(413).json({ error: 'El pedido es demasiado grande.' });
    } else if (status !== undefined && status >= 400 && status < 500) {
      res.status(400).json({ error: 'El cuerpo del pedido no es un JSON válido.' });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  return app;
}
