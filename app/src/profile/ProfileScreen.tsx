// Pantalla de perfil: elegir quién cocina, ajustar la accesibilidad, la despensa, revisar lo
// aprendido y el historial, elegir nivel, tono y alias, y exportar o borrar los datos (RF-25, RF-28,
// RF-30, RF-33, RF-41, RNF-11).

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ALLERGEN_LABELS } from '@chef/shared';
import { enterScreen } from '../core/commandContext';
import { output, profileService, useProfile } from '../core/services';
import { Card, IconButton, Screen } from '../ui';
import { AccessibilitySettings, INPUT_LABELS } from './AccessibilitySettings';
import { DietaryFields } from './DietarySetup';
import {
  AssistantSettings,
  CommunitySection,
  DataControls,
  LearnedSection,
  MyDishes,
  PantryEditor,
} from './ProfileSections';
import styles from './profile.module.css';

function PersonaPicker() {
  const profile = useProfile();
  // La lista se vuelve a leer en cada render: cambia al terminar de cargar y al borrar.
  const profiles = profileService.listProfiles();
  const own = profiles.filter((p) => !p.example);
  const examples = profiles.filter((p) => p.example);
  const activeExample = examples.find((p) => p.id === profile.id);

  function select(id: string, name: string) {
    void profileService.selectProfile(id);
    output.announce({ text: `Ahora cocina ${name}.`, kind: 'info' });
  }

  return (
    <section className={styles.section} aria-labelledby="perfil-elegir">
      <h2 id="perfil-elegir" className={styles.sectionTitle}>
        ¿Quién cocina?
      </h2>
      {own.length > 0 && (
        <>
          <h3 className={styles.subTitle}>Mis perfiles</h3>
          <div className={styles.personas}>
            {own.map((summary) => {
              const selected = summary.id === profile.id;
              return (
                <button
                  key={summary.id}
                  type="button"
                  className={styles.persona}
                  aria-pressed={selected}
                  onClick={() => select(summary.id, summary.name)}
                >
                  <span className={styles.personaName}>{summary.name}</span>
                  <span className={styles.muted}>
                    {summary.condition ?? 'Sin condición declarada'}
                  </span>
                  <span className={styles.muted}>
                    Prefiere: {INPUT_LABELS[summary.preferredInput]}
                  </span>
                  {selected && <span className={styles.personaCheck}>✓ Eres tú</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className={styles.field}>
        <label htmlFor="perfil-ejemplos-select">Perfiles de ejemplo</label>
        {own.length === 0 && (
          <p id="perfil-ejemplos-ayuda" className={styles.muted}>
            Son personas de demostración. Los cambios que hagas en ellas se guardan en ellas.
          </p>
        )}
        <select
          id="perfil-ejemplos-select"
          aria-describedby={own.length === 0 ? 'perfil-ejemplos-ayuda' : undefined}
          className={styles.exampleSelect}
          value={activeExample?.id ?? ''}
          onChange={(event) => {
            const chosen = examples.find((p) => p.id === event.target.value);
            if (chosen) select(chosen.id, chosen.name);
          }}
        >
          <option value="">Elegir un perfil de ejemplo…</option>
          {examples.map((summary) => (
            <option key={summary.id} value={summary.id}>
              {summary.name} — {summary.condition ?? 'sin condición declarada'}
            </option>
          ))}
        </select>
        {activeExample && (
          <p className={styles.personaCheck}>Perfil de ejemplo activo: {activeExample.name}</p>
        )}
      </div>
    </section>
  );
}

function Restrictions() {
  const { id, explicit } = useProfile();
  return (
    <Card>
      <h2 className={styles.sectionTitle}>Restricciones</h2>
      {/* Con `key` los controles se vuelven a montar al cambiar de perfil y no arrastran el estado. */}
      <DietaryFields key={id} noneOnStart={explicit.allergies.length === 0} />
      {explicit.dinerRestrictions.map((r) => (
        <p key={`${r.diner}-${r.restriction}`}>
          {r.diner}: sin {ALLERGEN_LABELS[r.restriction]} ({r.reason})
        </p>
      ))}
    </Card>
  );
}

export function ProfileScreen() {
  const navigate = useNavigate();
  const { hash } = useLocation();

  useEffect(() => enterScreen('profile'), []);

  // Los enlaces como /perfil#despensa llevan directo a su sección.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <Screen
      title="Mi perfil"
      header={
        <>
          <IconButton aria-label="Volver" onClick={() => navigate(-1)}>
            ←
          </IconButton>
          <h1>Mi perfil</h1>
          <span />
        </>
      }
    >
      <PersonaPicker />
      <PantryEditor />
      <AccessibilitySettings />
      <AssistantSettings />
      <Restrictions />
      <LearnedSection />
      <MyDishes />
      <CommunitySection />
      <DataControls />
    </Screen>
  );
}
