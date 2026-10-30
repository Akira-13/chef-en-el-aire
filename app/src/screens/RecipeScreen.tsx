// Detalle de receta: ingredientes frente a la despensa, adaptación con IA y entrada al modo
// cocina (RF-03, RF-05, RF-06). Si la receta tiene un alérgeno del perfil o de un comensal, no
// se puede empezar sin una confirmación explícita (RF-07, CA-06.2).

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ALLERGEN_LABELS, findAllergens, type AllergenFinding } from '@chef/shared';
import { AdaptationPanel } from '../assistant/AdaptationPanel';
import { useCommands } from '../core/commandBus';
import { enterScreen } from '../core/commandContext';
import { useRecipe } from '../core/recipes';
import { output, useProfile } from '../core/services';
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

function describeFinding(finding: AllergenFinding): string {
  const who = finding.source === 'diner' ? `para ${finding.diner}` : 'para ti';
  return `${finding.ingredientName}: ${ALLERGEN_LABELS[finding.allergen]} (${who})`;
}

export function RecipeScreen() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const { status, recipe, isAdapted } = useRecipe(recipeId);
  const [riskAccepted, setRiskAccepted] = useState(false);

  const warnings = recipe ? findAllergens(recipe, profile.explicit).map(describeFinding) : [];
  const warningText = warnings.join('. ');
  const blocked = warnings.length > 0 && !riskAccepted;

  useEffect(() => enterScreen('recipe', { recipeId }), [recipeId]);

  useEffect(() => {
    if (warningText) {
      output.announce({ text: `Cuidado, esta receta contiene: ${warningText}.`, kind: 'alert' });
    }
  }, [warningText]);

  // Por voz solo vale decir "confirmo": un gesto genérico no alcanza (CA-06.2).
  useCommands(({ command, channel }) => {
    if (blocked && command.type === 'confirm' && channel === 'voice') setRiskAccepted(true);
  });

  if (!recipe) {
    return (
      <Screen title="Receta">
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
      title={recipe.name}
      header={
        <IconButton aria-label="Volver" onClick={() => navigate(-1)}>
          ←
        </IconButton>
      }
      footer={
        blocked ? (
          <Button variant="secondary" size="lg" block onClick={() => setRiskAccepted(true)}>
            Confirmo, cocinar igual
          </Button>
        ) : (
          <Button size="lg" block onClick={() => navigate(`/cocinar/${recipe.id}`)}>
            👩‍🍳 Empezar a cocinar
          </Button>
        )
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
        {isAdapted && <Chip tone="have">Receta adaptada</Chip>}
      </div>

      {warnings.length > 0 && (
        <section className={styles.allergenWarning} aria-labelledby="allergen-title">
          <h2 id="allergen-title" className={styles.allergenTitle}>
            ⚠️ Cuidado: contiene alérgenos de tu perfil
          </h2>
          <ul className={styles.allergenList}>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          {blocked && <p>Adáptala con IA o confirma que quieres cocinarla igual.</p>}
        </section>
      )}

      <AdaptationPanel recipe={recipe} />

      <h2 className={styles.sectionTitle}>Ingredientes</h2>
      <ul className={styles.ingredientList}>
        {recipe.ingredients.map((ingredient) => {
          const state = statusById[ingredient.id] ?? 'missing';
          return (
            <li key={ingredient.id} className={styles.ingredient}>
              <span>
                {ingredient.quantity > 0 && `${ingredient.quantity} ${ingredient.unit} · `}
                {ingredient.name}
              </span>
              <Chip tone={state} className={styles.ingredientChip}>
                {STATUS_LABELS[state]}
              </Chip>
            </li>
          );
        })}
      </ul>

      <SubstitutionHints recipe={recipe} />
    </Screen>
  );
}
