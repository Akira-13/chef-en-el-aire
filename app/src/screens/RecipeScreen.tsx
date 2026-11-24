// Detalle de receta: ingredientes frente a la despensa, adaptación con IA y entrada al modo
// cocina (RF-03, RF-05, RF-06). Si la receta tiene un alérgeno del perfil o de un comensal, no
// se puede empezar sin una confirmación explícita (RF-07, CA-06.2).

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ALLERGEN_LABELS, findAllergens, type AllergenFinding } from '@chef/shared';
import { AdaptationPanel } from '../assistant/AdaptationPanel';
import { clearCookingSession, useCookingSession } from '../cooking/session';
import { MAX_SERVINGS, MIN_SERVINGS, clampServings, useServings } from '../cooking/servings';
import { useCommands } from '../core/commandBus';
import { enterScreen } from '../core/commandContext';
import { useRecipe } from '../core/recipes';
import { output, useProfile } from '../core/services';
import { pantryStatus, type IngredientStatus } from '../personalization';
import { SubstitutionHints } from '../personalization/SubstitutionHints';
import { useVoiceSubstitution } from '../personalization/useVoiceSubstitution';
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

/** Control de − y + para cambiar las porciones (RF-05); cada botón mide al menos 44 px. */
function ServingsStepper({
  servings,
  onChange,
}: {
  servings: number;
  onChange: (servings: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Porciones"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}
    >
      <IconButton
        aria-label="Quitar una porción"
        disabled={servings <= MIN_SERVINGS}
        onClick={() => onChange(servings - 1)}
      >
        −
      </IconButton>
      <span>
        {servings} {servings === 1 ? 'porción' : 'porciones'}
      </span>
      <IconButton
        aria-label="Añadir una porción"
        disabled={servings >= MAX_SERVINGS}
        onClick={() => onChange(servings + 1)}
      >
        +
      </IconButton>
    </div>
  );
}

export function RecipeScreen() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const { status, recipe, isAdapted } = useRecipe(recipeId);
  const scaling = useServings(recipeId, recipe, isAdapted);
  const session = useCookingSession();
  const [riskAccepted, setRiskAccepted] = useState(false);
  useVoiceSubstitution(recipe);

  // Cambia las porciones desde el control o por voz; el anuncio lo oyen también quienes no ven la pantalla.
  function changeServings(requested: number) {
    const target = clampServings(requested);
    if (scaling.servings === undefined || target === scaling.servings) return;
    const applied = scaling.setServings(target);
    if (applied === undefined) return;
    output.announce({
      text: `Ahora para ${applied} ${applied === 1 ? 'porción' : 'porciones'}`,
      kind: 'info',
    });
  }

  const resumeStep = session.recipeId === recipeId ? session.stepIndex : 0;
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
    if (command.type === 'setServings') changeServings(command.servings);
  });

  if (!recipe) {
    return (
      <Screen title="Receta">
        <h1 className="visually-hidden">Receta</h1>
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
          <>
            <Button size="lg" block onClick={() => navigate(`/cocinar/${recipe.id}`)}>
              <span aria-hidden="true">👩‍🍳</span>{' '}
              {resumeStep > 0 ? `Seguir en el paso ${resumeStep + 1}` : 'Empezar a cocinar'}
            </Button>
            {resumeStep > 0 && (
              <Button
                variant="ghost"
                block
                onClick={() => {
                  clearCookingSession();
                  navigate(`/cocinar/${recipe.id}`);
                }}
              >
                Empezar de nuevo
              </Button>
            )}
          </>
        )
      }
    >
      <div className={styles.hero}>
        <span className={styles.heroArt} aria-hidden="true">
          {recipeArt(recipe.id)}
        </span>
        <h1 className={styles.title}>{recipe.name}</h1>
        <p className={styles.muted}>
          {recipe.totalMinutes} min · {DIFFICULTY_LABELS[recipe.difficulty]}
        </p>
        <ServingsStepper servings={recipe.servings} onChange={changeServings} />
        {scaling.scaledOnly ? (
          <Chip tone="have">Para {recipe.servings} porciones</Chip>
        ) : (
          isAdapted && <Chip tone="have">Receta adaptada</Chip>
        )}
      </div>

      {warnings.length > 0 && (
        <section className={styles.allergenWarning} aria-labelledby="allergen-title">
          <h2 id="allergen-title" className={styles.allergenTitle}>
            <span aria-hidden="true">⚠️</span> Cuidado: contiene alérgenos de tu perfil
          </h2>
          <ul className={styles.allergenList}>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          {blocked && <p>Adáptala con IA o confirma que quieres cocinarla igual.</p>}
        </section>
      )}

      <AdaptationPanel recipe={recipe} servings={recipe.servings} />

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
