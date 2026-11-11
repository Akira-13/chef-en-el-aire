import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import {
  findAllergens,
  toProfile,
  toRecipes,
  type Profile,
  type RawProfileBook,
  type RawRecipeBook,
} from '@chef/shared';
import {
  addToPantry,
  applySubstitution,
  findSimilarRecipes,
  pantryStatus,
  proposeSubstitutions,
  searchRecipes,
  substituteFor,
  suggestRecipes,
} from './index';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const profiles = (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile);
const byName = (name: string) => profiles.find((p) => p.name === name)!;
const recipe = (id: string) => recipes.find((r) => r.id === id)!;
const ids = (list: { id: string }[]) => list.map((r) => r.id);

const rosa = byName('Rosa');
const diego = byName('Diego');
const carmen = byName('Carmen');
const javier = byName('Javier');

describe('sugerencias', () => {
  it('Diego con 40 min ve 3 recetas sin maní, ninguna avanzada (CA-01.1)', () => {
    const { recipes: suggested, message } = suggestRecipes(recipes, diego, {
      availableMinutes: 40,
    });
    expect(suggested).toHaveLength(3);
    expect(message).toBeUndefined();
    for (const r of suggested) {
      expect(r.allergens).not.toContain('mani');
      expect(r.difficulty).not.toBe('avanzado');
      expect(r.totalMinutes).toBeLessThanOrEqual(40);
    }
  });

  it('primero las que aprovechan más la despensa (CA-01.2)', () => {
    const cook: Profile = {
      ...carmen,
      pantry: ['papa amarilla', 'pollo', 'cebolla'],
      learned: { ...carmen.learned, likes: [] },
      history: [],
      explicit: { ...carmen.explicit, dinerRestrictions: [] },
    };
    const { recipes: suggested } = suggestRecipes(recipes, cook);
    // Causa limeña de pollo usa papa amarilla y pollo; ají de gallina, pollo, cebolla y papa.
    expect(ids(suggested).slice(0, 2).sort()).toEqual(['REC-001', 'REC-003']);
  });

  it('a igual despensa, desempata por gustos y luego por valoración (CA-01.2)', () => {
    const cook: Profile = { ...diego, pantry: [] };
    const { recipes: suggested } = suggestRecipes(recipes, cook);
    // Le gusta la pasta y la comida rápida: tallarines y tortilla primero; la tortilla gana
    // porque la valoró con 5.
    expect(ids(suggested).slice(0, 2)).toEqual(['REC-004', 'REC-005']);
  });

  it('relaja el tiempo antes que la dificultad y lo explica (CA-01.3)', () => {
    const { recipes: suggested, message } = suggestRecipes(recipes, diego, {
      availableMinutes: 20,
    });
    expect(suggested).toHaveLength(3);
    expect(suggested.some((r) => r.difficulty === 'avanzado')).toBe(false);
    expect(message).toMatch(/tiempo/);
    expect(message).not.toMatch(/dificultad/);
    expect(message).toMatch(/nunca tus alergias/);
  });

  it('relaja la dificultad si con el tiempo no alcanza, nunca los alérgenos (CA-01.3)', () => {
    const picky: Profile = {
      ...diego,
      explicit: {
        ...diego.explicit,
        allergies: ['mani', 'huevo', 'gluten', 'leche', 'pescado', 'soya'],
      },
    };
    const { recipes: suggested, message } = suggestRecipes(recipes, picky);
    for (const r of suggested) {
      expect(findAllergens(r, { ...picky.explicit })).toHaveLength(0);
    }
    expect(message).toBeDefined();
  });

  it('nunca sugiere recetas con alérgenos de un comensal (RF-07)', () => {
    const { recipes: suggested } = suggestRecipes(recipes, rosa);
    expect(suggested).toHaveLength(3);
    for (const r of suggested) expect(r.allergens).not.toContain('leche');
  });

  it('con dieta vegetariana solo propone carne si tiene sustituto vegetariano', () => {
    const { recipes: suggested } = suggestRecipes(recipes, javier);
    expect(suggested).toHaveLength(3);
    const meat = ['REC-001', 'REC-003', 'REC-009'];
    for (const r of suggested) expect(meat).not.toContain(r.id);
  });

  it('no sugiere lo que no le gusta', () => {
    const cook: Profile = { ...diego, learned: { ...diego.learned, dislikes: ['pasta'] } };
    expect(ids(suggestRecipes(recipes, cook).recipes)).not.toContain('REC-005');
  });
});

describe('búsqueda', () => {
  it('"quinua" encuentra la ensalada de quinua (CA-02.1)', () => {
    expect(ids(searchRecipes(recipes, 'quinua'))).toContain('REC-006');
    expect(ids(searchRecipes(recipes, 'busca recetas con quinua'))).toContain('REC-006');
  });

  it('"lomo" encuentra el lomo saltado (CA-02.2)', () => {
    expect(ids(searchRecipes(recipes, 'lomo'))[0]).toBe('REC-002');
  });

  it('busca sin tildes, en plural y por etiqueta', () => {
    expect(ids(searchRecipes(recipes, 'aji de gallina'))).toEqual(['REC-001']);
    expect(ids(searchRecipes(recipes, 'tomates'))).toContain('REC-005');
    expect(ids(searchRecipes(recipes, 'postre'))).toEqual(['REC-007']);
  });

  it('propone recetas parecidas cuando no hay resultados (CA-02.3)', () => {
    expect(searchRecipes(recipes, 'kinua')).toHaveLength(0);
    expect(ids(findSimilarRecipes(recipes, 'kinua'))).toContain('REC-006');
    expect(ids(findSimilarRecipes(recipes, 'tallarín con pesto'))).toContain('REC-005');
  });

  it('las recetas parecidas respetan los alérgenos del perfil', () => {
    expect(ids(findSimilarRecipes(recipes, 'ocopa', diego))).not.toContain('REC-008');
  });
});

describe('despensa', () => {
  it('marca tengo, falta o sustituir en el ají de gallina (CA-03.2)', () => {
    const status = pantryStatus(recipe('REC-001'), rosa);
    expect(status['ING-001']).toBe('have'); // pechuga de pollo ← pollo
    expect(status['ING-005']).toBe('have'); // pan de molde
    expect(status['ING-006']).toBe('substitute'); // leche evaporada
    expect(status['ING-010']).toBe('have'); // papa amarilla sancochada ← papa amarilla
    expect(Object.values(status).every((s) => ['have', 'missing', 'substitute'].includes(s))).toBe(
      true,
    );
  });

  it('compara sin tildes y en singular o plural', () => {
    const status = pantryStatus(recipe('REC-004'), { ...diego, pantry: ['huevo', 'tomates'] });
    expect(status['ING-025']).toBe('have'); // huevos
    expect(status['ING-027']).toBe('have'); // tomate picado
    const aji = pantryStatus(recipe('REC-003'), { ...diego, pantry: ['aji amarillo'] });
    expect(aji['ING-019']).toBe('have'); // pasta de ají amarillo
  });

  it('no confunde palabras parecidas', () => {
    const status = pantryStatus(recipe('REC-010'), { ...diego, pantry: ['ajo'] });
    expect(status['ING-068']).not.toBe('have'); // aceite de ajonjolí
  });

  it('agrega a la despensa sin repetir', () => {
    expect(addToPantry(['huevos'], ['huevo', 'Papa', ' '])).toEqual(['huevos', 'Papa']);
  });
});

describe('sustituciones', () => {
  const leche = recipe('REC-001').ingredients.find((i) => i.id === 'ING-006')!;

  it('ofrece caldo de pollo + maicena por la leche evaporada (CA-03.3)', () => {
    expect(substituteFor(leche, rosa)?.name).toBe('caldo de pollo + 2 cda de maicena');
  });

  it('prioriza la sustitución que el usuario ya aceptó (CA-24.2)', () => {
    const cook: Profile = {
      ...rosa,
      learned: {
        ...rosa.learned,
        acceptedSubstitutions: [{ original: 'leche evaporada', substitute: 'bebida de avena' }],
      },
    };
    expect(substituteFor(leche, cook)?.name).toBe('bebida de avena');
  });

  it('lo rechazado no se propone primero (CA-24.2)', () => {
    const queso = recipe('REC-008').ingredients.find((i) => i.id === 'ING-053')!;
    const cook: Profile = {
      ...rosa,
      learned: {
        ...rosa.learned,
        acceptedSubstitutions: [],
        rejectedSubstitutions: [
          { original: 'leche evaporada', substitute: 'bebida de avena sin gluten' },
        ],
      },
    };
    expect(proposeSubstitutions(recipe('REC-008'), cook).map((p) => p.ingredientId)).not.toContain(
      queso.id,
    );
  });

  it('nunca propone un sustituto con un alérgeno del perfil', () => {
    const cook: Profile = {
      ...rosa,
      learned: {
        ...rosa.learned,
        acceptedSubstitutions: [{ original: 'leche evaporada', substitute: 'leche de vaca' }],
      },
    };
    expect(substituteFor(leche, cook)?.name).toBe('caldo de pollo + 2 cda de maicena');
  });

  it('a Rosa se le propone la leche sin pedirlo, por su esposo (CA-23.1)', () => {
    const proposals = proposeSubstitutions(recipe('REC-001'), rosa);
    const milk = proposals.find((p) => p.ingredientId === 'ING-006');
    expect(milk?.substitute.name).toBe('caldo de pollo + 2 cda de maicena');
    expect(milk?.reason).toBe('esposo: intolerancia a la lactosa');
  });

  it('a Javier se le propone champiñones por el lomo', () => {
    const proposals = proposeSubstitutions(recipe('REC-002'), javier);
    expect(proposals.map((p) => p.substitute.name)).toContain('champiñones en láminas');
  });

  it('aplica la sustitución a ingredientes y pasos', () => {
    const original = recipe('REC-001');
    const adapted = applySubstitution(original, 'ING-006', substituteFor(leche, rosa)!);
    const replaced = adapted.ingredients.find((i) => i.id === 'ING-006')!;
    expect(replaced.name).toBe('caldo de pollo + 2 cda de maicena');
    expect(replaced.allergens).toEqual([]);
    expect(JSON.stringify(adapted.steps)).not.toMatch(/leche evaporada/i);
    expect(original.ingredients.find((i) => i.id === 'ING-006')!.name).toBe('leche evaporada');
  });

  it('omitir quita el ingrediente', () => {
    const adapted = applySubstitution(recipe('REC-001'), 'ING-007', {
      name: 'omitir',
      quantity: 0,
      unit: '',
      reason: 'frutos_secos',
    });
    expect(adapted.ingredients.some((i) => i.id === 'ING-007')).toBe(false);
    expect(adapted.allergens).not.toContain('frutos_secos');
  });
});
