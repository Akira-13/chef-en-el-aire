// Al tocar la notificación de un temporizador, vuelve a la app que ya está abierta.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => (clients[0] ? clients[0].focus() : self.clients.openWindow('/'))),
  );
});
