// Recuerda si el usuario ya vio el recorrido inicial.

const STORAGE_KEY = 'chef.onboarded';

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Sin almacenamiento, el recorrido se ofrecerá de nuevo en la próxima visita.
  }
}
