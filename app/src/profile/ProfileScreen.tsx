// Pantalla de perfil: elegir quién cocina, ajustar la accesibilidad, la despensa, revisar lo
// aprendido y el historial, y exportar o borrar los datos (RF-25, RF-28, RF-30, RNF-11).

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ALLERGEN_LABELS } from '@chef/shared';
import { enterScreen } from '../core/commandContext';
import { output, profileService, useProfile } from '../core/services';
import { Card, IconButton, Screen } from '../ui';
import { AccessibilitySettings, INPUT_LABELS } from './AccessibilitySettings';
import { DataControls, LearnedSection, MyDishes, PantryEditor } from './ProfileSections';
import styles from './profile.module.css';

function PersonaPicker() {
  const profile = useProfile();
  // La lista se vuelve a leer en cada render: cambia al terminar de cargar y al borrar.
  const profiles = profileService.listProfiles();

  function select(id: string, name: string) {
    void profileService.selectProfile(id);
    output.announce({ text: `Ahora cocina ${name}.`, kind: 'info' });
  }

  return (
    <section className={styles.section} aria-labelledby="perfil-elegir">
      <h2 id="perfil-elegir" className={styles.sectionTitle}>
        ¿Quién cocina?
      </h2>
      <div className={styles.personas}>
        {profiles.map((summary) => {
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
              <span className={styles.muted}>{summary.condition ?? 'Sin condición declarada'}</span>
              <span className={styles.muted}>Prefiere: {INPUT_LABELS[summary.preferredInput]}</span>
              {selected && <span className={styles.personaCheck}>✓ Eres tú</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Restrictions() {
  const { explicit } = useProfile();
  return (
    <Card>
      <h2 className={styles.sectionTitle}>Restricciones</h2>
      <p>
        Alergias:{' '}
        {explicit.allergies.map((a) => ALLERGEN_LABELS[a]).join(', ') || 'ninguna declarada'}
      </p>
      {explicit.dinerRestrictions.map((r) => (
        <p key={`${r.diner}-${r.restriction}`}>
          {r.diner}: sin {ALLERGEN_LABELS[r.restriction]} ({r.reason})
        </p>
      ))}
      <p>Dieta: {explicit.diet}</p>
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
      <Restrictions />
      <LearnedSection />
      <MyDishes />
      <DataControls />
    </Screen>
  );
}
