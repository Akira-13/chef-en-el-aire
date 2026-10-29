// Único punto de traducción entre el formato de los archivos (claves en español) y los
// tipos del código. Las conversiones son simétricas: toRaw(fromRaw(x)) devuelve los mismos datos,
// así una receta adaptada conserva la estructura del recetario (CA-04.3) y el perfil se
// exporta en el mismo formato de datos/perfiles.json (RNF-11).

import type { Ingredient, Recipe, Step, Substitute } from '../types/recipe';
import type { AccessibilityPrefs, HistoryEntry, Profile } from '../types/profile';
import type {
  RawAccessibilityPrefs,
  RawHistoryEntry,
  RawIngredient,
  RawProfile,
  RawRecipe,
  RawRecipeBook,
  RawStep,
  RawSubstitute,
} from './raw';

function toSubstitute(raw: RawSubstitute): Substitute {
  return { name: raw.nombre, quantity: raw.cantidad, unit: raw.unidad, reason: raw.motivo };
}

function toRawSubstitute(sub: Substitute): RawSubstitute {
  return { nombre: sub.name, cantidad: sub.quantity, unidad: sub.unit, motivo: sub.reason };
}

function toIngredient(raw: RawIngredient): Ingredient {
  return {
    id: raw.id,
    name: raw.nombre,
    quantity: raw.cantidad,
    unit: raw.unidad,
    allergens: [...raw.alergenos],
    substitutes: raw.sustitutos.map(toSubstitute),
  };
}

function toRawIngredient(ing: Ingredient): RawIngredient {
  return {
    id: ing.id,
    nombre: ing.name,
    cantidad: ing.quantity,
    unidad: ing.unit,
    alergenos: [...ing.allergens],
    sustitutos: ing.substitutes.map(toRawSubstitute),
  };
}

function toStep(raw: RawStep): Step {
  return {
    number: raw.n,
    text: raw.texto,
    shortText: raw.texto_corto,
    timerSeconds: raw.temporizador_seg,
    timerName: raw.nombre_temporizador,
    readyCue: raw.pista_listo,
    warning: raw.advertencia,
  };
}

function toRawStep(step: Step): RawStep {
  return {
    n: step.number,
    texto: step.text,
    texto_corto: step.shortText,
    temporizador_seg: step.timerSeconds,
    nombre_temporizador: step.timerName,
    pista_listo: step.readyCue,
    advertencia: step.warning,
  };
}

export function toRecipe(raw: RawRecipe): Recipe {
  return {
    id: raw.id,
    name: raw.nombre,
    description: raw.descripcion,
    servings: raw.porciones,
    difficulty: raw.dificultad,
    totalMinutes: raw.tiempo_total_min,
    tags: [...raw.etiquetas],
    allergens: [...raw.alergenos],
    ingredients: raw.ingredientes.map(toIngredient),
    steps: raw.pasos.map(toStep),
    celebration: raw.celebracion,
  };
}

export function toRawRecipe(recipe: Recipe): RawRecipe {
  return {
    id: recipe.id,
    nombre: recipe.name,
    descripcion: recipe.description,
    porciones: recipe.servings,
    dificultad: recipe.difficulty,
    tiempo_total_min: recipe.totalMinutes,
    etiquetas: [...recipe.tags],
    alergenos: [...recipe.allergens],
    ingredientes: recipe.ingredients.map(toRawIngredient),
    pasos: recipe.steps.map(toRawStep),
    celebracion: recipe.celebration,
  };
}

export function toRecipes(book: RawRecipeBook): Recipe[] {
  return book.recetas.map(toRecipe);
}

function toAccessibility(raw: RawAccessibilityPrefs): AccessibilityPrefs {
  return {
    condition: raw.condicion,
    preferredInput: raw.canal_entrada_preferido,
    activeInputs: [...raw.canales_entrada_activos],
    outputs: [...raw.canales_salida],
    enabledGestures: [...raw.gestos_habilitados],
    gestureSensitivity: raw.sensibilidad_gestos,
    gestureHoldMs: raw.tiempo_sostener_gesto_ms,
    fontSize: raw.tamano_fuente,
    highContrast: raw.alto_contraste,
    ttsEnabled: raw.tts_activo,
    verbosity: raw.verbosidad,
    subtitles: raw.subtitulos,
    timerAlert: {
      sound: raw.alerta_temporizador.sonido,
      fullScreenVisual: raw.alerta_temporizador.visual_pantalla_completa,
      flash: raw.alerta_temporizador.parpadeo,
      persistUntilConfirmed: raw.alerta_temporizador.persistente_hasta_confirmar,
    },
    screenReader: raw.compatible_lector_pantalla,
    gestureSoundConfirmation: raw.confirmacion_sonora_gestos,
    autoReadSteps: raw.lectura_automatica_pasos,
    requiresActivationGesture: raw.requiere_gesto_activacion,
    distinctTimerSounds: raw.sonido_distinto_por_temporizador,
    voiceDisabled: raw.voz_desactivada,
    volume: raw.volumen,
    voiceTimeoutMs: raw.tiempo_espera_voz_ms,
  };
}

function toRawAccessibility(prefs: AccessibilityPrefs): RawAccessibilityPrefs {
  return {
    condicion: prefs.condition,
    canal_entrada_preferido: prefs.preferredInput,
    canales_entrada_activos: [...prefs.activeInputs],
    canales_salida: [...prefs.outputs],
    gestos_habilitados: [...prefs.enabledGestures],
    sensibilidad_gestos: prefs.gestureSensitivity,
    tiempo_sostener_gesto_ms: prefs.gestureHoldMs,
    tamano_fuente: prefs.fontSize,
    alto_contraste: prefs.highContrast,
    tts_activo: prefs.ttsEnabled,
    verbosidad: prefs.verbosity,
    subtitulos: prefs.subtitles,
    alerta_temporizador: {
      sonido: prefs.timerAlert.sound,
      visual_pantalla_completa: prefs.timerAlert.fullScreenVisual,
      parpadeo: prefs.timerAlert.flash,
      persistente_hasta_confirmar: prefs.timerAlert.persistUntilConfirmed,
    },
    compatible_lector_pantalla: prefs.screenReader,
    confirmacion_sonora_gestos: prefs.gestureSoundConfirmation,
    lectura_automatica_pasos: prefs.autoReadSteps,
    requiere_gesto_activacion: prefs.requiresActivationGesture,
    sonido_distinto_por_temporizador: prefs.distinctTimerSounds,
    voz_desactivada: prefs.voiceDisabled,
    volumen: prefs.volume,
    tiempo_espera_voz_ms: prefs.voiceTimeoutMs,
  };
}

function toHistoryEntry(raw: RawHistoryEntry): HistoryEntry {
  return {
    recipeId: raw.receta_id,
    date: raw.fecha,
    rating: raw.valoracion,
    substitutions: [...raw.sustituciones],
  };
}

function toRawHistoryEntry(entry: HistoryEntry): RawHistoryEntry {
  return {
    receta_id: entry.recipeId,
    fecha: entry.date,
    valoracion: entry.rating,
    sustituciones: [...entry.substitutions],
  };
}

export function toProfile(raw: RawProfile): Profile {
  return {
    id: raw.id,
    name: raw.nombre,
    age: raw.edad,
    skillLevel: raw.nivel_habilidad,
    explicit: {
      allergies: [...raw.explicito.alergias],
      allergySeverity: raw.explicito.severidad_alergia,
      dinerRestrictions: raw.explicito.restricciones_comensales.map((r) => ({
        diner: r.comensal,
        restriction: r.restriccion,
        reason: r.motivo,
      })),
      diet: raw.explicito.dieta,
    },
    accessibility: toAccessibility(raw.accesibilidad),
    learned: {
      likes: [...raw.aprendido.le_gusta],
      dislikes: [...raw.aprendido.no_le_gusta],
      acceptedSubstitutions: raw.aprendido.sustituciones_aceptadas.map((s) => ({
        original: s.original,
        substitute: s.sustituto,
      })),
      skipsFullReading: raw.aprendido.salta_lectura_completa,
      frequentQueries: raw.aprendido.consulta_frecuente,
      frequentExplanations: raw.aprendido.pide_explicacion_frecuente,
    },
    emotional: {
      assistantTone: raw.emocional.tono_asistente,
      celebration: raw.emocional.celebracion,
      ambientMusic: raw.emocional.musica_ambiente,
    },
    pantry: [...raw.despensa],
    history: raw.historial.map(toHistoryEntry),
    rooms: [...raw.salas],
  };
}

export function toRawProfile(profile: Profile): RawProfile {
  return {
    id: profile.id,
    nombre: profile.name,
    edad: profile.age,
    nivel_habilidad: profile.skillLevel,
    explicito: {
      alergias: [...profile.explicit.allergies],
      severidad_alergia: profile.explicit.allergySeverity,
      restricciones_comensales: profile.explicit.dinerRestrictions.map((r) => ({
        comensal: r.diner,
        restriccion: r.restriction,
        motivo: r.reason,
      })),
      dieta: profile.explicit.diet,
    },
    accesibilidad: toRawAccessibility(profile.accessibility),
    aprendido: {
      le_gusta: [...profile.learned.likes],
      no_le_gusta: [...profile.learned.dislikes],
      sustituciones_aceptadas: profile.learned.acceptedSubstitutions.map((s) => ({
        original: s.original,
        sustituto: s.substitute,
      })),
      salta_lectura_completa: profile.learned.skipsFullReading,
      consulta_frecuente: profile.learned.frequentQueries,
      pide_explicacion_frecuente: profile.learned.frequentExplanations,
    },
    emocional: {
      tono_asistente: profile.emotional.assistantTone,
      celebracion: profile.emotional.celebration,
      musica_ambiente: profile.emotional.ambientMusic,
    },
    despensa: [...profile.pantry],
    historial: profile.history.map(toRawHistoryEntry),
    salas: [...profile.rooms],
  };
}
