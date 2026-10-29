// Contratos de los servicios del cliente. Cada servicio tiene una implementación en su
// propia carpeta (output/, profile/) y se conecta en core/services.ts. Estos contratos
// solo se amplían: no se renombra ni se quita nada que otra parte ya use.

import type { Channel, Feeling, InputChannel, Profile, RawProfile } from '@chef/shared';

// ---------- Salida multimodal ----------

export type AnnouncementKind = 'step' | 'answer' | 'info' | 'success' | 'error' | 'alert';

export interface Announcement {
  /** Texto completo (verbosidad "detallada"). */
  text: string;
  /** Texto breve (verbosidad "breve", CA-13.3); si falta, se usa `text`. */
  short?: string;
  kind?: AnnouncementKind;
}

export type CueKind = 'success' | 'error' | 'gesture' | 'navigate' | 'timer' | 'celebration';

export interface OutputDeps {
  /** Perfil actual, para respetar canales de salida, verbosidad y volumen. */
  getProfile(): Profile;
}

export interface OutputService {
  /**
   * Comunica un mensaje por todos los canales de salida activos del perfil: voz (TTS),
   * subtítulos y región ARIA (RF-15, RF-26, RF-27).
   */
  announce(announcement: Announcement): void;
  /** Sonido corto con su equivalente visual (RF-39, CA-20.3). */
  cue(kind: CueKind): void;
  /** Corta la lectura en curso. */
  stop(): void;
}

// ---------- Perfil persistente ----------

// Eventos de uso con los que el perfil aprende (RF-29).
export type UsageEvent =
  | { type: 'readingSkipped'; recipeId: string; stepNumber: number }
  | { type: 'stepRepeated'; recipeId: string; stepNumber: number }
  | { type: 'explanationRequested'; recipeId: string; stepNumber: number; term?: string }
  | {
      type: 'substitutionAccepted';
      recipeId: string;
      ingredientId: string;
      original: string;
      substitute: string;
    }
  | {
      type: 'substitutionRejected';
      recipeId: string;
      ingredientId: string;
      original: string;
      substitute: string;
    }
  | { type: 'commandFailed'; channel: Channel }
  | { type: 'feelingDeclared'; feeling: Feeling }
  | { type: 'recipeCompleted'; recipeId: string; substitutions: string[] }
  | { type: 'recipeRated'; recipeId: string; rating: number };

export interface ProfileSummary {
  id: string;
  name: string;
  condition: string | null;
  preferredInput: InputChannel;
}

export interface ProfileService {
  /** Se resuelve cuando el perfil guardado ya se cargó. */
  ready: Promise<void>;
  /** Devuelve siempre el mismo objeto mientras el perfil no cambie. */
  getProfile(): Profile;
  subscribe(listener: () => void): () => void;
  /** Reemplaza el perfil actual por el que devuelve `updater` y lo guarda (RNF-17). */
  update(updater: (current: Profile) => Profile): Promise<void>;
  listProfiles(): ProfileSummary[];
  selectProfile(id: string): Promise<void>;
  recordEvent(event: UsageEvent): Promise<void>;
  /**
   * Avisos que el perfil quiere comunicar al usuario, por ejemplo cuando aprende algo
   * ("A partir de ahora leeré solo lo breve", CA-24.1). core/services.ts los anuncia.
   */
  onNotice(listener: (message: string) => void): () => void;
  /** Perfil actual en el formato de datos/perfiles.json, para exportarlo (RNF-11). */
  exportRaw(): RawProfile;
  /** Borra lo guardado y vuelve a los perfiles de prueba. */
  reset(): Promise<void>;
}
