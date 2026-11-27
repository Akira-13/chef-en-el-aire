import { describe, expect, it } from 'vitest';
import { DIET_LABELS, withAllergy } from './dietary';

describe('withAllergy', () => {
  it('agrega la alergia y conserva el orden de las categorías', () => {
    expect(withAllergy(['mani'], 'gluten', true)).toEqual(['gluten', 'mani']);
  });

  it('quita la alergia desmarcada', () => {
    expect(withAllergy(['gluten', 'mani'], 'gluten', false)).toEqual(['mani']);
  });

  it('no duplica una alergia ya marcada', () => {
    expect(withAllergy(['mani'], 'mani', true)).toEqual(['mani']);
  });
});

describe('DIET_LABELS', () => {
  it('usa solo las dietas que existen en los datos de los perfiles', () => {
    expect(Object.keys(DIET_LABELS).sort()).toEqual(['omnivora', 'vegetariana']);
  });
});
