import { beforeEach, describe, expect, it } from 'vitest';
import { enterScreen, getCommandContext, updateCommandContext } from './commandContext';

describe('commandContext', () => {
  beforeEach(() => {
    updateCommandContext({ activeTimers: [], alertActive: false });
    enterScreen('home');
  });

  it('descarta el contexto de la pantalla anterior', () => {
    enterScreen('cooking', { recipeId: 'REC-001', stepNumber: 3 });
    enterScreen('home');
    expect(getCommandContext().stepNumber).toBeUndefined();
    expect(getCommandContext().screen).toBe('home');
  });

  it('conserva temporizadores y alertas al cambiar de pantalla (RF-16)', () => {
    updateCommandContext({ activeTimers: ['pollo'], alertActive: true });
    enterScreen('celebration');
    expect(getCommandContext().activeTimers).toEqual(['pollo']);
    expect(getCommandContext().alertActive).toBe(true);
  });
});
