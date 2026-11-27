// Alergias y dieta (RF-28, RF-07). `DietaryFields` son los controles: se usan en la bienvenida y
// en /perfil, y cada cambio se guarda al instante en el perfil activo. `DietarySetup` es el paso
// de la bienvenida: nunca bloquea, porque quien no tiene alergias continúa sin marcar nada.

import { useEffect, useState } from 'react';
import { ALLERGEN_CATEGORIES, ALLERGEN_LABELS, type AllergenCategory } from '@chef/shared';
import { output, profileService, useProfile } from '../core/services';
import { Button } from '../ui';
import { DIET_LABELS, withAllergy } from './dietary';
import styles from './profile.module.css';

const NONE_LABEL = 'No tengo alergias';

export interface DietaryFieldsProps {
  /** Muestra «No tengo alergias» ya marcada: para un perfil que parte sin alergias. */
  noneOnStart?: boolean;
}

export function DietaryFields({ noneOnStart = false }: DietaryFieldsProps) {
  const { allergies, diet } = useProfile().explicit;
  // Declarar «no tengo alergias» y no haber marcado nada se guardan igual (lista vacía), pero se
  // muestran distinto: así quien no tiene alergias tiene algo que marcar.
  const [none, setNone] = useState(noneOnStart);

  function toggleAllergy(category: AllergenCategory, on: boolean) {
    setNone(false);
    void profileService.update((p) => ({
      ...p,
      explicit: { ...p.explicit, allergies: withAllergy(p.explicit.allergies, category, on) },
    }));
    const label = ALLERGEN_LABELS[category];
    output.announce({
      text: on ? `Alergia a ${label} marcada.` : `Alergia a ${label} quitada.`,
      kind: 'info',
    });
  }

  function declareNone(on: boolean) {
    setNone(on);
    if (!on) return;
    void profileService.update((p) => ({ ...p, explicit: { ...p.explicit, allergies: [] } }));
    output.announce({ text: 'Sin alergias.', kind: 'info' });
  }

  function chooseDiet(value: string) {
    void profileService.update((p) => ({ ...p, explicit: { ...p.explicit, diet: value } }));
    output.announce({
      text: `Dieta: ${(DIET_LABELS[value] ?? value).toLocaleLowerCase('es')}.`,
      kind: 'info',
    });
  }

  // Un perfil con una dieta fuera de la lista (datos viejos) la conserva como opción extra.
  const diets = diet in DIET_LABELS ? DIET_LABELS : { ...DIET_LABELS, [diet]: diet };

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>¿Qué alergias tienes?</legend>
        <div className={styles.options}>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={none && allergies.length === 0}
              onChange={(event) => declareNone(event.target.checked)}
            />
            {NONE_LABEL}
          </label>
          {ALLERGEN_CATEGORIES.map((category) => (
            <label key={category} className={styles.option}>
              <input
                type="checkbox"
                checked={allergies.includes(category)}
                onChange={(event) => toggleAllergy(category, event.target.checked)}
              />
              {ALLERGEN_LABELS[category]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>¿Qué dieta sigues?</legend>
        <div className={styles.options}>
          {Object.entries(diets).map(([value, label]) => (
            <label key={value} className={styles.option}>
              <input
                type="radio"
                name="dieta"
                checked={diet === value}
                onChange={() => chooseDiet(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export interface DietarySetupProps {
  /** Se llama al continuar, con o sin alergias marcadas. */
  onDone(): void;
}

export function DietarySetup({ onDone }: DietarySetupProps) {
  useEffect(() => {
    output.announce({
      text: 'Tu alimentación. Marca tus alergias y elige tu dieta. Si no tienes alergias, sigue con Continuar.',
      kind: 'info',
    });
  }, []);

  return (
    <section className={styles.section} aria-labelledby="alimentacion-titulo">
      <h2 id="alimentacion-titulo" className={styles.sectionTitle}>
        Tu alimentación
      </h2>
      <p className={styles.muted}>
        Con esto cuido que las recetas y sus cambios no lleven lo que no puedes comer. Si no marcas
        nada, entiendo que no tienes alergias. Puedes cambiarlo después en tu perfil.
      </p>
      <DietaryFields />
      <div className={styles.actions}>
        <Button size="lg" block onClick={onDone}>
          Continuar
        </Button>
      </div>
    </section>
  );
}
