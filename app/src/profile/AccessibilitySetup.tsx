// Configuración inicial guiada de accesibilidad en 3 pantallas (CA-22.2): cómo ves, cómo te
// hablo y cómo controlas la app. Parte de valores generosos (letra grande, volumen alto) y
// cada cambio se guarda al instante, así se puede salir en cualquier momento.

import { useEffect, useState } from 'react';
import { useProfile } from '../core/services';
import { Button } from '../ui';
import {
  Choice,
  FONT_LABELS,
  INPUT_LABELS,
  Range,
  Toggle,
  updateAccessibility,
  VERBOSITY_LABELS,
} from './AccessibilitySettings';
import { generousDefaults, INPUT_CHANNELS, toggleInput } from './accessibility';
import styles from './profile.module.css';

const STEPS = [
  '¿Cómo ves mejor?',
  '¿Cómo quieres que te hable?',
  '¿Cómo quieres controlar la app?',
];

export interface AccessibilitySetupProps {
  /** Se llama al terminar la última pantalla o al saltar la configuración. */
  onDone(): void;
}

export function AccessibilitySetup({ onDone }: AccessibilitySetupProps) {
  const a = useProfile().accessibility;
  const [step, setStep] = useState(0);

  // Solo al empezar: se agranda lo que esté por debajo de los valores generosos.
  useEffect(() => {
    void updateAccessibility(generousDefaults(a));
  }, []);

  const last = step === STEPS.length - 1;

  return (
    <section className={styles.section} aria-labelledby="configuracion-titulo">
      <p className={styles.muted}>
        Paso {step + 1} de {STEPS.length}
      </p>
      <h2 id="configuracion-titulo" className={styles.sectionTitle}>
        {STEPS[step]}
      </h2>

      {step === 0 && (
        <>
          <Choice
            legend="Tamaño de letra"
            name="setup-letra"
            value={a.fontSize}
            options={FONT_LABELS}
            onChange={(fontSize) => void updateAccessibility({ fontSize })}
          />
          <div className={styles.options}>
            <Toggle
              checked={a.highContrast}
              onChange={(highContrast) => void updateAccessibility({ highContrast })}
            >
              🌓 Alto contraste
            </Toggle>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className={styles.options}>
            <Toggle
              checked={a.ttsEnabled}
              onChange={(ttsEnabled) => void updateAccessibility({ ttsEnabled })}
            >
              🔊 Leer en voz alta
            </Toggle>
            <Toggle
              checked={a.subtitles ?? true}
              onChange={(subtitles) => void updateAccessibility({ subtitles })}
            >
              💬 Subtítulos
            </Toggle>
          </div>
          <Range
            label="Volumen"
            value={Math.round((a.volume ?? 1) * 100)}
            min={0}
            max={100}
            step={10}
            format={(v) => `${v} %`}
            onChange={(v) => void updateAccessibility({ volume: v / 100 })}
          />
          <Choice
            legend="Cuánto leo"
            name="setup-verbosidad"
            value={a.verbosity}
            options={VERBOSITY_LABELS}
            onChange={(verbosity) => void updateAccessibility({ verbosity })}
          />
        </>
      )}

      {step === 2 && (
        <>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Canales que vas a usar</legend>
            <div className={styles.options}>
              {INPUT_CHANNELS.map((channel) => {
                const checked = a.activeInputs.includes(channel);
                return (
                  <Toggle
                    key={channel}
                    checked={checked}
                    disabled={checked && a.activeInputs.length === 1}
                    onChange={() => void updateAccessibility(toggleInput(a, channel))}
                  >
                    {INPUT_LABELS[channel]}
                  </Toggle>
                );
              })}
            </div>
          </fieldset>
          <Choice
            legend="El que más vas a usar"
            name="setup-preferido"
            value={a.preferredInput}
            options={INPUT_LABELS}
            disabled={(channel) => !a.activeInputs.includes(channel)}
            onChange={(preferredInput) => void updateAccessibility({ preferredInput })}
          />
        </>
      )}

      <div className={styles.actions}>
        <Button size="lg" block onClick={() => (last ? onDone() : setStep(step + 1))}>
          {last ? 'Listo' : 'Siguiente'}
        </Button>
        {step > 0 && (
          <Button variant="secondary" block onClick={() => setStep(step - 1)}>
            Atrás
          </Button>
        )}
        <Button variant="ghost" block onClick={onDone}>
          Lo configuro después
        </Button>
      </div>
    </section>
  );
}
