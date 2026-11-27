import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { output, profileService } from '../core/services';
import { DietarySetup } from './DietarySetup';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const field = (text: string) =>
  [...container.querySelectorAll('label')]
    .find((l) => l.textContent?.includes(text))
    ?.querySelector('input') as HTMLInputElement;
const button = (text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent === text);

async function click(element: Element | undefined | null) {
  await act(async () => {
    (element as HTMLElement | undefined)?.click();
  });
}

describe('DietarySetup', () => {
  const onDone = vi.fn();

  beforeEach(async () => {
    localStorage.clear();
    await profileService.reset();
    // Rosa parte sin alergias y con dieta omnívora.
    await profileService.selectProfile('USR-001');
    onDone.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<DietarySetup onDone={onDone} />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('agrupa las alergias en un fieldset con checkboxes y la dieta en radios', () => {
    const groups = [...container.querySelectorAll('fieldset')];
    expect(groups).toHaveLength(2);
    expect(groups[0]?.querySelector('legend')?.textContent).toContain('alergias');
    expect(groups[0]?.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(8);
    expect(groups[1]?.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(container.querySelector('[aria-pressed]')).toBeNull();
  });

  it('marca y desmarca alergias y se guardan al instante', async () => {
    await click(field('maní'));
    await click(field('gluten'));
    expect(profileService.getProfile().explicit.allergies).toEqual(['gluten', 'mani']);
    expect(field('maní').checked).toBe(true);

    await click(field('maní'));
    expect(profileService.getProfile().explicit.allergies).toEqual(['gluten']);
    expect(field('maní').checked).toBe(false);
  });

  it('cambia la dieta y se guarda', async () => {
    expect(field('Como de todo').checked).toBe(true);
    await click(field('Vegetariana'));
    expect(profileService.getProfile().explicit.diet).toBe('vegetariana');
    expect(field('Vegetariana').checked).toBe(true);
    expect(field('Como de todo').checked).toBe(false);
  });

  it('«No tengo alergias» limpia las marcadas y se desmarca al elegir una', async () => {
    await click(field('leche'));
    await click(field('soya'));
    await click(field('No tengo alergias'));
    expect(profileService.getProfile().explicit.allergies).toEqual([]);
    expect(field('No tengo alergias').checked).toBe(true);
    expect(field('leche').checked).toBe(false);

    await click(field('leche'));
    expect(field('No tengo alergias').checked).toBe(false);
    expect(profileService.getProfile().explicit.allergies).toEqual(['leche']);
  });

  it('se puede continuar sin marcar nada y con alergias marcadas', async () => {
    await click(button('Continuar'));
    expect(onDone).toHaveBeenCalledTimes(1);
    await click(field('huevo'));
    await click(button('Continuar'));
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it('el botón no se deshabilita nunca', () => {
    expect(button('Continuar')?.disabled).toBe(false);
  });

  it('avisa cada cambio por el canal de salida', async () => {
    const announce = vi.spyOn(output, 'announce');
    await click(field('mariscos'));
    expect(announce).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: expect.stringContaining('mariscos') }),
    );
    await click(field('Vegetariana'));
    expect(announce).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: expect.stringContaining('vegetariana') }),
    );
    announce.mockRestore();
  });
});
