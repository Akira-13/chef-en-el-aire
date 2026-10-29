// API de la aplicación: recetas y Gateway LLM. Con `serveApp` también sirve la PWA compilada
// desde el mismo origen, para exponer todo por un solo túnel HTTPS.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { assistantRouter } from './assistant/routes';
import { loadConfig } from './config';
import { getRecipe, getRecipes } from './data/recipes';

const APP_DIST = fileURLToPath(new URL('../../app/dist', import.meta.url));

export function createApp(options: { serveApp?: boolean } = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const { llm } = loadConfig();
    res.json({ status: 'ok', llm: { primary: llm.primary, fallback: llm.fallback } });
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

  app.use('/api/assistant', assistantRouter);

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

  return app;
}
