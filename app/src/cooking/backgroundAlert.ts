// Aviso de un temporizador vencido por fuera de la pantalla: vibración, que también sirve a
// quien no oye la alarma (RF-26), y notificación del sistema si la app está en segundo plano.

const VIBRATION_PATTERN = [400, 200, 400];

export function vibrate(): void {
  navigator.vibrate?.(VIBRATION_PATTERN);
}

/** El permiso se pide de forma explícita y solo tras un toque del usuario (RNF-11). */
export function requestAlertPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

export async function notifyTimerDone(name: string): Promise<void> {
  if (!document.hidden || !('Notification' in window)) return;
  if (Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(`¡Terminó ${name}!`, {
    body: 'Toca para volver a la receta.',
    icon: '/icons/icon-192.png',
    tag: `timer-${name}`,
    requireInteraction: true,
  });
}
