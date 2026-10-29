// Detalle de receta: ingredientes frente a la despensa, adaptación con IA y entrada al modo
// cocina (RF-03, RF-05, RF-06).

import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AdaptationPanel } from '../assistant/AdaptationPanel';
import { enterScreen } from '../core/commandContext';
import { useRecipe } from '../core/recipes';
import { useProfile } from '../core/services';
import { pantryStatus, type IngredientStatus } from '../personalization';
import { SubstitutionHints } from '../personalization/SubstitutionHints';
import { Button, Chip, IconButton, Screen } from '../ui';
import { DIFFICULTY_LABELS, recipeArt } from '../ui/labels';
import styles from './screens.module.css';

const STATUS_LABELS: Record<IngredientStatus, string> = {
  have: 'tengo',
  missing: 'falta',
  substitute: 'sustituir',
};

export function RecipeScreen() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const { status, recipe } = useRecipe(recipeId);

  useEffect(() => enterScreen('recipe', { recipeId }), [recipeId]);

  if (!recipe) {
    return (
      <Screen>
        <p role={status === 'loading' ? 'status' : 'alert'}>
          {status === 'loading' ? 'Cargando receta…' : 'No encontré esta receta.'}
        </p>
        <Link to="/">Volver al inicio</Link>
      </Screen>
    );
  }

  const statusById = pantryStatus(recipe, profile);

  return (
    <Screen
      header={
        <IconButton aria-label="Volver" onClick={() => navigate(-1)}>
          ←
        </IconButton>
      }
      footer={
        <Button size="lg" block onClick={() => navigate(`/cocinar/${recipe.id}`)}>
          👩‍🍳 Empezar a cocinar
        </Button>
      }
    >
      <div className={styles.hero}>
        <span className={styles.heroArt} aria-hidden="true">
          {recipeArt(recipe.id)}
        </span>
        <h1 className={styles.title}>{recipe.name}</h1>
        <p className={styles.muted}>
          {recipe.totalMinutes} min · {DIFFICULTY_LABELS[recipe.difficulty]} · {recipe.servings}{' '}
          porciones
        </p>
      </div>

      <h2 className={styles.sectionTitle}>Ingredientes</h2>
      <ul className={styles.list}>
        {recipe.ingredients.map((ingredient) => {
          const state = statusById[ingredient.id] ?? 'missing';
          return (
            <li key={ingredient.id} className={styles.ingredient}>
              <span>
                {ingredient.quantity > 0 && `${ingredient.quantity} ${ingredient.unit} · `}
                {ingredient.name}
              </span>
              <Chip tone={state}>{STATUS_LABELS[state]}</Chip>
            </li>
          );
        })}
      </ul>

      <SubstitutionHints recipe={recipe} />
      <AdaptationPanel recipe={recipe} />
    </Screen>
  );
}
