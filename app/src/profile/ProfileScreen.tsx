// Pantalla de perfil: elegir el perfil de prueba y revisar sus preferencias (RF-25, RF-30).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ALLERGEN_LABELS } from '@chef/shared';
import { enterScreen } from '../core/commandContext';
import { profileService, useProfile } from '../core/services';
import { Button, Card, IconButton, Screen } from '../ui';

export function ProfileScreen() {
  const navigate = useNavigate();
  const profile = useProfile();
  const [profiles] = useState(() => profileService.listProfiles());
  const { accessibility, explicit, learned } = profile;

  useEffect(() => enterScreen('profile'), []);

  return (
    <Screen
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
      <section aria-labelledby="perfil-elegir">
        <h2 id="perfil-elegir">¿Quién cocina?</h2>
        {profiles.map((summary) => (
          <Button
            key={summary.id}
            variant={summary.id === profile.id ? 'primary' : 'secondary'}
            aria-pressed={summary.id === profile.id}
            block
            onClick={() => void profileService.selectProfile(summary.id)}
          >
            {summary.name}
            {summary.condition ? ` · ${summary.condition}` : ''}
          </Button>
        ))}
      </section>

      <Card>
        <h2>Accesibilidad</h2>
        <p>Canal preferido: {accessibility.preferredInput}</p>
        <p>Canales activos: {accessibility.activeInputs.join(', ')}</p>
        <p>Tamaño de letra: {accessibility.fontSize}</p>
        <p>Alto contraste: {accessibility.highContrast ? 'sí' : 'no'}</p>
        <p>
          Lectura en voz alta: {accessibility.ttsEnabled ? accessibility.verbosity : 'desactivada'}
        </p>
      </Card>

      <Card>
        <h2>Restricciones</h2>
        <p>
          Alergias:{' '}
          {explicit.allergies.map((a) => ALLERGEN_LABELS[a]).join(', ') || 'ninguna declarada'}
        </p>
        {explicit.dinerRestrictions.map((r) => (
          <p key={`${r.diner}-${r.restriction}`}>
            {r.diner}: sin {ALLERGEN_LABELS[r.restriction]} ({r.reason})
          </p>
        ))}
      </Card>

      <Card>
        <h2>Lo que aprendí de ti</h2>
        <p>Te gusta: {learned.likes.join(', ') || '—'}</p>
        <p>No te gusta: {learned.dislikes.join(', ') || '—'}</p>
        {learned.acceptedSubstitutions.map((s) => (
          <p key={s.original}>
            Sustituyes {s.original} por {s.substitute}
          </p>
        ))}
      </Card>
    </Screen>
  );
}
