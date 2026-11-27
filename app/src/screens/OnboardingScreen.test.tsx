import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandBus } from '../core/commandBus';
import { profileService } from '../core/services';
import { OnboardingScreen } from './OnboardingScreen';
import { isOnboarded } from './onboardingState';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const heading = () => container.querySelector('h1')?.textContent;
const button = (name: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent === name);

async function press(name: string) {
  await act(async () => {
    button(name)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const setupHeading = () => container.querySelector('h2')?.textContent;

async function typeName(name: string) {
  const input = container.querySelector('input')!;
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setValue.call(input, name);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// Crear el perfil escribe en IndexedDB: se espera a que la pantalla pase a la configuración.
async function submitName(name: string) {
  await typeName(name);
  await press('Continuar');
  await vi.waitFor(() => expect(setupHeading()).toBe('¿Cómo ves mejor?'));
}

describe('OnboardingScreen: nombre y perfil nuevo (CA-22.3)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await profileService.reset();
    container = document.createElement('div');
    // Conectado al documento para que enviar el formulario funcione como en el navegador.
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/bienvenida']}>
          <Routes>
            <Route path="/bienvenida" element={<OnboardingScreen />} />
            <Route path="/" element={<p>inicio</p>} />
          </Routes>
        </MemoryRouter>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('pide el nombre antes de la configuración de accesibilidad', () => {
    expect(setupHeading()).toBe('¿Cómo te llamas?');
    const input = container.querySelector('input')!;
    expect(input.closest('label')?.textContent).toContain('Tu nombre');
  });

  it('con el nombre vacío avisa y no avanza ni crea perfil', async () => {
    await press('Continuar');
    expect(setupHeading()).toBe('¿Cómo te llamas?');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Escribe tu nombre');
    expect(button('Continuar')?.disabled).toBe(false);
    expect(profileService.listProfiles()).toHaveLength(4);
  });

  it('Enter en el campo envía el nombre', async () => {
    await typeName('Lucía');
    await act(async () => {
      container.querySelector('form')!.requestSubmit();
    });
    await vi.waitFor(() => expect(setupHeading()).toBe('¿Cómo ves mejor?'));
  });

  it('el nombre de un perfil de ejemplo está permitido: crea uno propio', async () => {
    await submitName('Diego');
    expect(profileService.getProfile().id).toMatch(/^USR-1\d\d$/);
    expect(profileService.listProfiles()).toHaveLength(5);
  });

  it('un nombre repetido de otro perfil propio muestra el error y se queda en el paso', async () => {
    await profileService.createProfile('Lucía');
    await profileService.createProfile('Ana');
    await typeName('lucía');
    await press('Continuar');
    await vi.waitFor(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain('Ya existe'),
    );
    expect(setupHeading()).toBe('¿Cómo te llamas?');
  });

  it('al reabrir la bienvenida con el perfil ya creado, el nombre se rellena y continúa sin duplicar', async () => {
    const id = await profileService.createProfile('Lucía');
    const total = profileService.listProfiles().length;
    // Se recarga a mitad del recorrido: la pantalla vuelve a montarse con el perfil activo.
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/bienvenida']}>
          <Routes>
            <Route path="/bienvenida" element={<OnboardingScreen />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await vi.waitFor(() => expect(container.querySelector('input')!.value).toBe('Lucía'));
    await press('Continuar');
    await vi.waitFor(() => expect(setupHeading()).toBe('¿Cómo ves mejor?'));
    expect(profileService.getProfile().id).toBe(id);
    expect(profileService.listProfiles()).toHaveLength(total);
  });

  it('crea el perfil, guarda ahí la accesibilidad y deja a Diego intacto', async () => {
    await profileService.selectProfile('USR-002');
    const diego = profileService.getProfile();

    await submitName('Lucía');
    expect(profileService.getProfile().name).toBe('Lucía');
    // La configuración parte de valores generosos y se guarda al instante en el perfil nuevo.
    await vi.waitFor(() =>
      expect(profileService.getProfile().accessibility.fontSize).toBe('grande'),
    );
    await act(async () => {
      [...container.querySelectorAll('label')]
        .find((l) => l.textContent === 'Muy grande')
        ?.querySelector('input')
        ?.click();
    });

    const created = profileService.getProfile();
    expect(created.name).toBe('Lucía');
    expect(created.accessibility.fontSize).toBe('extragrande');

    await profileService.selectProfile('USR-002');
    expect(profileService.getProfile()).toEqual(diego);
    expect(profileService.getProfile().accessibility.fontSize).toBe('normal');
  });
});

describe('OnboardingScreen: configuración de accesibilidad (CA-22.2)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await profileService.reset();
    container = document.createElement('div');
    // Conectado al documento para que enviar el formulario funcione como en el navegador.
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/bienvenida']}>
          <Routes>
            <Route path="/bienvenida" element={<OnboardingScreen />} />
            <Route path="/" element={<p>inicio</p>} />
          </Routes>
        </MemoryRouter>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('empieza con la configuración en 3 pantallas y luego sigue el recorrido', async () => {
    await submitName('Lucía');
    expect(setupHeading()).toBe('¿Cómo ves mejor?');
    expect(container.textContent).toContain('Paso 1 de 3');
    await press('Siguiente');
    await press('Siguiente');
    expect(container.textContent).toContain('Paso 3 de 3');
    await press('Listo');
    expect(heading()).toBe('Cocina sin tocar la pantalla');
  });

  it('se puede dejar para después y pasar directo al recorrido', async () => {
    await submitName('Lucía');
    await press('Lo configuro después');
    expect(heading()).toBe('Cocina sin tocar la pantalla');
    expect(isOnboarded()).toBe(false);
  });
});

describe('OnboardingScreen (HU-36)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await profileService.reset();
    container = document.createElement('div');
    // Conectado al documento para que enviar el formulario funcione como en el navegador.
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/bienvenida']}>
          <Routes>
            <Route path="/bienvenida" element={<OnboardingScreen />} />
            <Route path="/" element={<p>inicio</p>} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await submitName('Lucía');
    await press('Lo configuro después');
    // Los temporizadores falsos van después: IndexedDB necesita los reales para guardar.
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('avanza solo al practicar "siguiente" por el canal de cada paso (CA-36.1)', async () => {
    await press('Continuar');
    expect(heading()).toBe('Prueba con la voz');

    await act(async () => void commandBus.emit({ type: 'next' }, 'gesture'));
    await act(async () => void vi.advanceTimersByTime(2000));
    expect(heading()).toBe('Prueba con la voz');

    await act(async () => void commandBus.emit({ type: 'next' }, 'voice'));
    expect(container.textContent).toContain('¡Muy bien!');
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(heading()).toBe('Prueba con un gesto');

    await act(async () => void commandBus.emit({ type: 'next' }, 'gesture'));
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(heading()).toBe('¡Listo para cocinar!');
  });

  it('se puede completar solo con toques: ningún canal es obligatorio (RF-24)', async () => {
    await press('Continuar');
    await press('Continuar');
    await press('Continuar');
    await press('Empezar');
    expect(isOnboarded()).toBe(true);
    expect(container.textContent).toContain('inicio');
  });

  it('se puede saltar en cualquier paso', async () => {
    await press('Saltar');
    expect(isOnboarded()).toBe(true);
    expect(container.textContent).toContain('inicio');
  });
});
