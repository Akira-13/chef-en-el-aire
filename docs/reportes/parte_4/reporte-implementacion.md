# Parte 4 · Evidencia de implementación

**Proyecto:** Chef en el Aire, cocina manos libres

Continúa el [reporte de la parte 3](../parte_3/reporte-implementacion.md). Presenta lo que se agregó después: la **Comunidad asíncrona** (RF-33 a RF-37, RNF-09), el **perfil ampliado** con la emoción inferida (RF-41, RF-42) y los cambios de las demás partes. Sigue el mismo formato: por cada historia ([07](../../07-historias-usuario.md)) se indican los criterios cubiertos, los enlaces al código y a sus pruebas, y las capturas. Los requerimientos están en [05](../../05-requerimientos.md) y su estado en la [matriz de trazabilidad](../../10-matriz-trazabilidad.md).

> **Corte:** 22/11/2026, rama `main` en el commit `93cc61b`.

## 1. Resumen

| Indicador | Parte 3 | Parte 4 |
|---|---|---|
| Pruebas Vitest | 49 archivos, unos 417 casos | **59 archivos, 793 casos** (`shared` 141, `server` 153, `app` 499) |
| `npm run check` | en verde | en verde: formato, tipos, pruebas y build |
| Multiusuario (RF-33 a RF-37, RNF-09) | ❌ sin implementar | ✅ implementado en servidor y cliente; 🟡 RNF-09 medido con dos teléfonos el 22/11/2026 (publicación y comentario visibles en 2 s, límite 5 s); **falta registrar el tiempo del envío de la cola sin conexión (límite 10 s)** |
| Emoción inferida (RF-42) | 🟡 solo declarada | ✅ inferida del uso, con tono del asistente; 🟡 falta la lectura más lenta |
| Nivel y tono editables (RF-41) | 🟡 solo eligiendo otro perfil | ✅ editables en el Perfil |

**Alcance.** Las salas en tiempo real se reemplazaron por la Comunidad, un espacio compartido asíncrono por REST con sondeo y cola sin conexión (ver [alcance](../../06-alcance.md) y la [arquitectura](../../arquitectura/README.md)). El rol de cuidador (RF-32) sigue fuera del MVP.

**Decisiones clave de esta parte.**

- **Una receta publicada es dato no confiable.** Quien la abre la pasa por su propio validador de alérgenos, igual que una receta propia.
- **Privacidad por defecto.** La Comunidad solo recibe el alias. Los motivos de salud viajan únicamente si la persona marca «Mostrar motivos».
- **Lo explícito manda sobre lo aprendido.** La emoción declarada no se pisa con la inferida mientras siga vigente (30 minutos).

---

## 2. Perfil, personalización y Comunidad (cliente)

Código en `app/src/profile/`, `app/src/personalization/` y `app/src/community/`.

✅ implementado · 🟡 parcial · ❌ no implementado.

### E1 · Recetas y despensa

| HU | Req. | Estado | Evidencia |
|---|---|---|---|
| HU-01 Sugerencias | RF-01 | ✅ | [`suggestRecipes`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/personalization/suggest.ts#L62): exactamente 3; nunca relaja los alérgenos; relaja primero el tiempo y luego la dificultad, y lo explica · pruebas CA-01.1 a CA-01.3 en [`index.test.ts`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/personalization/index.test.ts) |
| HU-02 Búsqueda | RF-02 | ✅ | [`searchRecipes`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/personalization/search.ts#L39) sin tildes; [`findSimilarRecipes`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/personalization/search.ts#L84) cuando no hay resultados · CA-02.1 a CA-02.3 |
| HU-03 Despensa | RF-03 | ✅ | [`pantryStatus`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/personalization/pantry.ts#L20) (tengo / falta / sustituir), [`substituteFor`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/personalization/substitutions.ts#L135) («caldo de pollo + maicena» por leche evaporada), [`PantryEditor`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/ProfileSections.tsx#L24); «tengo papa, pollo y ají amarillo» por voz en [`index.test.ts`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/index.test.ts) · CA-03.1 a CA-03.3 |

### E6 · Accesibilidad (ajustes del perfil)

| HU | Req. | Estado | Evidencia |
|---|---|---|---|
| HU-22 Ajustes y configuración inicial | RF-25 | ✅ / 🟡 | [`AccessibilitySettings`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/AccessibilitySettings.tsx#L144): canales, verbosidad, letra, contraste, volumen, tiempo de espera de la voz y gestos; cada cambio se guarda al instante y lo aplican el tema, la voz, los gestos y la salida · CA-22.1 y CA-18.3 (no deja desactivar el último canal) en [`ProfileScreen.test.tsx`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/ProfileScreen.test.tsx) · [`AccessibilitySetup`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/AccessibilitySetup.tsx#L31) en 3 pantallas (CA-22.2) · el onboarding lo monta: nombre (CA-22.3) → alergias y dieta (CA-23.3) → accesibilidad → recorrido |

### E7 · Personalización continua

| HU | Req. | Estado | Evidencia |
|---|---|---|---|
| HU-23 Perfil persistente | RF-28, RNF-17 | ✅ | [`createProfileService`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/index.ts#L41) responde al instante con los perfiles de prueba, carga IndexedDB en paralelo y mide `profile.save` · «conserva los cambios entre dos sesiones» (CA-23.2) y «mide el guardado en menos de 1 s» (RNF-17) en [`index.test.ts`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/index.test.ts) · [`PersonaPicker`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/ProfileScreen.tsx#L22) (tarjetas para los perfiles propios; los 4 de prueba, en el selector «Perfiles de ejemplo») · [`SubstitutionHints`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/personalization/SubstitutionHints.tsx#L22) propone a Rosa, sin pedirlo, sustituir la leche por su esposo (CA-23.1) |
| HU-24 Aprender del uso | RF-29 | ✅ | [`applyUsageEvent`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/learning.ts#L66): lectura saltada 3 veces seguidas → `verbosity: 'breve'` con aviso (CA-24.1); sustituciones aceptadas sin duplicar y rechazadas sin proponer primero (CA-24.2); paso repetido 3 veces o emoción declarada (CA-24.3) · [`learning.test.ts`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/learning.test.ts) |
| HU-25 «Lo que aprendí de ti» | RF-30, RNF-11 | ✅ | [`LearnedSection`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/ProfileSections.tsx#L149) lista cada dato con su origen (CA-25.1) y permite borrarlo sin que vuelva a usarse (CA-25.2); [`DataControls`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/ProfileSections.tsx#L261): **exportar en 1 paso, borrar en 2** (CA-25.3), y exportar métricas · [`learned.ts`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/learned.ts) |
| HU-26 Calificar / cuidador | RF-31, RF-32 | ✅ / ❌ | La valoración queda en el historial (CA-26.1) · [`MyDishes`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/ProfileSections.tsx#L194) · *el rol de cuidador sigue fuera del MVP* |

### E8 · Multiusuario (Comunidad)

| HU | Req. | Estado | Evidencia |
|---|---|---|---|
| HU-27 Publicar mi receta adaptada | RF-33, RF-34 | ✅ | [`PublishRecipeButton`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/community/PublishRecipeButton.tsx#L26): alias, vista previa de lo que se publicará, «Mostrar motivos» desmarcado por defecto y aviso «Revisa que el texto no mencione tu salud» (CA-27.1, CA-27.2); montado en el panel de adaptación · [`toCommunityChanges`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/community/changes.ts#L7) quita los motivos si no hay consentimiento · [`CommunityScreen`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/community/CommunityScreen.tsx): lista accesible, más reciente primero, con plato, alias, fecha y conteos (CA-27.3) |
| HU-28 Cocinar y conversar sobre una receta ajena | RF-35, RF-36, RF-37, RNF-09 | ✅ / 🟡 | «Cocinar esta receta» la abre como adaptada y pasa por `findAllergens` del perfil de quien la abre: con Rosa **bloquea hasta confirmar**, con Javier no (CA-28.1) · [`postSafety`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/community/postSafety.ts) marca cada receta de la lista con «⚠️ Contiene leche (para esposo)» o «✅ Sin alérgenos de tu perfil», con texto y ícono, sin ocultar ninguna; la marca también se lee en voz ([`postSafety.test.ts`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/community/postSafety.test.ts)) · [`safety.test.ts`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/community/safety.test.ts), [`safetyScreen.test.tsx`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/community/safetyScreen.test.tsx) · comentar por texto o por voz · cola sin conexión: [`flushOutbox`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/community/outbox.ts#L75) envía en orden, sin duplicar (conserva el `clientId`) y descarta los rechazos definitivos (CA-28.3) · sondeo y medida `community.visible` en [`useCommunityFeed`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/community/useCommunityFeed.ts#L23) (CA-28.2) · *prueba en dos teléfonos por el túnel (22/11/2026): la publicación y el comentario aparecen en el otro dispositivo en 2 s (CA-28.2, límite 5 s); la cola sin conexión envía sin duplicados (CA-28.3). Falta registrar el tiempo de ese envío contra el límite de 10 s* |
| HU-29 Compartir mi logro y celebrar | RF-37, RF-36 | ✅ / 🟡 | [`ShareAchievementButton`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/community/ShareAchievementButton.tsx#L21) publica plato, valoración y alias, sin datos de salud (CA-29.1) · aplauso por toque, voz o pulgar arriba, una sola vez por publicación; al entrar, [`newApplause`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/community/applause.ts) avisa de los aplausos nuevos en lo que publicaste, una sola vez y sin contar el propio (CA-29.2); en teléfono, un segundo aplauso de la misma persona no suma · *el botón todavía no está montado en la pantalla de celebración, así que hoy solo se prueba como componente* |

### E9 · Diseño emocional

| HU | Req. | Estado | Evidencia |
|---|---|---|---|
| HU-33 Tono del asistente | RF-41, RF-42 | ✅ / 🟡 | Nivel de habilidad y tono editables en [`AssistantSettings`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/ProfileSections.tsx#L110); las sugerencias respetan el nivel (CA-33.1) · emoción inferida en `applyUsageEvent`: **3 repeticiones del mismo paso o 2 órdenes no entendidas en menos de 60 s** → `confused`, con aviso «Parece que este paso cuesta. Iré más despacio.» · [`currentFeeling`](https://github.com/Akira-13/chef-en-el-aire/blob/main/app/src/profile/feeling.ts#L10): una emoción vale 30 minutos y la declarada no se pisa (CA-33.2) · el asistente ya usa la emoción reciente · *falta que la lectura en voz se haga más lenta con ella* |

### Cobertura de criterios con pruebas

| Historia | Criterios con prueba |
|---|---|
| HU-01 | CA-01.1, CA-01.2, CA-01.3 |
| HU-02 | CA-02.1, CA-02.2, CA-02.3 |
| HU-03 | CA-03.1, CA-03.2, CA-03.3 |
| HU-22 | CA-22.1, CA-22.2, CA-18.3 |
| HU-23 | CA-23.1, CA-23.2 |
| HU-24 | CA-24.1, CA-24.2, CA-24.3 |
| HU-25 | CA-25.1, CA-25.2, CA-25.3 |
| HU-26 | CA-26.1 (CA-26.2 fuera del MVP) |
| HU-27 | CA-27.1, CA-27.2, CA-27.3 |
| HU-28 | CA-28.1, CA-28.2, CA-28.3 (con medida real en teléfono; falta el tiempo de la cola) |
| HU-29 | CA-29.1, CA-29.2 |
| HU-33 | CA-33.1, CA-33.2 |

### Ampliaciones a los tipos comunes

Todas son opcionales, tienen su forma en `shared/src/data/raw.ts` y sus conversores en `mappers.ts`, y la prueba de ida y vuelta sigue pasando:

- `Profile.community.alias`: alias público en la Comunidad.
- `DeclaredFeeling.source` y `.at`: si la emoción se declaró o se infirió, y cuándo.
- `learned.origins`: origen de cada dato aprendido.
- `learned.difficultSteps`: pasos que costaron.
- `emotional.lastFeeling`: última emoción vigente.

### Pendiente de esta sección

| Pendiente | Requerimientos | Siguiente paso |
|---|---|---|
| Registrar el tiempo del envío de la cola sin conexión (≤ 10 s) | RNF-09, CA-28.3 | Repetir la prueba D por el túnel y exportar `community.queueFlush` (CA-28.2 ya se midió: 2 s) |
| Montar «Compartir mi logro» en la celebración | RF-37, CA-29.1 | Lo monta la parte de la interfaz |

| Probar con usuarios | CU-08, CU-13 a CU-16 | Sesiones de usabilidad |

<!--
Capturas por tomar con el teléfono y guardar en docs/reportes/parte_4/capturas/ (descomentar al agregarlas):

![](capturas/hu-27-vista-previa.png)
![](capturas/hu-27-comunidad.png)
![](capturas/hu-28-bloqueo-comunidad.png)
![](capturas/hu-28-pendiente.png)
![](capturas/hu-29-compartir-logro.png)
![](capturas/hu-25-aprendi-inferida.png)
![](capturas/hu-33-nivel-tono.png)
![](capturas/hu-25-exportar-borrar.png)
-->

---

## 3. Interfaz, porciones, rutas, PWA y auditorías

*Sección de la parte de la interfaz.*

Estado en `main` al corte:

- ✅ Ruta `/comunidad` en `App.tsx`.
- ✅ Comando de voz «para N porciones» (`setServings`) y prop `servings` en el panel de adaptación, que se envía a `/adapt` (CA-04.2).
- ❌ Selector de porciones en la pantalla Receta (RF-05).
- ❌ `ShareAchievementButton` en la celebración.
- ✅ `AccessibilitySetup` montado en el onboarding (nombre → alergias y dieta → accesibilidad → recorrido).
- ❌ Auditorías: Lighthouse, WCAG 2.1 AA y navegadores (`auditorias.md`).

## 4. Entrada, salida y modo prueba

*Sección de la parte de voz y gestos.*

Estado en `main` al corte:

- ✅ Comandos de la Comunidad y de porciones, y pantalla `community` en el contrato.
- ❌ Modo prueba de voz y de gestos (RNF-04, RNF-05).
- ❌ Resumen de métricas contra umbrales (CA-37.1).
- ❌ Lectura más lenta con emoción reciente (RF-42).

## 5. Servidor de la Comunidad, asistente y arquitectura

*Sección de la parte del servidor.*

Estado en `main` al corte:

- ✅ API REST de la Comunidad, con almacén y validación en el servidor.
- ✅ `PublishRecipeButton` montado en el panel de adaptación.
- ✅ El asistente usa la emoción inferida reciente.
- ✅ Arquitectura C4 con la Comunidad: [arquitectura-c4.md](arquitectura-c4.md).
- ✅ Medición de latencia del asistente con umbrales por proveedor (22/11/2026):

| Proveedor | Ruta | Pedidos | Fallas | p50 | p90 | Umbral | Resultado |
|---|---|---|---|---|---|---|---|
| Remoto | `ask` | 20 | 0 | 1,8 s | 2,3 s | 8 s | ✅ |
| Remoto | `adapt` | 5 | 0 | 4,6 s | 5,0 s | 8 s | ✅ |
| Ollama | `ask` | 20 | 9 | 6,4 s | 7,3 s | 15 s | ✅ |
| Ollama | `adapt` | 5 | 5 | — | — | 15 s | ❌ |

## 6. Pruebas de usabilidad

*La consolida la parte de entrada y salida en `docs/12-informe-usabilidad.md`, todavía por escribir.*
