// Secciones de la pantalla de perfil: despensa (RF-03), lo que aprendí de ti (RF-30), mis
// platos (RF-31) y control de los datos (RNF-11).

import { useState, type FormEvent } from 'react';
import { metrics } from '../core/metrics';
import { useRecipes } from '../core/recipes';
import { output, profileService, useProfile } from '../core/services';
import { addToPantry } from '../personalization';
import { Button } from '../ui';
import { describeLearned, forgetLearned } from './learned';
import styles from './profile.module.css';

function useRecipeName(): (id: string) => string {
  const { recipes } = useRecipes();
  return (id) => recipes.find((r) => r.id === id)?.name ?? id;
}

export function PantryEditor() {
  const { pantry } = useProfile();
  const [text, setText] = useState('');

  function add(event: FormEvent) {
    event.preventDefault();
    // Se pueden agregar varios a la vez: "papa, pollo y ají amarillo".
    const items = text.split(/,|\by\b/).map((item) => item.trim());
    if (!items.some(Boolean)) return;
    void profileService.update((p) => ({ ...p, pantry: addToPantry(p.pantry, items) }));
    setText('');
  }

  function remove(item: string) {
    void profileService.update((p) => ({ ...p, pantry: p.pantry.filter((i) => i !== item) }));
    output.announce({ text: `Quité ${item} de tu despensa.`, kind: 'info' });
  }

  return (
    <section id="despensa" className={styles.section} aria-labelledby="perfil-despensa">
      <h2 id="perfil-despensa" className={styles.sectionTitle}>
        🧺 Mi despensa
      </h2>
      <form className={styles.pantryForm} onSubmit={add}>
        <label className={styles.pantryField}>
          <span className="visually-hidden">Ingrediente para agregar</span>
          <input
            className={styles.textInput}
            value={text}
            placeholder="Ej.: papa, pollo y ají amarillo"
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={!text.trim()}>
          Agregar
        </Button>
      </form>
      {pantry.length ? (
        <ul className={styles.chips} aria-label="Ingredientes en tu despensa">
          {pantry.map((item) => (
            <li key={item} className={styles.removableChip}>
              {item}
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`Quitar ${item}`}
                onClick={() => remove(item)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>Tu despensa está vacía. También puedes decir "tengo papa".</p>
      )}
    </section>
  );
}

export function LearnedSection() {
  const profile = useProfile();
  const recipeName = useRecipeName();
  const items = describeLearned(profile, recipeName);

  function forget(key: string, label: string) {
    void profileService.update((p) => forgetLearned(p, key));
    output.announce({ text: `Listo, olvidé: ${label}.`, kind: 'info' });
  }

  return (
    <section className={styles.section} aria-labelledby="perfil-aprendido">
      <h2 id="perfil-aprendido" className={styles.sectionTitle}>
        Lo que aprendí de ti
      </h2>
      {items.length ? (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.key} className={styles.listItem}>
              <span className={styles.listText}>
                <span>{item.label}</span>
                <span className={styles.muted}>Porque {item.origin}</span>
              </span>
              <Button
                variant="ghost"
                aria-label={`Borrar: ${item.label}`}
                onClick={() => forget(item.key, item.label)}
              >
                Borrar
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>Aún no aprendí nada de ti. Lo haré mientras cocinas.</p>
      )}
    </section>
  );
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
}

export function MyDishes() {
  const { history } = useProfile();
  const recipeName = useRecipeName();

  return (
    <section className={styles.section} aria-labelledby="perfil-platos">
      <h2 id="perfil-platos" className={styles.sectionTitle}>
        Mis platos
      </h2>
      {history.length ? (
        <ul className={styles.list}>
          {history
            .map((entry, index) => ({ entry, index }))
            .reverse()
            .map(({ entry, index }) => (
              <li key={`${entry.recipeId}-${index}`} className={styles.listItem}>
                <span className={styles.listText}>
                  <span>{recipeName(entry.recipeId)}</span>
                  <span className={styles.muted}>{formatDate(entry.date)}</span>
                </span>
                {entry.rating ? (
                  <span className={styles.stars} aria-label={`${entry.rating} de 5`}>
                    {'★'.repeat(entry.rating)}
                    {'☆'.repeat(5 - entry.rating)}
                  </span>
                ) : (
                  <span className={styles.muted}>Sin valorar</span>
                )}
              </li>
            ))}
        </ul>
      ) : (
        <p className={styles.muted}>Cuando termines una receta, aparecerá aquí.</p>
      )}
    </section>
  );
}

function download(fileName: string, json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// RNF-11, CA-25.3: exportar o borrar en 2 pasos como máximo.
export function DataControls() {
  const profile = useProfile();
  const [confirming, setConfirming] = useState(false);

  function exportProfile() {
    download(`perfil-${profile.id}.json`, JSON.stringify(profileService.exportRaw(), null, 2));
    output.announce({ text: 'Descargué tus datos.', kind: 'success' });
  }

  async function erase() {
    await profileService.reset();
    setConfirming(false);
    output.announce({ text: 'Borré tus datos. Volviste al perfil inicial.', kind: 'success' });
  }

  return (
    <section className={styles.section} aria-labelledby="perfil-datos">
      <h2 id="perfil-datos" className={styles.sectionTitle}>
        Mis datos
      </h2>
      <p className={styles.muted}>
        Tu perfil se guarda solo en este teléfono. La cámara nunca se graba ni se envía.
      </p>
      <div className={styles.actions}>
        <Button variant="secondary" block onClick={exportProfile}>
          ⬇️ Exportar mis datos
        </Button>
        {confirming ? (
          <div className={styles.warning} role="alertdialog" aria-labelledby="borrar-pregunta">
            <p id="borrar-pregunta">
              ¿Borrar tus preferencias, despensa, historial y lo que aprendí? No se puede deshacer.
            </p>
            <div className={styles.actions}>
              <Button block onClick={() => void erase()} autoFocus>
                Sí, borrar mis datos
              </Button>
              <Button variant="ghost" block onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" block onClick={() => setConfirming(true)}>
            🗑️ Borrar mis datos
          </Button>
        )}
        <Button
          variant="ghost"
          block
          onClick={() => download('metricas-chef-en-el-aire.json', metrics.exportJson())}
        >
          📊 Exportar métricas
        </Button>
      </div>
    </section>
  );
}
