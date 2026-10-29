// Nombres de las métricas que se registran durante el uso, para el informe que compara
// cada valor con el umbral de su RNF (CA-37.1).

export const METRIC_NAMES = [
  'voice.commandToRender', // RNF-01: fin de la frase → cambio en pantalla
  'gesture.toAction', // RNF-02: gesto reconocido → acción
  'gesture.fps', // RNF-02: cuadros por segundo del reconocedor
  'llm.thinking', // RNF-03: petición → indicador "pensando…"
  'llm.response', // RNF-03: petición → respuesta completa
  'timer.drift', // RNF-18: desfase del temporizador al vencer
  'profile.save', // RNF-17: duración del guardado del perfil
  'channel.fallback', // RNF-15: falla de un canal → canal alterno
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

export type MetricUnit = 'ms' | 'fps';

export interface MetricSample {
  name: MetricName;
  value: number;
  unit: MetricUnit;
  /** Fecha y hora ISO del registro. */
  at: string;
  meta?: Record<string, string | number | boolean>;
}
