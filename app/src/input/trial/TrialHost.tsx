// Abre el panel del facilitador que pida la URL: ?prueba=voz, ?prueba=gestos o ?prueba=metricas.
// Lo monta InputLayer, así no hace falta tocar las rutas.

import { useSearchParams } from 'react-router';
import { GestureTrialPanel } from './GestureTrialPanel';
import { MetricsPanel } from './MetricsPanel';
import { VoiceTrialPanel } from './VoiceTrialPanel';

function readSeed(value: string | null): number | undefined {
  if (value === null || !/^\d{1,10}$/.test(value)) return undefined;
  return Number(value);
}

export function TrialHost() {
  const [params] = useSearchParams();
  const trial = params.get('prueba');
  if (trial === 'voz') return <VoiceTrialPanel seed={readSeed(params.get('semilla'))} />;
  if (trial === 'gestos') return <GestureTrialPanel seed={readSeed(params.get('semilla'))} />;
  if (trial === 'metricas') return <MetricsPanel />;
  return null;
}
