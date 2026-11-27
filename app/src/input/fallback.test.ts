import { afterEach, describe, expect, it, vi } from 'vitest';
import { output } from '../core/services';
import { reportVoiceSupportAtStart } from './fallback';

const prefs = { activeInputs: ['voz', 'tactil'] as ('voz' | 'gestos' | 'tactil')[] };

function stubSpeech({ recognition, synthesis }: { recognition: boolean; synthesis: boolean }) {
  vi.stubGlobal('webkitSpeechRecognition', recognition ? class {} : undefined);
  vi.stubGlobal('SpeechRecognition', undefined);
  vi.stubGlobal('speechSynthesis', synthesis ? {} : undefined);
}

const announced = () => vi.spyOn(output, 'announce').mockImplementation(() => {});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('aviso de voz no soportada al iniciar (CA-21.3, RNF-15)', () => {
  it('avisa que el navegador no reconoce la voz si no hay reconocimiento', () => {
    stubSpeech({ recognition: false, synthesis: true });
    const announce = announced();
    expect(reportVoiceSupportAtStart(prefs)).toBe(false);
    expect(announce).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Este navegador no reconoce la voz. Usa gestos o toca la pantalla.',
        kind: 'error',
      }),
    );
  });

  it('avisa que no puede leer en voz alta si falta la síntesis', () => {
    stubSpeech({ recognition: true, synthesis: false });
    const announce = announced();
    expect(reportVoiceSupportAtStart(prefs)).toBe(false);
    expect(announce).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('leer en voz alta') }),
    );
  });

  it('no avisa si la voz funciona', () => {
    stubSpeech({ recognition: true, synthesis: true });
    const announce = announced();
    expect(reportVoiceSupportAtStart(prefs)).toBe(true);
    expect(announce).not.toHaveBeenCalled();
  });

  it('no avisa si la persona no usa la voz', () => {
    stubSpeech({ recognition: false, synthesis: false });
    const announce = announced();
    expect(reportVoiceSupportAtStart({ activeInputs: ['tactil'] })).toBe(true);
    expect(announce).not.toHaveBeenCalled();
  });
});
