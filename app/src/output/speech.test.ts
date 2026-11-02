import { describe, expect, it } from 'vitest';
import { toProfile, type RawProfileBook } from '@chef/shared';
import rawProfiles from '../../../datos/perfiles.json';
import { pickSpanishVoice, textFor, wantsAudio, wantsSubtitles } from './speech';

const profiles = (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile);

function prefsOf(id: string) {
  const profile = profiles.find((p) => p.id === id);
  if (!profile) throw new Error(`Falta el perfil ${id}`);
  return profile.accessibility;
}

describe('elección de voz', () => {
  it('prefiere es-PE, luego es-US, es-419 y cualquier es-*', () => {
    const voices = [{ lang: 'en-US' }, { lang: 'es-ES' }, { lang: 'es_US' }, { lang: 'es-PE' }];
    expect(pickSpanishVoice(voices)?.lang).toBe('es-PE');
    expect(pickSpanishVoice(voices.slice(0, 3))?.lang).toBe('es_US');
    expect(pickSpanishVoice(voices.slice(0, 2))?.lang).toBe('es-ES');
    expect(pickSpanishVoice([{ lang: 'en-GB' }])).toBeUndefined();
  });
});

describe('canales de salida según el perfil', () => {
  it('Javier (USR-004, sordo): sin audio y con subtítulos (CA-20.2)', () => {
    const prefs = prefsOf('USR-004');
    expect(wantsAudio(prefs)).toBe(false);
    expect(wantsSubtitles(prefs)).toBe(true);
  });

  it('Carmen (USR-003, baja visión): todo se escucha', () => {
    expect(wantsAudio(prefsOf('USR-003'))).toBe(true);
  });

  it('sin salida de audio hay subtítulos aunque el perfil no los pida', () => {
    expect(wantsSubtitles({ ttsEnabled: false, outputs: ['visual'], subtitles: false })).toBe(true);
    expect(wantsSubtitles({ ttsEnabled: true, outputs: ['visual', 'audio'] })).toBe(false);
  });
});

describe('verbosidad (CA-13.3)', () => {
  const announcement = {
    text: 'Paso 1. Lava bien el arroz hasta que el agua salga clara.',
    short: 'Paso 1. Lava el arroz.',
  };

  it('breve lee el texto corto y detallada el completo', () => {
    expect(textFor(announcement, 'breve')).toBe(announcement.short);
    expect(textFor(announcement, 'detallada')).toBe(announcement.text);
  });

  it('breve usa el texto completo si no hay corto', () => {
    expect(textFor({ text: 'Hola' }, 'breve')).toBe('Hola');
  });
});
