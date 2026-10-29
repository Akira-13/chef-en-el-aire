// Aplica al documento el tamaño de fuente y el contraste del perfil (RF-25, RF-38).

import { useEffect } from 'react';
import { useProfile } from '../core/services';

export function useThemeFromProfile(): void {
  const { fontSize, highContrast } = useProfile().accessibility;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontSize = fontSize;
    root.dataset.contrast = highContrast ? 'high' : 'normal';
  }, [fontSize, highContrast]);
}
