// Fila única para getUserMedia. Si se piden micrófono y cámara a la vez, el navegador del
// celular descarta una de las preguntas o no logra abrir el dispositivo, y la app avisa un
// error sin que el usuario haya rechazado nada.

let tail: Promise<unknown> = Promise.resolve();

/** Ejecuta `task` cuando terminó la solicitud anterior, haya salido bien o mal. */
export function enqueueMediaRequest<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.catch(() => undefined);
  return run;
}
