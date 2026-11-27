// Nombre del perfil que se crea en la bienvenida (CA-22.3). Solo reglas, sin interfaz.

export const PROFILE_NAME_MAX_LENGTH = 40;

export type ProfileNameValidation = { ok: true; name: string } | { ok: false; error: string };

/** Quita espacios sobrantes y comprueba que el nombre no esté vacío ni sea demasiado largo. */
export function validateProfileName(name: string): ProfileNameValidation {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { ok: false, error: 'Escribe tu nombre.' };
  if (trimmed.length > PROFILE_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Tu nombre puede tener hasta ${PROFILE_NAME_MAX_LENGTH} caracteres.`,
    };
  }
  return { ok: true, name: trimmed };
}

/** Dos nombres son el mismo si solo cambian mayúsculas o espacios. */
export function sameProfileName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');
}
