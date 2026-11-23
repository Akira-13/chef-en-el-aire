# 11 · Protocolo de pruebas de usabilidad

**Proyecto:** Chef en el Aire, cocina manos libres
**Responsable:** Jarem Villalobos
**Versión:** 1.0 (22/11/2026), para revisión del equipo el 23/11 y del docente
**Criterios que mide:** [CU-01 a CU-16](08-criterios-usabilidad.md) · **Requerimientos:** [RNF](05-requerimientos.md) · **Historias:** HU-13 a HU-17, HU-28, HU-33 y HU-37

> **Pendiente antes de la primera sesión.** La sección 3 trata datos de personas. Debe revisarla el docente para confirmar que cumple la Ley 29733 (Protección de Datos Personales). Sin esa revisión no se hacen sesiones con participantes externos.

---

## 1. Objetivos

1. Medir los 16 criterios de usabilidad (CU-01 a CU-16) contra sus umbrales, con datos de personas reales y no solo con pruebas automáticas.
2. Medir la **tasa de aciertos de voz** (RNF-04) y de **gestos** (RNF-05) con los modos prueba de la app, que no se pueden medir de otra forma.
3. Obtener las latencias y los cuadros por segundo en un teléfono real (RNF-01, RNF-02, RNF-03, RNF-15, RNF-17, RNF-18) con el resumen de métricas.
4. Comprobar que cada grupo de usuarios con una necesidad específica (S04 a S07) puede terminar una receta por su canal principal (CU-11).
5. Con todo lo anterior, completar la matriz de trazabilidad con «Cumple» o «No cumple» y el valor medido, y escribir el informe final (`docs/12-informe-usabilidad.md`).

## 2. Participantes

- **Mínimo 8 participantes**, con códigos **P01 a P08**. Cada integrante del equipo recluta y facilita **2** (sección 9).
- **Al menos uno por grupo** de los que describe `docs/01-stakeholders.md`:

| Grupo | Quién es | Canal principal que se prueba |
|---|---|---|
| S04 | Discapacidad motriz (artritis, temblor, movilidad reducida de brazos) | Voz |
| S05 | Discapacidad visual (baja visión) | Audio |
| S06 | Discapacidad auditiva | Pantalla y alertas visuales |
| S07 | Discapacidad del habla | Gestos |
| S08 | Adulto mayor | Cualquiera |
| General | Persona sin necesidades especiales | Cualquiera |

- **Si no se consigue a alguien de un grupo**, se **simula con restricción de canal** y se anota en el informe que fue simulación: S04 con las manos ocupadas (sin tocar), S05 con la pantalla tapada, S06 con el volumen en silencio y S07 sin hablar. La simulación no reemplaza a una persona real en las conclusiones.
- **Perfil de la app:** cada participante usa un perfil de `datos/perfiles.json` según su grupo (Rosa USR-001, Diego USR-002, Carmen USR-003 y Javier USR-004) o el que se ajuste en la bienvenida.
- **Criterios de inclusión:** mayor de 18 años, que acepte el consentimiento y que pueda cocinar una receta sencilla o simularla.

## 3. Consentimiento informado y anonimización

Sujeto a la revisión del docente (Ley 29733).

### 3.1 Consentimiento

Antes de empezar, el facilitador lee en voz alta y entrega por escrito:

> Estoy probando una aplicación de cocina que se maneja con la voz, gestos o toques. No estoy evaluando a la persona sino a la aplicación. Puedes pararte y terminar cuando quieras, sin dar razones. Voy a anotar cuánto tardas, qué te cuesta y lo que digas de la aplicación. El teléfono guardará cuántos comandos reconoció y cuánto tardó, pero **no guarda audio ni video**. Solo se grabará una sesión si lo aceptas por escrito. Tu nombre no aparecerá en ningún resultado: usaré un código, por ejemplo P03.

El participante firma una hoja que dice: participa voluntariamente, entiende que puede retirarse, autoriza el uso anónimo de sus resultados, y marca si **autoriza o no** la grabación de audio o video.

### 3.2 Anonimización

- Todo dato y archivo lleva solo el **código P01 a P08**. No se escriben nombres, DNI, teléfonos, correos ni direcciones en cuestionarios, notas, nombres de archivo, capturas ni en el informe.
- La hoja firmada y la lista código-persona (si se lleva) las guarda **una sola persona del equipo, fuera del repositorio**, y se destruye la lista al entregar el informe.
- **Grabación solo con consentimiento escrito.** Sin él, no se graba nada. Una grabación autorizada se guarda fuera del repositorio y se borra al terminar el análisis.
- Los datos de salud (alérgenos, condiciones) se usan solo para configurar el perfil de la prueba y no se anotan en el informe más allá de «grupo S0x».
- Los archivos que se suben a Drive o al repositorio son solo los JSON de métricas y de los modos prueba, que no contienen datos personales.
- Los menores no participan.

## 4. Materiales

- **Dos teléfonos Android con Chrome** (uno es el del participante; el segundo se usa solo en CU-13) y la app abierta por el túnel de pruebas.
- **Audio de ruido de cocina grabado:** licuadora y extractor, reproducido por un parlante. Se **mide con una app de sonómetro** en el teléfono, colocado donde estaría la persona, y se anota el valor en dB:
  - **Ruido bajo:** ≤ 60 dB (cocina en calma).
  - **Ruido alto:** entre 70 y 80 dB (licuadora o extractor).
- **Luz:** normal y tenue (CU-10), medida o descrita («luz de techo» y «solo luz de la hornilla»).
- **Cronómetro** (un segundo teléfono o reloj) y la **hoja de observación** (tabla de la sección 5).
- **Receta de 10 pasos** acordada para todas las sesiones, elegida de `datos/recetas.json`, y un temporizador de 1 minuto (CU-12).
- **Regla o cinta** para marcar los **2 m** de distancia de lectura (CU-10).
- **Cuestionarios impresos o en pantalla:** SUS, NASA-TLX simplificado y experiencia emocional (sección 6).
- Conexión a internet estable. **El reconocimiento de voz de Chrome necesita red**, así que se anota el tipo de red y cualquier corte.

## 5. Guion por tarea (CU-01 a CU-16)

El facilitador usa siempre las mismas palabras, no ayuda salvo que el participante lo pida o se bloquee más de 60 s (en ese caso se anota «con ayuda» y cuenta como no completado sin ayuda).

| CU | Qué se mide | Qué se le dice al participante | Cómo se registra | Umbral | Facilita |
|---|---|---|---|---|---|
| **CU-01** Eficacia | Porcentaje que completa una receta de 10 pasos sin ayuda externa | «Cocina esta receta con la app, como lo harías en casa. Usa el canal que prefieras.» | Observador marca «completó» o «con ayuda» | ≥ 90 % | Amir |
| **CU-02** Voz | Del fin de la frase al cambio de paso | «Di "chef, siguiente" para avanzar y "chef, anterior" para volver.» (15 veces) | `voice.commandToRender` (resumen de métricas, p95) | ≤ 1,5 s | Jarem |
| **CU-03** Gestos | Del gesto a la acción y cuadros/s | «Desliza la mano a tu izquierda para avanzar y a tu derecha para volver.» (15 veces) | `gesture.toAction` y `gesture.fps` | ≤ 300 ms; ≥ 15 fps | Jarem |
| **CU-04** Asistente | Tiempo hasta «pensando…» y hasta la respuesta | «Pregunta al asistente cómo reemplazar un ingrediente.» (5 preguntas) | `llm.thinking` y `llm.response` | ≤ 1 s; ≤ 8 s remoto, ≤ 15 s local (p90) | Akira |
| **CU-05** Voz (error) | Comandos mal interpretados | Abre `?prueba=voz` en el Inicio. «Di lo que aparezca en pantalla.» (20 pedidos, una vez con ruido bajo y otra con ruido alto) | JSON `P0n-prueba-voz.json` | Aciertos ≥ 90 % (≤ 60 dB) y ≥ 80 % (70 a 80 dB) | Jarem |
| **CU-06** Gestos (error) | Aciertos de los 4 gestos y falsos positivos | Abre `?prueba=gestos` en el Inicio. «Haz el gesto que aparece.» (10 por gesto) y luego «cocina 5 minutos con normalidad» con un acompañante | JSON `P0n-prueba-gestos.json` | ≥ 90 %; ≤ 1 falso positivo cada 5 min | Jarem |
| **CU-07** Seguridad | Alérgenos declarados no detectados | Prueba automática: 10 recetas × 4 perfiles | Resultado de la prueba del validador | 0 omitidos | Akira |
| **CU-08** Aprendizaje | Tiempo de onboarding hasta usar bien los comandos básicos | «Abre la app por primera vez y sigue el recorrido de bienvenida.» | Cronómetro desde que abre la bienvenida hasta que hace bien «siguiente» por voz y por gesto | ≤ 2 min | Aarón |
| **CU-09** Recuperación | Porcentaje que se recupera en ≤ 2 intentos y tiempo para cambiar de canal | Se provoca un fallo (tapar la cámara o quitar la red) y se pide continuar la receta | Intentos y cronómetro; `channel.fallback` | ≥ 90 %; ≤ 3 s | Akira |
| **CU-10** Legibilidad | Lee el paso sin error a 2 m | «Desde la marca, lee en voz alta el paso que ves.» Con luz normal y con luz tenue | Observador marca aciertos | 100 % | Amir |
| **CU-11** Por grupo | Éxito al completar la receta por el canal principal de cada grupo | Misma tarea que CU-01, pero solo con el canal de su grupo (sección 2) | «Completó» o «no completó» por grupo | ≥ 90 % por grupo | Amir |
| **CU-12** Alerta | Tiempo hasta notar la alerta del temporizador | «Inicia un temporizador de 1 minuto y sigue cocinando. Avísame cuando notes la alerta.» | Cronómetro desde que vence hasta que lo dice | ≤ 3 s y 100 % la nota | Amir |
| **CU-13** Comunidad | Publica y comenta sin ayuda; retraso hasta ver el comentario en otro dispositivo | Con **2 teléfonos**: «Publica la receta adaptada. En el otro teléfono comenta la publicación.» | Observador marca «sin ayuda»; `community.visible` en el otro teléfono (p95) | ≥ 90 %; ≤ 5 s | Aarón |
| **CU-14** Carga cognitiva | NASA-TLX simplificado | Cuestionario al terminar la receta | Promedio de las 6 escalas | ≤ 40 / 100 | Aarón |
| **CU-15** Satisfacción | SUS | Cuestionario al terminar | Puntaje SUS | ≥ 75 | Aarón |
| **CU-16** Emoción | Experiencia emocional | Cuestionario después de la celebración | Promedio de 5 ítems | ≥ 4 de 5 | Aarón |

**Orden recomendado de una sesión (≈ 45 min):** consentimiento → bienvenida (CU-08) → receta completa (CU-01 y CU-11, con CU-12 y CU-10 dentro) → modos prueba CU-05 y CU-06 (los facilita Jarem) → comunidad (CU-13) → cuestionarios (CU-14 a CU-16) → exportar archivos (sección 7).

**Nota sobre CU-13.** Los umbrales de RNF-09 y CU-13 se propusieron el 16/11/2026 y están por validar. Tras las sesiones, Jarem confirma si se mantienen.

## 6. Cuestionarios

### 6.1 SUS (CU-15)

Escala de 1 («totalmente en desacuerdo») a 5 («totalmente de acuerdo»).

1. Creo que me gustaría usar esta aplicación con frecuencia.
2. Encontré la aplicación innecesariamente compleja.
3. Pensé que la aplicación era fácil de usar.
4. Creo que necesitaría el apoyo de una persona con conocimientos técnicos para usarla.
5. Encontré que las diversas funciones de la aplicación estaban bien integradas.
6. Pensé que había demasiada inconsistencia en la aplicación.
7. Imagino que la mayoría de las personas aprendería a usar la aplicación muy rápido.
8. Encontré la aplicación muy incómoda de usar.
9. Me sentí muy seguro al usar la aplicación.
10. Necesité aprender muchas cosas antes de poder usar la aplicación.

**Puntaje:** en los ítems impares se resta 1 a la respuesta; en los pares se calcula 5 menos la respuesta; se suman los 10 valores y se multiplica por 2,5. Resultado de 0 a 100. **Umbral: ≥ 75.**

### 6.2 NASA-TLX simplificado (CU-14)

Seis escalas de **0 a 100** (de 5 en 5), marcadas por el participante al terminar la receta:

| Escala | Pregunta |
|---|---|
| Exigencia mental | ¿Cuánto tuviste que pensar o recordar? (0 muy poco, 100 muchísimo) |
| Exigencia física | ¿Cuánto esfuerzo físico te costó usarla? (0 muy poco, 100 muchísimo) |
| Exigencia de tiempo | ¿Qué tan apurado te sentiste? (0 nada, 100 muchísimo) |
| Desempeño | ¿Qué tan bien lograste lo que querías? (0 perfecto, 100 fracaso) |
| Esfuerzo | ¿Cuánto tuviste que esforzarte para lograrlo? (0 muy poco, 100 muchísimo) |
| Frustración | ¿Qué tan inseguro, molesto o estresado te sentiste? (0 nada, 100 muchísimo) |

**Puntaje:** promedio simple de las 6 escalas. **Umbral: ≤ 40.**

### 6.3 Experiencia emocional (CU-16)

Escala de 1 a 5, al terminar la celebración. Cinco ítems:

1. **Acompañamiento:** sentí que la aplicación me acompañaba mientras cocinaba.
2. **Tono:** el tono con el que me habló fue adecuado para mí.
3. **Celebración:** la celebración al terminar me pareció agradable.
4. **Ambientación:** la ambientación (música o sonidos) fue apropiada.
5. **Confianza:** me sentí tranquilo y con confianza al cocinar con ella.

**Puntaje:** promedio de los 5 ítems. **Umbral: ≥ 4.**

## 7. Cómo exportar los datos

Todos los archivos se nombran con el **código del participante** y se guardan en una carpeta compartida del equipo, fuera del repositorio.

| Archivo | Cómo se obtiene |
|---|---|
| `P0n-metricas.json` | En la app: **Perfil → «Exportar métricas»**. Se descarga como `metricas-chef-en-el-aire.json`; hay que renombrarlo |
| `P0n-prueba-voz.json` | Con `?prueba=voz` (en el Inicio): al terminar, botón **Exportar**, con el código del participante escrito |
| `P0n-prueba-gestos.json` | Con `?prueba=gestos` (en el Inicio): botón **Exportar**, con el código del participante escrito |
| `P0n-resumen-metricas.json` y `.md` | Con `?prueba=metricas`: **Exportar resumen** (JSON y Markdown), con el código del participante escrito |
| Hoja de observación y cuestionarios | Foto o archivo con el código, sin nombres |

**Reglas de uso de los modos prueba**
- **Se abren sobre el Inicio.** Mientras están activos, los comandos de voz o gesto no cambian la pantalla de fondo. Solo «¿cuánto falta?» hace que la app diga que no hay temporizadores.
- **Conexión.** La voz necesita internet; la cámara, permiso y buena luz.
- **Código del participante.** Se escribe como `P01` en el panel. Cualquier otro texto se descarta, para que no llegue un nombre al archivo.
- **No se guarda audio ni video:** solo el comando reconocido y el resultado.
- **Antes de cada sesión,** abrir `?prueba=metricas` y usar **Borrar muestras** (pide confirmar), para que las métricas no se mezclen con las del participante anterior. Exportar antes de borrar.

## 8. Análisis (01/12)

1. Reunir los JSON de los 8 participantes.
2. Pasar las muestras de métricas por el resumen (`summarizeMetrics`) y pegar la tabla en `docs/12-informe-usabilidad.md`.
3. Calcular los resultados de SUS, NASA-TLX y experiencia emocional por participante y el promedio.
4. Poner en `docs/10-matriz-trazabilidad.md` «Cumple» o «No cumple» con el valor medido para cada RNF y CU (CA-37.2).
5. Anotar las simulaciones, los problemas de red y las ayudas dadas.

## 9. Quién facilita cada sesión

| Integrante | Recluta y facilita | Criterios a su cargo |
|---|---|---|
| Amir Canto | 2 personas: motriz (o simulación) y general | CU-01, CU-10, CU-11, CU-12 |
| Jarem Villalobos | 2 personas: habla o auditiva (o simulación) y general | CU-02, CU-03, CU-05, CU-06 |
| Diego García (Akira) | 2 personas: visual (o simulación con TalkBack) y general | CU-04, CU-07, CU-09 |
| Aarón Alberca | 2 personas: novato y adulto mayor | CU-08, CU-13 (2 teléfonos), CU-14, CU-15, CU-16 |

Cada sesión tiene **un facilitador** (habla con la persona) y **un observador** con cronómetro (anota). Nadie facilita y observa a la vez.

## 10. Calendario

| Fecha | Actividad |
|---|---|
| Dom 22/11 | Este protocolo, versión 1.0 |
| Lun 23/11 | Revisión del equipo; el docente revisa el consentimiento (Ley 29733) |
| Mar 24/11 | Congelamiento de funciones |
| Mié 25/11 | Piloto con 1 participante y ajustes al protocolo |
| Jue 26/11 a lun 30/11 | Sesiones con los 8 participantes |
| Mar 01/12 | Análisis, informe `docs/12-informe-usabilidad.md` y matriz final |
