// Permiso del micrófono: se pide al llegar a una pantalla con voz, sin esperar a que el usuario
// toque el botón, para que la bienvenida ya pueda practicar «chef, siguiente» (RNF-11).

import { requestMicrophone } from './recognizer';

type Access = PermissionState | 'unknown';

async function microphoneAccess(): Promise<Access> {
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    return status?.state ?? 'unknown';
  } catch {
    // Safari y otros no informan el estado del micrófono.
    return 'unknown';
  }
}

export interface MicrophoneResult {
  granted: boolean;
  /** Se mostró la pregunta del navegador al usuario. */
  asked: boolean;
}

/** Dice si la voz puede activarse; solo pregunta si `mayAsk` y el usuario no lo decidió antes. */
export async function resolveMicrophone(mayAsk: boolean): Promise<MicrophoneResult> {
  const access = await microphoneAccess();
  if (access === 'granted') return { granted: true, asked: false };
  if (access === 'denied' || !mayAsk) return { granted: false, asked: false };
  return { granted: await requestMicrophone(), asked: true };
}
