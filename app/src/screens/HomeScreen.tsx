// Pantalla de inicio: tres sugerencias personalizadas, búsqueda y despensa (RF-01, RF-02).

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Recipe } from '@chef/shared';
import { useCookingSession } from '../cooking/session';
import { useCommands } from '../core/commandBus';
import { enterScreen } from '../core/commandContext';
import { useRecipes } from '../core/recipes';
import { output, useProfile } from '../core/services';
import { searchRecipes, suggestRecipes } from '../personalization';
import { useInstallPrompt } from '../pwa/install';
import { Button, IconButton, Screen } from '../ui';
import { DIFFICULTY_LABELS, recipeArt } from '../ui/labels';
import styles from './screens.module.css';

// Opciones de "¿cuánto tiempo tienes?", en minutos.
const TIME_OPTIONS = [20, 40, 60];
const SUGGESTION_COUNT = 3;

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <li>
      <Link to={`/receta/${recipe.id}`} className={styles.recipeCard}>
        <span className={styles.recipeArt} aria-hidden="true">
          {recipeArt(recipe.id)}
        </span>
        <span>
          <span className={styles.recipeName}>{recipe.name}</span>
          <span className={styles.muted}>
            {recipe.totalMinutes} min · {DIFFICULTY_LABELS[recipe.difficulty]}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const profile = useProfile();
  const { status, recipes } = useRecipes();
  const inProgressId = useCookingSession((session) => session.recipeId);
  const install = useInstallPrompt();
  const [query, setQuery] = useState('');
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);

  useEffect(() => enterScreen('home'), []);

  const searching = query.trim().length > 0;
  const inTime = maxMinutes
    ? recipes.filter((recipe) => recipe.totalMinutes <= maxMinutes)
    : recipes;
  const suggestion = suggestRecipes(inTime, profile);
  const results = searchRecipes(recipes, query);
  const noResults = searching && status === 'ready' && results.length === 0;
  // CA-01.3: se ofrece relajar el tiempo, nunca los alérgenos, que ya vienen filtrados.
  const tooFewInTime =
    !searching &&
    status === 'ready' &&
    maxMinutes !== null &&
    suggestion.recipes.length < SUGGESTION_COUNT;
  const inProgress = recipes.find((recipe) => recipe.id === inProgressId);

  // RF-02: la búsqueda también funciona por voz.
  useCommands(({ command }) => {
    if (command.type === 'search') setQuery(command.query);
  });

  // CA-02.3: si no hay resultados, también se dice en voz.
  useEffect(() => {
    if (noResults) output.announce({ text: 'No encontré esa receta.', kind: 'info' });
  }, [noResults]);

  return (
    <Screen
      title="Inicio"
      header={
        <>
          <span className={styles.brand}>Chef en el Aire</span>
          <IconButton aria-label="Mi perfil" variant="primary" onClick={() => navigate('/perfil')}>
            👤
          </IconButton>
        </>
      }
    >
      <h1 className={styles.greeting}>Hola, {profile.name}</h1>

      <label>
        <span className="visually-hidden">Buscar receta o ingrediente</span>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="🔍 Buscar receta o ingrediente"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <Link to="/perfil#despensa" className={styles.pantryLink}>
        🧺 Mi despensa: {profile.pantry.join(', ') || 'vacía'}
      </Link>

      {inProgress && !searching && (
        <>
          <h2 className={styles.sectionTitle}>Sigue cocinando</h2>
          <ul className={styles.list}>
            <li>
              <Link to={`/cocinar/${inProgress.id}`} className={styles.recipeCard}>
                <span className={styles.recipeArt} aria-hidden="true">
                  {recipeArt(inProgress.id)}
                </span>
                <span>
                  <span className={styles.recipeName}>{inProgress.name}</span>
                  <span className={styles.muted}>Retomar donde te quedaste</span>
                </span>
              </Link>
            </li>
          </ul>
        </>
      )}

      <h2 className={styles.sectionTitle}>{searching ? 'Resultados' : 'Para ti hoy'}</h2>
      {!searching && (
        <div className={styles.timeChips} role="group" aria-label="¿Cuánto tiempo tienes?">
          {TIME_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={styles.timeChip}
              aria-pressed={maxMinutes === minutes}
              onClick={() => setMaxMinutes(maxMinutes === minutes ? null : minutes)}
            >
              {minutes} min
            </button>
          ))}
        </div>
      )}
      {status === 'loading' && <p role="status">Cargando recetas…</p>}
      {status === 'error' && <p role="alert">No se pudieron cargar las recetas.</p>}
      {!searching && suggestion.message && <p>{suggestion.message}</p>}
      {tooFewInTime && (
        <>
          <p role="status">Con {maxMinutes} minutos no hay muchas opciones para ti.</p>
          <Button variant="secondary" block onClick={() => setMaxMinutes(null)}>
            Ver sin límite de tiempo
          </Button>
        </>
      )}
      {noResults && <p role="status">No encontré recetas para “{query}”. Quizá te sirva:</p>}
      <ul className={styles.list}>
        {(searching && !noResults ? results : suggestion.recipes).map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </ul>

      {install && (
        <Button variant="secondary" block onClick={install}>
          📲 Instalar la app
        </Button>
      )}
    </Screen>
  );
}
