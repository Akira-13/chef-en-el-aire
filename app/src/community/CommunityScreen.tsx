// Pantalla de la Comunidad (RF-33, RF-36): publicaciones recientes de otras personas.
// Versión mínima mientras se construye el cliente; la ruta ya puede montarla.

import { useEffect, type ReactElement } from 'react';
import { enterScreen } from '../core/commandContext';
import { Screen } from '../ui';

export function CommunityScreen(): ReactElement {
  // Publica la pantalla para que la ayuda y los reconocedores ofrezcan sus comandos.
  useEffect(() => enterScreen('community'), []);
  return (
    <Screen title="Comunidad" header={<h1>Comunidad</h1>}>
      <p>Pronto verás aquí las recetas y los platos que comparten otras personas.</p>
    </Screen>
  );
}
