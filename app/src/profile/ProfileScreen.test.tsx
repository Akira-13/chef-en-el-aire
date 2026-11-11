import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import { toRecipes, type RawRecipeBook } from '@chef/shared';
import { profileService } from '../core/services';
import { SubstitutionHints } from '../personalization/SubstitutionHints';
import { AccessibilitySetup } from './AccessibilitySetup';
import { ProfileScreen } from './ProfileScreen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
let container: HTMLElement;
let root: Root;

const buttons = () => [...container.querySelectorAll('button')];
const button = (text: string) => buttons().find((b) => b.textContent?.includes(text));
const checkbox = (text: string) =>
  [...container.querySelectorAll('label')]
    .find((l) => l.textContent?.includes(text))
    ?.querySelector('input') as HTMLInputElement;

async function click(element: Element | undefined) {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function render(node: React.ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter>{node}</MemoryRouter>);
  });
}

beforeEach(async () => {
  await profileService.ready;
  await profileService.reset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ProfileScreen', () => {
  it('elige la persona con tarjetas que muestran condición y canal', async () => {
    await render(<ProfileScreen />);
    const rosa = button('Rosa')!;
    expect(rosa.textContent).toContain('artritis');
    expect(rosa.textContent).toContain('Voz');
    await click(rosa);
    expect(profileService.getProfile().name).toBe('Rosa');
    expect(button('Rosa')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('el alto contraste se guarda al instante (CA-22.1)', async () => {
    await render(<ProfileScreen />);
    const before = profileService.getProfile().accessibility.highContrast;
    await click(checkbox('Alto contraste'));
    expect(profileService.getProfile().accessibility.highContrast).toBe(!before);
  });

  it('no deja desactivar el último canal y avisa (CA-18.3)', async () => {
    await profileService.selectProfile('USR-004'); // Javier: gestos y táctil
    await render(<ProfileScreen />);
    await click(checkbox('Táctil'));
    expect(profileService.getProfile().accessibility.activeInputs).toEqual(['gestos']);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Solo queda');
    expect(checkbox('Gestos').disabled).toBe(true);
  });

  it('agrega y quita ingredientes de la despensa', async () => {
    await render(<ProfileScreen />);
    const input = container.querySelector<HTMLInputElement>('#despensa input')!;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setValue.call(input, 'quinua, palta');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      input.form!.requestSubmit();
    });
    expect(profileService.getProfile().pantry).toEqual(expect.arrayContaining(['quinua', 'palta']));
    await click(container.querySelector('[aria-label="Quitar palta"]')!);
    expect(profileService.getProfile().pantry).not.toContain('palta');
  });

  it('borra los datos en 2 pasos (CA-25.3)', async () => {
    await profileService.selectProfile('USR-003');
    await render(<ProfileScreen />);
    await click(button('Borrar mis datos'));
    await click(button('Sí, borrar mis datos'));
    expect(profileService.getProfile().id).toBe('USR-002');
  });

  it('exporta los datos en 1 paso (CA-25.3)', async () => {
    const createObjectURL = vi.fn(() => 'blob:perfil');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await render(<ProfileScreen />);
    await click(button('Exportar mis datos'));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });
});

describe('SubstitutionHints', () => {
  it('a Rosa le propone sin pedirlo la leche del ají de gallina (CA-23.1)', async () => {
    await profileService.selectProfile('USR-001');
    const recipe = recipes.find((r) => r.id === 'REC-001')!;
    await render(<SubstitutionHints recipe={recipe} />);
    expect(container.textContent).toContain('leche evaporada → caldo de pollo + 2 cda de maicena');
    expect(container.textContent).toContain('esposo: intolerancia a la lactosa');
  });

  it('"No, gracias" deja de proponerla (CA-24.2)', async () => {
    await profileService.selectProfile('USR-001');
    const recipe = recipes.find((r) => r.id === 'REC-001')!;
    await render(<SubstitutionHints recipe={recipe} />);
    const card = [...container.querySelectorAll('li')].find((li) =>
      li.textContent?.includes('leche evaporada'),
    )!;
    await click([...card.querySelectorAll('button')].find((b) => b.textContent === 'No, gracias'));
    expect(container.textContent).not.toContain('leche evaporada');
    expect(profileService.getProfile().learned.rejectedSubstitutions).toHaveLength(1);
  });
});

describe('AccessibilitySetup', () => {
  it('se completa en 3 pantallas con letra grande y volumen alto (CA-22.2)', async () => {
    const onDone = vi.fn();
    await render(<AccessibilitySetup onDone={onDone} />);
    const { fontSize, volume } = profileService.getProfile().accessibility;
    expect(fontSize).not.toBe('normal');
    expect(volume).toBe(1);
    await click(button('Siguiente'));
    await click(button('Siguiente'));
    expect(container.textContent).toContain('Paso 3 de 3');
    await click(button('Listo'));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
