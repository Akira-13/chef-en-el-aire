// En la primera visita el service worker todavía no controla la página, así que la petición de
// recetas no pasa por él y quedaría fuera de la caché: sin esto, el modo sin conexión recién
// funcionaría después de recargar (CA-34.3). El nombre es el de la regla de vite.config.ts.

const RECIPES_CACHE = 'chef-recipes';

export async function primeRecipesCache(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return;
  await navigator.serviceWorker.ready;
  try {
    const cache = await caches.open(RECIPES_CACHE);
    await cache.add('/api/recipes');
  } catch {
    // Sin red no hay nada que guardar: se reintenta en la próxima carga.
  }
}
