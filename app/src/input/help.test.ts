import { describe, expect, it } from 'vitest';
import type { AccessibilityPrefs, CommandContext } from '@chef/shared';
import { gestureFor, helpFor, helpSpeech } from './help';

type Prefs = Parameters<typeof helpFor>[1];

const PREFS: Prefs = {
  activeInputs: ['voz', 'gestos', 'tactil'],
  voiceDisabled: false,
  enabledGestures: [
    'palma_abierta_pausar',
    'deslizar_siguiente',
    'deslizar_anterior',
    'pulgar_arriba_confirmar',
  ],
  requiresActivationGesture: false,
} satisfies Partial<AccessibilityPrefs>;

const COOKING: CommandContext = { screen: 'cooking', activeTimers: [], alertActive: false };

describe('ayuda contextual (RF-14, CA-12.3)', () => {
  it('incluye "inicia temporizador" solo si el paso tiene temporizador', () => {
    expect(helpFor(COOKING, PREFS).voice).not.toContain('inicia temporizador');
    expect(helpFor({ ...COOKING, stepHasTimer: true }, PREFS).voice).toContain(
      'inicia temporizador',
    );
  });

  it('con un temporizador activo ofrece consultarlo y detenerlo', () => {
    const voice = helpFor({ ...COOKING, activeTimers: ['arroz'] }, PREFS).voice;
    expect(voice).toContain('¿cuánto falta?');
    expect(voice).toContain('detén temporizador');
  });

  it('con una alerta, el pulgar arriba dice "listo"', () => {
    const help = helpFor({ ...COOKING, alertActive: true }, PREFS);
    expect(help.voice[0]).toBe('listo');
    expect(help.gestures.find((g) => g.icon === '👍')?.does).toBe('listo');
  });

  it('solo muestra los gestos habilitados y en pantallas con cámara', () => {
    const rosa = { ...PREFS, enabledGestures: ['palma_abierta_pausar'] } satisfies Prefs;
    expect(helpFor(COOKING, rosa).gestures.map((g) => g.command)).toEqual(['pause']);
    expect(helpFor({ ...COOKING, screen: 'home' }, PREFS).gestures).toEqual([]);
  });

  it('sin voz no ofrece comandos de voz', () => {
    const javier = { ...PREFS, voiceDisabled: true } satisfies Prefs;
    expect(helpFor(COOKING, javier).voice).toEqual([]);
  });

  it('ofrece comandos de voz en Inicio y Receta, donde el micrófono ahora corre', () => {
    expect(helpFor({ ...COOKING, screen: 'home' }, PREFS).voice).toContain('busca…');
    expect(helpFor({ ...COOKING, screen: 'recipe' }, PREFS).voice).toContain('sustituye…');
  });

  it('no ofrece comandos de voz en pantallas sin micrófono (RF-14)', () => {
    // La ayuda no puede prometer «di chef y luego…» donde el reconocimiento no está encendido.
    expect(helpFor({ ...COOKING, screen: 'profile' }, PREFS).voice).toEqual([]);
  });

  it('avisa del gesto de activación si el perfil lo pide', () => {
    const carmen = { ...PREFS, requiresActivationGesture: true } satisfies Prefs;
    expect(helpFor(COOKING, carmen).gestureNote).toMatch(/índice/);
    expect(helpSpeech(helpFor(COOKING, carmen)).text).toMatch(/levanta el índice para/);
  });

  it('el texto breve solo nombra los comandos de voz', () => {
    const { text, short } = helpSpeech(helpFor(COOKING, PREFS));
    expect(short).toMatch(/^Puedes decir «chef» y luego: siguiente, anterior/);
    expect(text).toMatch(/Gestos: .*palma abierta sostenida para pausar/);
  });

  it('sugiere el gesto equivalente a un comando (CA-14.2)', () => {
    expect(gestureFor('next', COOKING, PREFS)?.icon).toBe('👈');
    expect(gestureFor('repeat', COOKING, PREFS)).toBeUndefined();
  });
});
