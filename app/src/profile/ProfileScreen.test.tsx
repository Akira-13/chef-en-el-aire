import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import { toRecipes, type RawRecipeBook } from '@chef/shared';
import { output, profileService } from '../core/services';
import { suggestRecipes } from '../personalization';
import { SubstitutionHints } from '../personalization/SubstitutionHints';
import { getDeviceKey } from '../community/device';
import { createFakeCommunityServer } from '../community/fakeServer';
import { publishPost } from '../community/outbox';
import { COMMUNITY_STORAGE_KEYS, addOwnPostId } from '../community/storage';
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
  localStorage.clear();
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
  describe('¿Quién cocina?', () => {
    const select = () => container.querySelector<HTMLSelectElement>('#perfil-ejemplos-select')!;
    const optionTexts = () => [...select().options].map((o) => o.textContent);

    async function choose(value: string) {
      await act(async () => {
        const setValue = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          'value',
        )!.set!;
        setValue.call(select(), value);
        select().dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    it('agrupa los perfiles de ejemplo en un selector con etiqueta real, sin tarjetas', async () => {
      await render(<ProfileScreen />);
      expect(select().labels?.[0]?.textContent).toBe('Perfiles de ejemplo');
      expect(select().getAttribute('aria-pressed')).toBeNull();
      expect(select().disabled).toBe(false);
      expect([...select().options].some((o) => o.disabled)).toBe(false);
      expect(optionTexts()).toEqual(
        expect.arrayContaining([
          'Elegir un perfil de ejemplo…',
          expect.stringContaining('Rosa — artritis') as unknown as string,
        ]),
      );
      expect(optionTexts()).toHaveLength(5);
      expect(button('Rosa')).toBeUndefined();
      expect(container.textContent).not.toContain('Mis perfiles');
    });

    it('sin perfiles creados explica que son personas de demostración', async () => {
      await render(<ProfileScreen />);
      expect(container.textContent).toContain('personas de demostración');
      expect(container.textContent).toContain('se guardan en ellas');
    });

    it('elegir un ejemplo cambia de perfil, lo anuncia y lo deja a la vista', async () => {
      const announce = vi.spyOn(output, 'announce');
      await render(<ProfileScreen />);
      await choose('USR-001');
      expect(profileService.getProfile().name).toBe('Rosa');
      expect(announce).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Ahora cocina Rosa.' }),
      );
      expect(select().value).toBe('USR-001');
      expect(container.textContent).toContain('Perfil de ejemplo activo: Rosa');
      announce.mockRestore();
    });

    it('la opción inicial no hace nada', async () => {
      await render(<ProfileScreen />);
      await choose('');
      expect(profileService.getProfile().id).toBe('USR-002');
    });

    it('los perfiles creados siguen como tarjetas y el selector queda en la opción inicial', async () => {
      await profileService.createProfile('Lucía');
      await render(<ProfileScreen />);
      expect(container.textContent).toContain('Mis perfiles');
      const lucia = button('Lucía')!;
      expect(lucia.getAttribute('aria-pressed')).toBe('true');
      expect(lucia.textContent).toContain('Sin condición declarada');
      expect(select().value).toBe('');
      expect(container.textContent).not.toContain('Perfil de ejemplo activo');
      expect(container.textContent).not.toContain('personas de demostración');
      expect(optionTexts().some((t) => t?.includes('Lucía'))).toBe(false);
    });

    it('volver desde un ejemplo a un perfil propio con la tarjeta', async () => {
      const id = await profileService.createProfile('Lucía');
      await profileService.selectProfile('USR-001');
      await render(<ProfileScreen />);
      expect(button('Lucía')!.getAttribute('aria-pressed')).toBe('false');
      expect(select().value).toBe('USR-001');
      await click(button('Lucía'));
      expect(profileService.getProfile().id).toBe(id);
      expect(button('Lucía')!.getAttribute('aria-pressed')).toBe('true');
      expect(select().value).toBe('');
    });
  });

  it('permite editar alergias y dieta, y se guardan al instante (RF-28)', async () => {
    await profileService.selectProfile('USR-002');
    await render(<ProfileScreen />);
    expect(checkbox('maní').checked).toBe(true);
    await click(checkbox('leche'));
    expect(profileService.getProfile().explicit.allergies).toContain('leche');
    await click(checkbox('maní'));
    expect(profileService.getProfile().explicit.allergies).not.toContain('mani');
    await click(checkbox('Vegetariana'));
    expect(profileService.getProfile().explicit.diet).toBe('vegetariana');
  });

  it('«No tengo alergias» sigue al perfil activo al cambiar de perfil', async () => {
    const id = await profileService.createProfile('Lucía');
    await profileService.selectProfile('USR-002');
    await render(<ProfileScreen />);
    expect(checkbox('No tengo alergias').checked).toBe(false);
    await act(async () => profileService.selectProfile(id));
    expect(checkbox('No tengo alergias').checked).toBe(true);
    await act(async () => profileService.selectProfile('USR-002'));
    expect(checkbox('No tengo alergias').checked).toBe(false);
  });

  it('sigue mostrando las restricciones de los comensales', async () => {
    await profileService.selectProfile('USR-001');
    await render(<ProfileScreen />);
    const dinerRestrictions = profileService.getProfile().explicit.dinerRestrictions;
    expect(dinerRestrictions.length).toBeGreaterThan(0);
    expect(container.textContent).toContain(`${dinerRestrictions[0]!.diner}: sin `);
  });

  it('la valoración de "Mis platos" es una imagen con etiqueta accesible (RF-27)', async () => {
    await profileService.recordEvent({
      type: 'recipeCompleted',
      recipeId: 'REC-001',
      substitutions: [],
    });
    await profileService.recordEvent({ type: 'recipeRated', recipeId: 'REC-001', rating: 4 });
    await render(<ProfileScreen />);
    const stars = container.querySelector('[role="img"]');
    expect(stars?.getAttribute('aria-label')).toBe('Valoración: 4 de 5 estrellas');
  });

  it('las tarjetas de persona tienen un borde visible (CA-22.1)', () => {
    const css = readFileSync(join(process.cwd(), 'src/profile/profile.module.css'), 'utf8');
    const rule = /\.persona \{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(rule).toMatch(/border:\s*3px solid var\(--color-cork\)/);
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

  it('cambiar el nivel se guarda y cambia las sugerencias (CA-33.1)', async () => {
    // Diego (novato) con dos recetas básicas y una avanzada: solo entra la avanzada relajando
    // la dificultad; como avanzado, entra sin relajar nada.
    const subset = recipes.filter((r) => ['REC-003', 'REC-006', 'REC-010'].includes(r.id));
    await render(<ProfileScreen />);
    expect(profileService.getProfile().skillLevel).toBe('novato');
    expect(suggestRecipes(subset, profileService.getProfile()).message).toContain('la dificultad');

    await click(checkbox('Avanzado'));
    expect(profileService.getProfile().skillLevel).toBe('avanzado');
    expect(checkbox('Avanzado').checked).toBe(true);
    const advanced = suggestRecipes(subset, profileService.getProfile());
    expect(advanced.recipes.map((r) => r.id)).toContain('REC-010');
    expect(advanced.message).toBeUndefined();
  });

  it('el tono elegido queda en el perfil (RF-41)', async () => {
    await render(<ProfileScreen />);
    expect(profileService.getProfile().emotional.assistantTone).toBe('animado y paciente');
    await click(checkbox('Calmado'));
    expect(profileService.getProfile().emotional.assistantTone).toBe('calmado');
  });

  it('conserva como opción un tono que no está en la lista (RF-41)', async () => {
    await profileService.update((p) => ({
      ...p,
      emotional: { ...p.emotional, assistantTone: 'paciente y bromista' },
    }));
    await render(<ProfileScreen />);
    expect(checkbox('Paciente y bromista').checked).toBe(true);
  });

  async function typeAlias(text: string) {
    const input = container.querySelector<HTMLInputElement>(
      '[aria-labelledby="perfil-comunidad"] input',
    )!;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setValue.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      input.form!.requestSubmit();
    });
    return input;
  }

  it('guarda el alias y sale en la exportación (CA-25.3)', async () => {
    await render(<ProfileScreen />);
    const input = await typeAlias('  La sazón de casa ');
    expect(profileService.getProfile().community).toEqual({ alias: 'La sazón de casa' });
    expect(profileService.exportRaw().comunidad).toEqual({ alias: 'La sazón de casa' });
    expect(container.textContent).toContain('16 de 30 caracteres');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('no guarda el nombre real como alias y lo avisa (RF-33)', async () => {
    await render(<ProfileScreen />);
    await typeAlias('Diego');
    expect(profileService.getProfile().community).toBeUndefined();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('no tu nombre real');
  });

  it('borrar elimina el alias, la clave del dispositivo, las propias y la cola (RNF-11)', async () => {
    await render(<ProfileScreen />);
    await typeAlias('La sazón de casa');
    getDeviceKey();
    addOwnPostId('p1');
    localStorage.setItem(COMMUNITY_STORAGE_KEYS.queue, '[]');

    await click(button('Borrar mis datos'));
    await click(button('Sí, borrar mis datos'));

    expect(profileService.getProfile().community).toBeUndefined();
    for (const key of Object.values(COMMUNITY_STORAGE_KEYS)) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    const input = container.querySelector<HTMLInputElement>(
      '[aria-labelledby="perfil-comunidad"] input',
    )!;
    expect(input.value).toBe('');
  });

  it('borrar mis datos borra antes lo publicado en la Comunidad (CA-25.3)', async () => {
    const server = createFakeCommunityServer();
    vi.stubGlobal('fetch', vi.fn(server.fetch));
    await publishPost({
      kind: 'achievement',
      alias: 'Rosita',
      recipeId: 'REC-001',
      recipeName: 'Ají de gallina',
    });
    expect(server.posts).toHaveLength(1);
    await render(<ProfileScreen />);

    await click(button('Borrar mis datos'));
    await click(button('Sí, borrar mis datos'));

    expect(server.requests.filter((r) => r.method === 'DELETE')).toHaveLength(1);
    expect(server.posts).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it('sin red avisa que lo publicado quedará en la Comunidad (CA-25.3)', async () => {
    const announce = vi.spyOn(output, 'announce');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    addOwnPostId('PUB-0001');
    await render(<ProfileScreen />);

    await click(button('Borrar mis datos'));
    await click(button('Sí, borrar mis datos'));
    await act(async () => {
      for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(announce).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('quedarán publicadas') as unknown }),
    );
    expect(localStorage.getItem(COMMUNITY_STORAGE_KEYS.ownPosts)).toBeNull();
    announce.mockRestore();
    vi.unstubAllGlobals();
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
