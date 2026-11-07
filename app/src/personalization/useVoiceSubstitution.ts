// Atiende «chef, sustituye el maní» (comando `substitute`). Propone el sustituto del recetario,
// espera «confirmo» o «cancelar» y recién entonces cambia la receta: con las manos ocupadas y sin
// mirar la pantalla, un cambio por error saldría caro.

import { useEffect, useRef } from 'react';
import type { Recipe } from '@chef/shared';
import { commandBus, useCommands } from '../core/commandBus';
import { setAdaptedRecipe } from '../core/recipes';
import { output, profileService, useProfile } from '../core/services';
import { normalizeText } from './text';
import { applySubstitution, type SubstitutionProposal } from './substitutions';
import { planVoiceSubstitution } from './voiceSubstitution';

export const CONFIRM_TIMEOUT_MS = 10000;

interface Pending {
  proposal: SubstitutionProposal;
  timer: number;
}

function isOmission({ substitute }: SubstitutionProposal): boolean {
  return substitute.quantity <= 0 || normalizeText(substitute.name) === 'omitir';
}

/**
 * @param askAssistant En modo cocina, si el recetario no tiene sustituto se lo pregunta al
 * asistente; en la receta se sugiere «Adaptar con IA».
 */
export function useVoiceSubstitution(recipe: Recipe | undefined, askAssistant = false): void {
  const profile = useProfile();
  const pending = useRef<Pending | null>(null);

  function clearPending(): SubstitutionProposal | null {
    const current = pending.current;
    if (!current) return null;
    window.clearTimeout(current.timer);
    pending.current = null;
    return current.proposal;
  }

  useEffect(() => () => void clearPending(), []);

  function eventOf(recipeId: string, proposal: SubstitutionProposal) {
    return {
      recipeId,
      ingredientId: proposal.ingredientId,
      original: proposal.original,
      substitute: proposal.substitute.name,
    };
  }

  function fail(text: string): void {
    output.cue('error');
    output.announce({ text, kind: 'info' });
  }

  function propose(spoken: string): void {
    if (!recipe) return;
    clearPending();
    const plan = planVoiceSubstitution(recipe, profile, spoken);
    switch (plan.kind) {
      case 'notFound':
        fail(`No encuentro «${plan.spoken}» en esta receta.`);
        return;
      case 'unknownSubstitute':
        fail(`No tengo «${plan.requested}» como sustituto de ${plan.ingredient} en el recetario.`);
        return;
      case 'noSubstitute':
        if (askAssistant) {
          commandBus.emit(
            { type: 'ask', question: `¿Con qué puedo sustituir ${plan.ingredient}?` },
            'voice',
          );
        } else {
          fail(
            `El recetario no tiene un sustituto para ${plan.ingredient}. Prueba con «Adaptar con IA».`,
          );
        }
        return;
      case 'propose': {
        const { proposal } = plan;
        const timer = window.setTimeout(() => {
          pending.current = null;
        }, CONFIRM_TIMEOUT_MS);
        pending.current = { proposal, timer };
        output.cue('navigate');
        output.announce({
          text: isOmission(proposal)
            ? `¿Quito ${proposal.original}? Di «confirmo» o «cancelar».`
            : `¿Cambio ${proposal.original} por ${proposal.substitute.name}? Di «confirmo» o «cancelar».`,
          kind: 'info',
        });
      }
    }
  }

  function accept(): void {
    const proposal = clearPending();
    if (!proposal || !recipe) return;
    void profileService.recordEvent({
      type: 'substitutionAccepted',
      ...eventOf(recipe.id, proposal),
    });
    setAdaptedRecipe(applySubstitution(recipe, proposal.ingredientId, proposal.substitute));
    output.cue('success');
    output.announce({
      text: isOmission(proposal)
        ? `Listo: quité ${proposal.original}.`
        : `Listo: ${proposal.original} por ${proposal.substitute.name}.`,
      kind: 'success',
    });
  }

  function reject(): void {
    const proposal = clearPending();
    if (!proposal || !recipe) return;
    void profileService.recordEvent({
      type: 'substitutionRejected',
      ...eventOf(recipe.id, proposal),
    });
    output.announce({ text: `De acuerdo, dejo ${proposal.original}.`, kind: 'info' });
  }

  useCommands(({ command }) => {
    if (command.type === 'substitute') propose(command.ingredient);
    else if (pending.current && command.type === 'confirm') accept();
    else if (pending.current && command.type === 'cancel') reject();
  });
}
