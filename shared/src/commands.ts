// Vocabulario único de comandos. Voz, gestos, toque y teclado se traducen a estos mismos
// comandos antes de llegar a las pantallas, así toda acción esencial funciona por varios
// canales (RF-12, RF-24).

export type Channel = 'voice' | 'gesture' | 'touch' | 'keyboard';

export type Feeling = 'nervous' | 'tired' | 'confused' | 'happy';

export type Command =
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'repeat' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'startTimer'; name?: string }
  | { type: 'stopTimer'; name?: string }
  | { type: 'queryTimer'; name?: string }
  | { type: 'dismissAlert' }
  | { type: 'explain' }
  | { type: 'help' }
  | { type: 'whereAmI' }
  | { type: 'substitute'; ingredient: string }
  | { type: 'ask'; question: string }
  | { type: 'search'; query: string }
  | { type: 'addPantry'; items: string[] }
  | { type: 'rate'; value: 'up' | 'down' }
  | { type: 'feeling'; feeling: Feeling }
  | { type: 'skip' }
  | { type: 'cameraOn' }
  | { type: 'cameraOff' }
  | { type: 'lockGestures'; seconds?: number };

export type CommandType = Command['type'];

export interface CommandEvent {
  command: Command;
  channel: Channel;
  /** Instante de emisión con performance.now(), para medir latencias (RNF-01, RNF-02). */
  at: number;
  /** Confianza del reconocimiento entre 0 y 1, si el canal la reporta. */
  confidence?: number;
  /** Frase reconocida, si el comando vino por voz. */
  transcript?: string;
}

// Nombre de cada comando tal como se muestra o se dice en la ayuda contextual (RF-14).
export const COMMAND_LABELS: Record<CommandType, string> = {
  next: 'siguiente',
  previous: 'anterior',
  repeat: 'repetir',
  pause: 'pausar',
  resume: 'continuar',
  confirm: 'confirmo',
  cancel: 'cancelar',
  startTimer: 'inicia temporizador',
  stopTimer: 'detén temporizador',
  queryTimer: '¿cuánto falta?',
  dismissAlert: 'listo',
  explain: 'explícame',
  help: 'ayuda',
  whereAmI: '¿dónde estoy?',
  substitute: 'sustituye…',
  ask: 'pregunta…',
  search: 'busca…',
  addPantry: 'tengo…',
  rate: 'me gustó / no me gustó',
  feeling: 'estoy…',
  skip: 'saltar',
  cameraOn: 'enciende la cámara',
  cameraOff: 'apaga la cámara',
  lockGestures: 'bloquea gestos',
};

export type ScreenId = 'home' | 'recipe' | 'cooking' | 'celebration' | 'profile' | 'onboarding';

// Estado mínimo que necesita la ayuda contextual para saber qué comandos valen ahora.
export interface CommandContext {
  screen: ScreenId;
  recipeId?: string;
  stepNumber?: number;
  totalSteps?: number;
  stepHasTimer?: boolean;
  activeTimers: string[];
  alertActive: boolean;
}
