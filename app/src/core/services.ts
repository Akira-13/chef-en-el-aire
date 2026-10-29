// Punto único donde se conectan las implementaciones de los servicios del cliente.
// Las carpetas que implementan servicios (output/, profile/) no deben importar este archivo,
// para evitar dependencias circulares: lo usan las pantallas y los componentes.

import { useSyncExternalStore } from 'react';
import type { Profile } from '@chef/shared';
import { createOutputService } from '../output';
import { createProfileService } from '../profile';

export const profileService = createProfileService();
export const output = createOutputService({ getProfile: () => profileService.getProfile() });

profileService.onNotice((message) => output.announce({ text: message, kind: 'info' }));

/** Perfil actual; el componente se vuelve a renderizar cuando cambia. */
export function useProfile(): Profile {
  return useSyncExternalStore(profileService.subscribe, profileService.getProfile);
}
