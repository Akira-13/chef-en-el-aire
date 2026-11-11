import { describe, expect, it } from 'vitest';
import { isEcho } from './echo';

describe('eco del altavoz', () => {
  const spoken = ['Agregué arroz, huevos y cebolla a tu despensa.'];

  it('reconoce lo que acaba de leer la app aunque la transcripción no sea exacta', () => {
    expect(isEcho('agregue arroz huevos y cebolla a tu despensa', spoken)).toBe(true);
    expect(isEcho('arroz huevos y cebolla', spoken)).toBe(true);
  });

  it('no confunde una orden del usuario que comparte alguna palabra', () => {
    expect(isEcho('chef tengo arroz', spoken)).toBe(false);
    expect(isEcho('chef repite el paso', ['Paso 2. Corta el pollo en el paso anterior.'])).toBe(false);
  });

  it('las respuestas de una palabra nunca son eco', () => {
    expect(isEcho('sí', ['¿Dijiste «siguiente»? Di «sí».'])).toBe(false);
  });

  it('sin nada leído hace poco no hay eco', () => {
    expect(isEcho('agregue arroz a tu despensa', [])).toBe(false);
  });
});
