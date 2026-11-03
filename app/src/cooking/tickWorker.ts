// Pulso del reloj de temporizadores. Chrome frena los intervalos de una pestaña oculta hasta uno
// por minuto, pero no los de un worker: así la alerta sale a tiempo en segundo plano (RNF-18).

const TICK_MS = 500;

setInterval(() => self.postMessage('tick'), TICK_MS);
