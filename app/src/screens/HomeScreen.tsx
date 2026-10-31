// Pantalla de inicio: tres sugerencias personalizadas, búsqueda y despensa (RF-01, RF-02).

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Recipe } from '@chef/shared';
import { useCookingSession } from '../cooking/session';
import { enterScreen } from '../core/commandContext';
import { useRecipes } from '../core/recipes';
import { useProfile } from '../core/services';
import { searchRecipes, suggestRecipes } from '../personalization';
import { IconButton, Screen } from '../ui';
import { DIFFICULTY_LABELS, recipeArt } from '../ui/labels';
import styles from './screens.module.css';

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
  const [query, setQuery] = useState('');

  useEffect(() => enterScreen('home'), []);

  const searching = query.trim().length > 0;
  const suggestion = suggestRecipes(recipes, profile);
  const shown = searching ? searchRecipes(recipes, query) : suggestion.recipes;
  const inProgress = recipes.find((recipe) => recipe.id === inProgressId);

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
      {status === 'loading' && <p role="status">Cargando recetas…</p>}
      {status === 'error' && <p role="alert">No se pudieron cargar las recetas.</p>}
      {!searching && suggestion.message && <p>{suggestion.message}</p>}
      {status === 'ready' && shown.length === 0 && <p>No encontré recetas para “{query}”.</p>}
      <ul className={styles.list}>
        {shown.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </ul>
    </Screen>
  );
}
