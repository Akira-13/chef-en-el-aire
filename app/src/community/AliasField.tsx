// Campo del alias público (RF-33), con contador y error accesibles. Lo usan el Perfil y la vista
// previa de lo que se publica. `AliasForm` además lo guarda en el perfil.

import { useId, useState, type FormEvent } from 'react';
import { output, profileService } from '../core/services';
import { Button } from '../ui';
import { ALIAS_MAX_LENGTH, validateAlias } from './alias';
import styles from './community.module.css';

export interface AliasFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function AliasField({ value, onChange, error }: AliasFieldProps) {
  const counterId = useId();
  const errorId = useId();
  return (
    <div className={styles.aliasForm}>
      <label className={styles.field}>
        <span>Tu alias</span>
        <input
          className={styles.textInput}
          value={value}
          maxLength={ALIAS_MAX_LENGTH}
          autoComplete="off"
          placeholder="Ej.: La sazón de casa"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${counterId} ${errorId}` : counterId}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <span id={counterId} className={styles.muted} aria-live="polite">
        {value.length} de {ALIAS_MAX_LENGTH} caracteres
      </span>
      {error && (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Valida y guarda el alias en el perfil; devuelve el alias guardado o el error. */
export function saveAlias(
  alias: string,
  profileName: string,
): { ok: true; alias: string } | { ok: false; error: string } {
  const result = validateAlias(alias, profileName);
  if (result.ok) {
    void profileService.update((p) => ({ ...p, community: { alias: result.alias } }));
  }
  return result;
}

export function AliasForm({ initial, name }: { initial: string; name: string }) {
  const [alias, setAlias] = useState(initial);
  const [error, setError] = useState<string>();

  function save(event: FormEvent) {
    event.preventDefault();
    const result = saveAlias(alias, name);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    setAlias(result.alias);
    output.announce({ text: `Guardé tu alias: ${result.alias}.`, kind: 'success' });
  }

  return (
    <form className={styles.aliasForm} onSubmit={save} noValidate>
      <AliasField
        value={alias}
        error={error}
        onChange={(value) => {
          setAlias(value);
          setError(undefined);
        }}
      />
      <Button type="submit" disabled={alias.trim() === initial}>
        Guardar alias
      </Button>
    </form>
  );
}
