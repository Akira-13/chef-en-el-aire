import { describe, expect, it } from 'vitest';
import rawRecipes from '../../../datos/recetas.json';
import rawProfiles from '../../../datos/perfiles.json';
import { toProfile, toRecipes } from '../data/mappers';
import type { RawProfileBook, RawRecipeBook } from '../data/raw';
import type { AllergenFinding, DietaryConstraints } from '../assistant';
import type { AllergenCategory, Ingredient, Recipe } from '../types/recipe';
import { findAllergens, findAllergensInText } from './index';

const recipes = toRecipes(rawRecipes as unknown as RawRecipeBook);
const profiles = (rawProfiles as unknown as RawProfileBook).perfiles.map(toProfile);

function byId<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`No existe ${id}`);
  return item;
}

describe('findAllergens', () => {
  it('detecta el maní de la ocopa para Diego (CA-06.1)', () => {
    const diego = byId(profiles, 'USR-002');
    const findings = findAllergens(byId(recipes, 'REC-008'), diego.explicit);
    expect(findings.map((f) => f.allergen)).toContain('mani');
    expect(findings.every((f) => f.source === 'profile')).toBe(true);
  });

  it('detecta la restricción de un comensal (CA-23.1)', () => {
    const rosa = byId(profiles, 'USR-001');
    const findings = findAllergens(byId(recipes, 'REC-001'), rosa.explicit);
    expect(findings.some((f) => f.source === 'diner' && f.allergen === 'leche')).toBe(true);
  });

  it('no reporta nada si la receta no tiene alérgenos del perfil', () => {
    const diego = byId(profiles, 'USR-002');
    expect(findAllergens(byId(recipes, 'REC-006'), diego.explicit)).toEqual([]);
  });
});

// ---------- Reconocimiento por nombre (RF-07, RNF-06) ----------

function recipeWith(ingredientNames: string[], stepTexts: string[] = []): Recipe {
  const base = byId(recipes, 'REC-006');
  return {
    ...base,
    allergens: [],
    ingredients: ingredientNames.map((name, i): Ingredient => ({
      id: `ING-X${i}`,
      name,
      quantity: 1,
      unit: 'unidad',
      allergens: [],
      substitutes: [],
    })),
    steps: stepTexts.map((text, i) => ({
      number: i + 1,
      text,
      shortText: text,
      timerSeconds: null,
    })),
  };
}

function constraintsFor(...allergies: AllergenCategory[]): DietaryConstraints {
  return { allergies, dinerRestrictions: [], diet: 'omnivora' };
}

function allergensOf(findings: AllergenFinding[]): AllergenCategory[] {
  return [...new Set(findings.map((f) => f.allergen))].sort();
}

const ALL: AllergenCategory[] = [
  'frutos_secos',
  'gluten',
  'huevo',
  'leche',
  'mani',
  'mariscos',
  'pescado',
  'soya',
];

describe('findAllergens por nombre', () => {
  it('detecta ingredientes renombrados sin alérgenos declarados (CA-06.3)', () => {
    const cases: [string, AllergenCategory][] = [
      ['pasta de maní', 'mani'],
      ['Maní tostado', 'mani'],
      ['CACAHUATES', 'mani'],
      ['queso fresco', 'leche'],
      ['yogur natural', 'leche'],
      ['crema de leche', 'leche'],
      ['mantequilla', 'leche'],
      ['fideos', 'gluten'],
      ['tallarín', 'gluten'],
      ['harina sin preparar', 'gluten'],
      ['galletas', 'gluten'],
      ['yemas', 'huevo'],
      ['mayonesa', 'huevo'],
      ['tofu firme', 'soya'],
      ['salsa de soja', 'soya'],
      ['atún en lata', 'pescado'],
      ['anchoas', 'pescado'],
      ['camarones', 'mariscos'],
      ['langostinos', 'mariscos'],
      ['conchas de abanico', 'mariscos'],
      ['nueces', 'frutos_secos'],
      ['pecanas', 'frutos_secos'],
      ['almendras laminadas', 'frutos_secos'],
      ['castañas', 'frutos_secos'],
      ['marañón', 'frutos_secos'],
    ];
    for (const [name, allergen] of cases) {
      const findings = findAllergens(recipeWith([name]), constraintsFor(allergen));
      expect(
        findings.map((f) => f.allergen),
        name,
      ).toContain(allergen);
      expect(findings[0]?.ingredientName).toBe(name);
    }
  });

  it('no confunde palabras que solo contienen el término (CA-06.3)', () => {
    const all = constraintsFor(...ALL);
    expect(findAllergens(recipeWith(['pana', 'panqueque de camote', 'pantano']), all)).toEqual([]);
  });

  it('respeta las excepciones sin perder otros alérgenos (CA-06.3)', () => {
    const milk = constraintsFor('leche');
    expect(findAllergens(recipeWith(['leche de coco']), milk)).toEqual([]);
    expect(findAllergens(recipeWith(['mantequilla de maní']), milk)).toEqual([]);
    expect(findAllergens(recipeWith(['pasta de ají amarillo']), constraintsFor('gluten'))).toEqual(
      [],
    );
    expect(findAllergens(recipeWith(['nuez moscada']), constraintsFor('frutos_secos'))).toEqual([]);
    // La excepción solo quita la categoría indicada.
    expect(
      allergensOf(findAllergens(recipeWith(['mantequilla de maní']), constraintsFor('mani'))),
    ).toEqual(['mani']);
    expect(
      allergensOf(findAllergens(recipeWith(['leche de almendra']), constraintsFor('frutos_secos'))),
    ).toEqual(['frutos_secos']);
    expect(
      allergensOf(findAllergens(recipeWith(['leche de soya']), constraintsFor('soya'))),
    ).toEqual(['soya']);
    expect(
      allergensOf(findAllergens(recipeWith(['pasta de maní']), constraintsFor('mani', 'gluten'))),
    ).toEqual(['mani']);
    // Si la frase tiene también el alérgeno real, se detecta.
    expect(findAllergens(recipeWith(['leche de coco con leche evaporada']), milk)).toHaveLength(1);
  });

  it('respeta lo declarado aunque el nombre parezca inocuo (RF-07)', () => {
    const recipe = recipeWith(['bebida vegetal']);
    recipe.ingredients[0]!.allergens = ['leche'];
    expect(findAllergens(recipe, constraintsFor('leche'))).toHaveLength(1);
  });

  it('atribuye el hallazgo al comensal y no lo duplica (CA-23.1)', () => {
    const recipe = recipeWith(['queso fresco']);
    recipe.ingredients[0]!.allergens = ['leche'];
    const findings = findAllergens(recipe, {
      allergies: ['leche'],
      dinerRestrictions: [{ diner: 'esposo', restriction: 'leche', reason: 'lactosa' }],
      diet: 'omnivora',
    });
    expect(findings.map((f) => [f.source, f.diner])).toEqual([
      ['profile', undefined],
      ['diner', 'esposo'],
    ]);
  });

  it('revisa el texto de los pasos con ingredientId step-<n> (CA-06.1)', () => {
    const recipe = recipeWith(['papa'], ['Hierve la papa.', 'Espolvorea maní picado al final.']);
    const findings = findAllergens(recipe, constraintsFor('mani'));
    expect(findings).toEqual([
      { ingredientId: 'step-2', ingredientName: 'maní', allergen: 'mani', source: 'profile' },
    ]);
  });

  it('no repite en los pasos lo que ya se halló en un ingrediente (CA-06.1)', () => {
    const recipe = recipeWith(['maní tostado'], ['Licúa el maní.']);
    expect(findAllergens(recipe, constraintsFor('mani'))).toHaveLength(1);
  });

  it('no trata "crema" de un paso como lácteo (CA-06.3)', () => {
    const recipe = recipeWith(['papa'], ['La crema espesa y cubre la cuchara.']);
    expect(findAllergens(recipe, constraintsFor('leche'))).toEqual([]);
    expect(findAllergens(recipeWith(['crema fresca']), constraintsFor('leche'))).toHaveLength(1);
  });

  it('findAllergensInText devuelve los términos hallados (CA-06.3)', () => {
    expect(findAllergensInText('Sirve con Queso y maníes')).toEqual([
      { allergen: 'leche', term: 'queso' },
      { allergen: 'mani', term: 'maní' },
    ]);
  });
});

// ---------- CA-06.3: 10 recetas × 4 perfiles, también con metadatos perdidos ----------

interface Watcher {
  allergen: AllergenCategory;
  source: 'profile' | 'diner';
  diner?: string;
}

function watchersOf(constraints: DietaryConstraints): Watcher[] {
  return [
    ...constraints.allergies.map((allergen): Watcher => ({ allergen, source: 'profile' })),
    ...constraints.dinerRestrictions.map((r): Watcher => ({
      allergen: r.restriction,
      source: 'diner',
      diner: r.diner,
    })),
  ];
}

const keyOf = (id: string, w: Watcher) => `${id}|${w.allergen}|${w.source}|${w.diner ?? ''}`;

// Los hallazgos esperados salen de los alérgenos declarados en los datos originales.
function expectedKeys(recipe: Recipe, constraints: DietaryConstraints): string[] {
  const keys: string[] = [];
  for (const ingredient of recipe.ingredients) {
    for (const w of watchersOf(constraints)) {
      if (ingredient.allergens.includes(w.allergen)) keys.push(keyOf(ingredient.id, w));
    }
  }
  return keys;
}

const foundKeys = (findings: AllergenFinding[]) =>
  findings.map((f) =>
    keyOf(f.ingredientId, { allergen: f.allergen, source: f.source, diner: f.diner }),
  );

// Receta "dañada": mismos ingredientes con los metadatos perdidos, como si el LLM los hubiera
// omitido, y algunos renombrados.
const RENAMES: Record<string, string> = {
  'ING-050': 'pasta de maní',
  'ING-051': 'queso fresco',
  'ING-006': 'Leche Evaporada',
  'ING-055': 'filetes de pescado',
};

function damaged(recipe: Recipe): Recipe {
  return {
    ...recipe,
    allergens: [],
    ingredients: recipe.ingredients.map((i) => ({
      ...i,
      name: RENAMES[i.id] ?? i.name,
      allergens: [],
    })),
  };
}

describe('CA-06.3: 10 recetas × 4 perfiles', () => {
  for (const profile of profiles) {
    for (const recipe of recipes) {
      const label = `${recipe.id} × ${profile.name}`;

      it(`detecta todo lo declarado, ${label} (CA-06.3)`, () => {
        const found = foundKeys(findAllergens(recipe, profile.explicit));
        for (const key of expectedKeys(recipe, profile.explicit)) expect(found).toContain(key);
      });

      it(`detecta todo con la receta dañada, ${label} (CA-06.3)`, () => {
        const found = foundKeys(findAllergens(damaged(recipe), profile.explicit));
        for (const key of expectedKeys(recipe, profile.explicit)) expect(found).toContain(key);
      });
    }
  }

  it('no agrega advertencias de más en el recetario original (CA-06.3)', () => {
    for (const profile of profiles) {
      for (const recipe of recipes) {
        const found = foundKeys(findAllergens(recipe, profile.explicit));
        expect([...found].sort(), `${recipe.id} × ${profile.name}`).toEqual(
          [...expectedKeys(recipe, profile.explicit)].sort(),
        );
      }
    }
  });
});
