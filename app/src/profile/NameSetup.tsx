// Primer paso de la bienvenida: el nombre de quien usa la app (CA-22.3). Crea un perfil nuevo
// para que la configuración de accesibilidad, las alergias y lo aprendido se guarden ahí y no
// en un perfil de prueba. El botón nunca se deshabilita: si falta el nombre se explica por qué.

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { output, profileService } from '../core/services';
import { Button } from '../ui';
import { PROFILE_NAME_MAX_LENGTH, validateProfileName } from './name';
import styles from './profile.module.css';

export interface NameSetupProps {
  /** Se llama cuando el perfil nuevo ya se creó y quedó seleccionado. */
  onDone(): void;
}

export function NameSetup({ onDone }: NameSetupProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const hintId = useId();

  useEffect(() => {
    output.announce({ text: 'Bienvenida. ¿Cómo te llamas? Escribe tu nombre.', kind: 'info' });
  }, []);

  // Si la bienvenida se reinicia con un perfil propio ya creado, se rellena su nombre: al
  // continuar se reutiliza ese perfil en vez de crear otro.
  useEffect(() => {
    let active = true;
    void profileService.ready.then(() => {
      const profile = profileService.getProfile();
      const own = profileService.listProfiles().find((p) => p.id === profile.id && !p.example);
      if (active && own) setName((typed) => typed || own.name);
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const checked = validateProfileName(name);
    if (!checked.ok) {
      setError(checked.error);
      input.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await profileService.createProfile(checked.name);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pude crear tu perfil. Intenta de nuevo.');
      input.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.section} aria-labelledby="nombre-titulo" onSubmit={submit} noValidate>
      <h2 id="nombre-titulo" className={styles.sectionTitle}>
        ¿Cómo te llamas?
      </h2>
      <p id={hintId} className={styles.muted}>
        Con tu nombre creo tu perfil: ahí se guardan tus ajustes, alergias y gustos.
      </p>
      <label className={styles.field}>
        <span>Tu nombre</span>
        <input
          ref={input}
          className={styles.nameInput}
          value={name}
          maxLength={PROFILE_NAME_MAX_LENGTH}
          autoComplete="given-name"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
        />
      </label>
      {error && (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" size="lg" block>
          Continuar
        </Button>
      </div>
    </form>
  );
}
