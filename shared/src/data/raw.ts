// Forma exacta de datos/recetas.json y datos/perfiles.json (claves en español).
// Solo se usa en los bordes: al leer los archivos y al exportar el perfil.
// El resto del código trabaja con los tipos de ../types.

import type { AllergenCategory, Difficulty, SubstituteReason } from '../types/recipe';
import type {
  CelebrationStyle,
  FontSize,
  GestureId,
  GestureSensitivity,
  InputChannel,
  OutputChannel,
  SkillLevel,
  Verbosity,
} from '../types/profile';

export interface RawSubstitute {
  nombre: string;
  cantidad: number;
  unidad: string;
  motivo: SubstituteReason;
}

export interface RawIngredient {
  id: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  alergenos: AllergenCategory[];
  sustitutos: RawSubstitute[];
}

export interface RawStep {
  n: number;
  texto: string;
  texto_corto: string;
  temporizador_seg: number | null;
  nombre_temporizador?: string;
  pista_listo?: string;
  advertencia?: string;
}

export interface RawRecipe {
  id: string;
  nombre: string;
  descripcion: string;
  porciones: number;
  dificultad: Difficulty;
  tiempo_total_min: number;
  etiquetas: string[];
  alergenos: AllergenCategory[];
  ingredientes: RawIngredient[];
  pasos: RawStep[];
  celebracion: string;
}

export interface RawRecipeBook {
  version: string;
  descripcion: string;
  categorias_alergenos: AllergenCategory[];
  recetas: RawRecipe[];
}

export interface RawDinerRestriction {
  comensal: string;
  restriccion: AllergenCategory;
  motivo: string;
}

export interface RawExplicitData {
  alergias: AllergenCategory[];
  severidad_alergia?: string;
  restricciones_comensales: RawDinerRestriction[];
  dieta: string;
}

export interface RawTimerAlertPrefs {
  sonido: boolean;
  visual_pantalla_completa: boolean;
  parpadeo?: boolean;
  persistente_hasta_confirmar?: boolean;
}

export interface RawAccessibilityPrefs {
  condicion: string | null;
  canal_entrada_preferido: InputChannel;
  canales_entrada_activos: InputChannel[];
  canales_salida: OutputChannel[];
  gestos_habilitados: GestureId[];
  sensibilidad_gestos: GestureSensitivity;
  tiempo_sostener_gesto_ms: number;
  tamano_fuente: FontSize;
  alto_contraste: boolean;
  tts_activo: boolean;
  verbosidad: Verbosity;
  subtitulos?: boolean;
  alerta_temporizador: RawTimerAlertPrefs;
  compatible_lector_pantalla?: boolean;
  confirmacion_sonora_gestos?: boolean;
  lectura_automatica_pasos?: boolean;
  requiere_gesto_activacion?: boolean;
  sonido_distinto_por_temporizador?: boolean;
  voz_desactivada?: boolean;
  volumen?: number;
  tiempo_espera_voz_ms?: number;
}

export interface RawLearnedData {
  le_gusta: string[];
  no_le_gusta: string[];
  sustituciones_aceptadas: { original: string; sustituto: string }[];
  salta_lectura_completa?: boolean;
  consulta_frecuente?: string[];
  pide_explicacion_frecuente?: string[];
}

export interface RawEmotionalPrefs {
  tono_asistente: string;
  celebracion: CelebrationStyle;
  musica_ambiente: string;
}

export interface RawHistoryEntry {
  receta_id: string;
  fecha: string;
  valoracion?: number;
  sustituciones: string[];
}

export interface RawProfile {
  id: string;
  nombre: string;
  edad: number;
  nivel_habilidad: SkillLevel;
  explicito: RawExplicitData;
  accesibilidad: RawAccessibilityPrefs;
  aprendido: RawLearnedData;
  emocional: RawEmotionalPrefs;
  despensa: string[];
  historial: RawHistoryEntry[];
  salas: string[];
}

export interface RawProfileBook {
  version: string;
  descripcion: string;
  perfiles: RawProfile[];
  // Ejemplo de sala del diseño original; hoy no se usa en el código.
  salas_ejemplo?: unknown[];
}
