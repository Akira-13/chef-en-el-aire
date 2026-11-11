// Sustituciones que el sistema propone para esta receta según las alergias del perfil, las
// restricciones de los comensales y las sustituciones que el usuario ya aceptó (CA-23.1, CA-24.2).

import type { Recipe } from '@chef/shared';
import { setAdaptedRecipe } from '../core/recipes';
import { output, profileService, useProfile } from '../core/services';
import { Button, Card } from '../ui';
import {
  applySubstitution,
  proposeSubstitutions,
  type SubstitutionProposal,
} from './substitutions';
import styles from './SubstitutionHints.module.css';

function describe(proposal: SubstitutionProposal): string {
  const { original, substitute } = proposal;
  return substitute.quantity <= 0 || substitute.name.toLowerCase() === 'omitir'
    ? `Quitar ${original}`
    : `${original} → ${substitute.name}`;
}

export function SubstitutionHints({ recipe }: { recipe: Recipe }) {
  const profile = useProfile();
  const proposals = proposeSubstitutions(recipe, profile);
  if (proposals.length === 0) return null;

  function event(proposal: SubstitutionProposal) {
    return {
      recipeId: recipe.id,
      ingredientId: proposal.ingredientId,
      original: proposal.original,
      substitute: proposal.substitute.name,
    };
  }

  function accept(proposal: SubstitutionProposal) {
    void profileService.recordEvent({ type: 'substitutionAccepted', ...event(proposal) });
    setAdaptedRecipe(applySubstitution(recipe, proposal.ingredientId, proposal.substitute));
    output.announce({ text: `Listo: ${describe(proposal)}.`, kind: 'success' });
  }

  function reject(proposal: SubstitutionProposal) {
    void profileService.recordEvent({ type: 'substitutionRejected', ...event(proposal) });
    output.announce({ text: `De acuerdo, dejo ${proposal.original}.`, kind: 'info' });
  }

  return (
    <section className={styles.hints} aria-labelledby="sustituciones-titulo">
      <h2 id="sustituciones-titulo" className={styles.title}>
        🔄 Te sugiero cambiar
      </h2>
      <ul className={styles.list}>
        {proposals.map((proposal) => (
          <li key={proposal.ingredientId}>
            <Card className={styles.hint}>
              <p className={styles.change}>
                <strong>{describe(proposal)}</strong>
              </p>
              <p className={styles.reason}>Motivo: {proposal.reason}</p>
              <div className={styles.actions}>
                <Button onClick={() => accept(proposal)}>Usar</Button>
                <Button variant="secondary" onClick={() => reject(proposal)}>
                  No, gracias
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
