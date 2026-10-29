// Perfil persistente del usuario (RF-28). Separa lo que el usuario declara (`explicit`)
// de lo que el sistema infiere con el uso (`learned`): lo explícito siempre tiene prioridad.
// Los valores de dominio se conservan como en datos/perfiles.json.

import type { AllergenCategory } from './recipe';

export type SkillLevel = 'novato' | 'intermedio' | 'avanzado';
export type InputChannel = 'voz' | 'gestos' | 'tactil';
export type OutputChannel = 'visual' | 'audio';
export type GestureId =
  | 'deslizar_siguiente'
  | 'deslizar_anterior'
  | 'palma_abierta_pausar'
  | 'pulgar_arriba_confirmar'
  | 'mano_alzada_ayuda';
export type FontSize = 'normal' | 'grande' | 'extragrande';
export type Verbosity = 'breve' | 'detallada';
export type GestureSensitivity = 'normal' | 'alta_tolerancia';
export type CelebrationStyle = 'breve' | 'completa' | 'sonora' | 'solo_visual';

export interface DinerRestriction {
  /** Quién come el plato, por ejemplo "esposo". */
  diner: string;
  restriction: AllergenCategory;
  reason: string;
}

export interface ExplicitData {
  allergies: AllergenCategory[];
  allergySeverity?: string;
  dinerRestrictions: DinerRestriction[];
  diet: string;
}

export interface TimerAlertPrefs {
  sound: boolean;
  fullScreenVisual: boolean;
  flash?: boolean;
  persistUntilConfirmed?: boolean;
}

// Preferencias de accesibilidad (RF-25). Los campos opcionales pueden faltar en los perfiles
// de prueba; quien los consuma debe usar un valor por defecto razonable.
export interface AccessibilityPrefs {
  condition: string | null;
  preferredInput: InputChannel;
  activeInputs: InputChannel[];
  outputs: OutputChannel[];
  enabledGestures: GestureId[];
  gestureSensitivity: GestureSensitivity;
  gestureHoldMs: number;
  fontSize: FontSize;
  highContrast: boolean;
  ttsEnabled: boolean;
  verbosity: Verbosity;
  subtitles?: boolean;
  timerAlert: TimerAlertPrefs;
  screenReader?: boolean;
  gestureSoundConfirmation?: boolean;
  autoReadSteps?: boolean;
  requiresActivationGesture?: boolean;
  distinctTimerSounds?: boolean;
  voiceDisabled?: boolean;
  /** Volumen de 0 a 1. */
  volume?: number;
  /** Tiempo que la voz espera antes de dar un comando por terminado (CA-21.2). */
  voiceTimeoutMs?: number;
}

export interface AcceptedSubstitution {
  original: string;
  substitute: string;
}

export interface LearnedData {
  likes: string[];
  dislikes: string[];
  acceptedSubstitutions: AcceptedSubstitution[];
  skipsFullReading?: boolean;
  frequentQueries?: string[];
  frequentExplanations?: string[];
}

export interface EmotionalPrefs {
  assistantTone: string;
  celebration: CelebrationStyle;
  ambientMusic: string;
}

export interface HistoryEntry {
  recipeId: string;
  /** Fecha en formato AAAA-MM-DD. */
  date: string;
  /** Valoración de 1 a 5. */
  rating?: number;
  /** Ids de ingredientes que se sustituyeron. */
  substitutions: string[];
}

export interface Profile {
  /** Identificador, por ejemplo "USR-002". */
  id: string;
  name: string;
  age: number;
  skillLevel: SkillLevel;
  explicit: ExplicitData;
  accessibility: AccessibilityPrefs;
  learned: LearnedData;
  emotional: EmotionalPrefs;
  pantry: string[];
  history: HistoryEntry[];
  rooms: string[];
}
