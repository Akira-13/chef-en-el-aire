// Ajustes de accesibilidad del perfil (RF-25, HU-22, CA-22.1). Cada cambio se guarda al
// instante; tema, voz, gestos y salida lo leen del perfil. Siempre queda al menos un canal de
// entrada, y se avisa si queda uno solo (RF-24, CA-18.3).

import type { ReactNode } from 'react';
import type {
  AccessibilityPrefs,
  FontSize,
  GestureSensitivity,
  InputChannel,
  Verbosity,
} from '@chef/shared';
import { profileService, useProfile } from '../core/services';
import { INPUT_CHANNELS, toggleInput } from './accessibility';
import styles from './profile.module.css';

export const INPUT_LABELS: Record<InputChannel, string> = {
  voz: '🎙️ Voz',
  gestos: '✋ Gestos',
  tactil: '👆 Táctil',
};

const FONT_LABELS: Record<FontSize, string> = {
  normal: 'Normal',
  grande: 'Grande',
  extragrande: 'Muy grande',
};

const VERBOSITY_LABELS: Record<Verbosity, string> = {
  breve: 'Breve',
  detallada: 'Detallada',
};

const SENSITIVITY_LABELS: Record<GestureSensitivity, string> = {
  normal: 'Normal',
  alta_tolerancia: 'Más tolerante',
};

// Valores por defecto cuando el perfil de prueba no los trae.
export const DEFAULT_VOLUME = 0.8;
export const DEFAULT_VOICE_TIMEOUT_MS = 2000;

export function updateAccessibility(patch: Partial<AccessibilityPrefs>): Promise<void> {
  return profileService.update((p) => ({ ...p, accessibility: { ...p.accessibility, ...patch } }));
}

function Choice<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  legend: string;
  name: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
  disabled?: (value: T) => boolean;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {(Object.keys(options) as T[]).map((option) => (
          <label key={option} className={styles.option}>
            <input
              type="radio"
              name={name}
              checked={value === option}
              disabled={disabled?.(option)}
              onChange={() => onChange(option)}
            />
            {options[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={styles.option}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {children}
    </label>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.range}>
      <span>
        <strong>{label}:</strong> {format(value)}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

const seconds = (ms: number) => `${(ms / 1000).toLocaleString('es-PE')} s`;

export function AccessibilitySettings() {
  const a = useProfile().accessibility;
  const set = (patch: Partial<AccessibilityPrefs>) => void updateAccessibility(patch);
  const onlyOne = a.activeInputs.length === 1;

  return (
    <section className={styles.section} aria-labelledby="perfil-accesibilidad">
      <h2 id="perfil-accesibilidad" className={styles.sectionTitle}>
        Accesibilidad
      </h2>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Canales que uso para controlar la app</legend>
        <div className={styles.options}>
          {INPUT_CHANNELS.map((channel) => {
            const checked = a.activeInputs.includes(channel);
            return (
              <Toggle
                key={channel}
                checked={checked}
                disabled={checked && onlyOne}
                onChange={() => set(toggleInput(a, channel))}
              >
                {INPUT_LABELS[channel]}
              </Toggle>
            );
          })}
        </div>
        {onlyOne && (
          <p className={styles.warning} role="status">
            Solo queda un canal activo ({INPUT_LABELS[a.preferredInput]}): si falla, no tendrás otro
            para seguir. Activa otro canal cuando puedas.
          </p>
        )}
      </fieldset>

      <Choice
        legend="Canal preferido"
        name="canal-preferido"
        value={a.preferredInput}
        options={INPUT_LABELS}
        disabled={(channel) => !a.activeInputs.includes(channel)}
        onChange={(preferredInput) => set({ preferredInput })}
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Lectura y subtítulos</legend>
        <div className={styles.options}>
          <Toggle checked={a.ttsEnabled} onChange={(ttsEnabled) => set({ ttsEnabled })}>
            🔊 Leer en voz alta
          </Toggle>
          <Toggle checked={a.subtitles ?? true} onChange={(subtitles) => set({ subtitles })}>
            💬 Subtítulos
          </Toggle>
        </div>
      </fieldset>

      <Choice
        legend="Cuánto leo"
        name="verbosidad"
        value={a.verbosity}
        options={VERBOSITY_LABELS}
        onChange={(verbosity) => set({ verbosity })}
      />

      <Range
        label="Volumen de la voz"
        value={Math.round((a.volume ?? DEFAULT_VOLUME) * 100)}
        min={0}
        max={100}
        step={10}
        format={(v) => `${v} %`}
        onChange={(v) => set({ volume: v / 100 })}
      />

      <Range
        label="Tiempo que espero cuando hablas"
        value={a.voiceTimeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS}
        min={1000}
        max={6000}
        step={500}
        format={seconds}
        onChange={(voiceTimeoutMs) => set({ voiceTimeoutMs })}
      />

      <Choice
        legend="Tamaño de letra"
        name="tamano-letra"
        value={a.fontSize}
        options={FONT_LABELS}
        onChange={(fontSize) => set({ fontSize })}
      />

      <div className={styles.options}>
        <Toggle checked={a.highContrast} onChange={(highContrast) => set({ highContrast })}>
          🌓 Alto contraste
        </Toggle>
      </div>

      <Choice
        legend="Sensibilidad de los gestos"
        name="sensibilidad-gestos"
        value={a.gestureSensitivity}
        options={SENSITIVITY_LABELS}
        onChange={(gestureSensitivity) => set({ gestureSensitivity })}
      />

      <Range
        label="Tiempo para sostener un gesto"
        value={a.gestureHoldMs}
        min={200}
        max={2000}
        step={100}
        format={seconds}
        onChange={(gestureHoldMs) => set({ gestureHoldMs })}
      />

      <div className={styles.options}>
        <Toggle
          checked={a.requiresActivationGesture ?? false}
          onChange={(requiresActivationGesture) => set({ requiresActivationGesture })}
        >
          🖐️ Pedir un gesto de activación antes de cada gesto
        </Toggle>
      </div>
    </section>
  );
}
