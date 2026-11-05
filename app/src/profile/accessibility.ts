// Reglas de los ajustes de accesibilidad que no dependen de la interfaz (RF-24, CA-18.3).

import type { AccessibilityPrefs, InputChannel } from '@chef/shared';

export const INPUT_CHANNELS: InputChannel[] = ['voz', 'gestos', 'tactil'];

type InputPrefs = Pick<AccessibilityPrefs, 'activeInputs' | 'preferredInput'>;

/**
 * Activa o desactiva un canal de entrada. Nunca deja cero canales y mantiene el preferido
 * entre los activos: se puede quitar el táctil si quedan voz y gestos.
 */
export function toggleInput(prefs: InputPrefs, channel: InputChannel): InputPrefs {
  const active = prefs.activeInputs.includes(channel)
    ? prefs.activeInputs.filter((c) => c !== channel)
    : INPUT_CHANNELS.filter((c) => c === channel || prefs.activeInputs.includes(c));
  if (active.length === 0) return prefs;
  const preferredInput = active.includes(prefs.preferredInput) ? prefs.preferredInput : active[0]!;
  return { activeInputs: active, preferredInput };
}

export const GENEROUS_VOLUME = 1;

/**
 * Valores por defecto generosos para la primera configuración (CA-22.2): letra al menos
 * grande y volumen alto. No reduce nada que el usuario ya haya agrandado.
 */
export function generousDefaults(
  prefs: AccessibilityPrefs,
): Pick<AccessibilityPrefs, 'fontSize' | 'volume'> {
  return {
    fontSize: prefs.fontSize === 'normal' ? 'grande' : prefs.fontSize,
    volume: Math.max(prefs.volume ?? 0, GENEROUS_VOLUME),
  };
}
