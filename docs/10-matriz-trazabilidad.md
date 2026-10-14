# 10 · Matriz de trazabilidad

**Proyecto:** Chef en el Aire, cocina manos libres  
**Responsable:** Jarem Villalobos

## 1. Resumen de cobertura

| Indicador | Valor |
|---|---|
| Requerimientos en total | 62 (44 FR y 18 NFR) |
| Historias de usuario | 37 (HU-01 a HU-37) |
| Requerimientos con al menos una historia | 62 de 62 |
| NFR con un criterio de aceptación que repite su métrica | 18 de 18 |
| NFR medidos también por un criterio de usabilidad | 13 de 18 |
| Especificado | 61 |
| Especificado · fuera del MVP | 1 (RF-32) |
| Sin cobertura | 0 |

## 3. Matriz

| ID Req | Descripción | Tipo (FR/NFR) | Prioridad | ID HU | Estado | Evidencia/Criterio de Aceptación |
|---|---|---|---|---|---|---|
| RF-01 | Sugerir 3 recetas filtradas por perfil, despensa, tiempo y nivel | FR | Alta | HU-01 | Especificado | CA-01.1, CA-01.2, CA-01.3 |
| RF-02 | Buscar recetas por nombre o ingrediente, por voz y texto | FR | Media | HU-02 | Especificado | CA-02.1, CA-02.2, CA-02.3 |
| RF-03 | Registrar despensa y marcar ingredientes tengo / falta / sustituir | FR | Media | HU-03 | Especificado | CA-03.1, CA-03.2, CA-03.3 |
| RF-04 | Recetas en JSON estructurado; 10 recetas de ejemplo | FR | Alta | HU-04 | Especificado | CA-04.3 · datos/recetas.json |
| RF-05 | Adaptar receta con LLM por alergias, despensa, porciones y nivel | FR | Alta | HU-04 | Especificado | CA-04.1, CA-04.2 |
| RF-06 | Vista antes / después con cambios y motivo; original conservada | FR | Alta | HU-05 | Especificado | CA-05.1, CA-05.2 |
| RF-07 | Validación local de alérgenos con bloqueo y confirmación explícita | FR | Alta | HU-06 | Especificado | CA-06.1, CA-06.2 |
| RF-08 | Preguntas libres al asistente con contexto del paso | FR | Alta | HU-07 | Especificado | CA-07.1, CA-07.3 |
| RF-09 | Capa de abstracción del LLM con adaptadores por proveedor | FR | Alta | HU-08 | Especificado | CA-08.1 |
| RF-10 | Proveedor alterno o receta sin adaptar si el LLM falla | FR | Media | HU-08, HU-35 | Especificado | CA-08.3, CA-35.2 |
| RF-11 | Modo cocina: un paso a la vez en tipografía grande | FR | Alta | HU-09 | Especificado | CA-09.1 |
| RF-12 | Avanzar, retroceder, repetir y pausar por voz, gesto y táctil | FR | Alta | HU-12, HU-13, HU-15 | Especificado | CA-12.1, CA-12.2, CA-13.1, CA-15.1 |
| RF-13 | Explicación ampliada y señal de "cuándo está listo" por paso | FR | Alta | HU-10 | Especificado | CA-10.1, CA-10.2 |
| RF-14 | Ayuda contextual con gestos y comandos disponibles | FR | Alta | HU-12, HU-36 | Especificado | CA-12.3, CA-36.1 |
| RF-15 | Lectura en voz alta configurable (activada, desactivada, breve, detallada) | FR | Alta | HU-13, HU-19 | Especificado | CA-13.3, CA-19.1 |
| RF-16 | Varios temporizadores con nombre y consulta "¿cuánto falta?" | FR | Alta | HU-11 | Especificado | CA-11.1, CA-11.2 |
| RF-17 | Alerta de temporizador visual, sonora y persistente | FR | Alta | HU-20 | Especificado | CA-20.1 |
| RF-18 | Comandos de voz esenciales con palabra de activación | FR | Alta | HU-13 | Especificado | CA-13.1, CA-13.2 |
| RF-19 | Pedir repetir si no entiende; tras 2 fallos sugerir otro canal | FR | Media | HU-14 | Especificado | CA-14.1, CA-14.2 |
| RF-20 | Control por gestos con MediaPipe (deslizar, palma, pulgar) | FR | Alta | HU-15 | Especificado | CA-15.1 |
| RF-21 | Confirmación de gesto e indicador y control de cámara | FR | Alta | HU-16 | Especificado | CA-16.1, CA-16.2 |
| RF-22 | Gesto de activación y bloqueo de gestos contra terceros | FR | Media | HU-17 | Especificado | CA-17.1, CA-17.2 |
| RF-23 | Sensibilidad de gestos configurable y aviso si no ve la mano | FR | Media | HU-18 | Especificado | CA-18.1, CA-18.2 |
| RF-24 | Cada acción esencial por al menos dos canales | FR | Alta | HU-18, HU-21 | Especificado | CA-18.3, CA-21.1 |
| RF-25 | Perfil de accesibilidad (canal, verbosidad, fuente, contraste, volumen, espera) | FR | Alta | HU-21, HU-22 | Especificado | CA-21.2, CA-22.1, CA-22.2 |
| RF-26 | Equivalente visual de toda respuesta hablada y sonido | FR | Alta | HU-20 | Especificado | CA-20.2, CA-20.3 |
| RF-27 | Estado accesible por audio y lector de pantalla (ARIA) | FR | Alta | HU-19 | Especificado | CA-19.1, CA-19.2 |
| RF-28 | Perfil persistente de restricciones, gustos, nivel y preferencias | FR | Alta | HU-23 | Especificado | CA-23.1 |
| RF-29 | Perfil que se actualiza con el uso | FR | Alta | HU-24 | Especificado | CA-24.1, CA-24.2, CA-24.3 |
| RF-30 | Pantalla "lo que aprendí de ti" para ver, corregir y borrar | FR | Alta | HU-25 | Especificado | CA-25.1, CA-25.2 |
| RF-31 | Calificar la receta por gesto o voz | FR | Media | HU-26 | Especificado | CA-26.1 |
| RF-32 | Cuidador configura el perfil de otra persona | FR | Baja | HU-26 | Especificado · fuera del MVP | CA-26.2 |
| RF-33 | Crear sala con código corto y unirse | FR | Alta | HU-27 | Especificado | CA-27.1, CA-27.2 |
| RF-34 | Modo de sala "juntos" o "a mi ritmo" | FR | Alta | HU-27 | Especificado | CA-27.3 |
| RF-35 | Ver el paso de cada participante (avatares) | FR | Alta | HU-28 | Especificado | CA-28.1 |
| RF-36 | Resincronizar tras desconexión | FR | Media | HU-28 | Especificado | CA-28.3 |
| RF-37 | Compartir receta adaptada y logro con la sala | FR | Media | HU-29 | Especificado | CA-29.1, CA-29.2 |
| RF-38 | Nivel visceral: ambientación atractiva, también en alto contraste | FR | Alta | HU-30 | Especificado | CA-30.1, CA-30.2 |
| RF-39 | Nivel conductual: microinteracciones en toda acción | FR | Alta | HU-31 | Especificado | CA-31.1, CA-31.2 |
| RF-40 | Nivel reflexivo: celebración final e historial de platos | FR | Alta | HU-32 | Especificado | CA-32.1 |
| RF-41 | Tono del asistente adaptado al nivel | FR | Alta | HU-33 | Especificado | CA-33.1 |
| RF-42 | Retroalimentación afectiva: ajustar tono y ritmo a la emoción | FR | Media | HU-33 | Especificado | CA-33.2 |
| RF-43 | PWA instalable en laptop y móvil | FR | Alta | HU-34 | Especificado | CA-34.1 |
| RF-44 | Receta, temporizadores y perfil sin conexión | FR | Alta | HU-34, HU-35 | Especificado | CA-34.2, CA-35.2 |
| RNF-01 | Latencia de voz ≤ 1,5 s (p95) | NFR | Alta | HU-13, HU-37 | Especificado | CA-13.4 · medido en CU-02 |
| RNF-02 | Gesto ≤ 300 ms y ≥ 15 cuadros/s | NFR | Alta | HU-15, HU-37 | Especificado | CA-15.2 · medido en CU-03 |
| RNF-03 | "Pensando…" ≤ 1 s; respuesta ≤ 8 s remoto / ≤ 15 s local (p90) | NFR | Alta | HU-07, HU-37 | Especificado | CA-07.2 · medido en CU-04 |
| RNF-04 | Voz ≥ 90 % aciertos (≤ 60 dB) y ≥ 80 % (70–80 dB) | NFR | Alta | HU-13, HU-37 | Especificado | CA-13.5 · medido en CU-05 |
| RNF-05 | Gestos ≥ 90 % aciertos; ≤ 1 falso positivo / 5 min | NFR | Alta | HU-15, HU-37 | Especificado | CA-15.3 · medido en CU-06 |
| RNF-06 | 100 % detección de alérgenos (10 recetas × 4 perfiles) | NFR | Alta | HU-06, HU-37 | Especificado | CA-06.3 · medido en CU-07 |
| RNF-07 | Texto ≥ 32 px; contraste ≥ 4,5:1 y ≥ 7:1 en alto contraste | NFR | Alta | HU-09 | Especificado | CA-09.2 · medido en CU-10 |
| RNF-08 | WCAG 2.1 AA; táctil ≥ 44 px; teclado | NFR | Alta | HU-19 | Especificado | CA-19.3 · medido en CU-11 |
| RNF-09 | Sala: cambio ≤ 1 s (p95); resincronía ≤ 5 s; hasta 4 personas | NFR | Alta | HU-28, HU-37 | Especificado | CA-28.2, CA-28.3 · medido en CU-13 |
| RNF-10 | Lighthouse instalable; carga ≤ 3 s en 4G; offline | NFR | Alta | HU-34 | Especificado | CA-34.3 |
| RNF-11 | Gestos 100 % locales; permisos explícitos; exportar/borrar ≤ 2 pasos | NFR | Alta | HU-16, HU-25 | Especificado | CA-16.3, CA-25.3 |
| RNF-12 | Onboarding ≤ 2 min; ≥ 90 % completa sin ayuda | NFR | Alta | HU-36 | Especificado | CA-36.1, CA-36.2 · medido en CU-01, CU-08, CU-14, CU-15 |
| RNF-13 | Chrome, Edge, Safari (2 últimas); desde 360 px | NFR | Alta | HU-34 | Especificado | CA-34.4 |
| RNF-14 | Nuevo proveedor LLM = 1 adaptador, 0 cambios de UI | NFR | Alta | HU-08 | Especificado | CA-08.2 |
| RNF-15 | Canal alterno ≤ 3 s con aviso; receta sigue offline | NFR | Alta | HU-21, HU-35 | Especificado | CA-21.3, CA-35.1, CA-35.2 · medido en CU-09 |
| RNF-16 | Experiencia emocional ≥ 4/5; celebración ≤ 5 s y saltable | NFR | Media | HU-32 | Especificado | CA-32.2, CA-32.3 · medido en CU-16 |
| RNF-17 | Perfil 100 % persistente; guardado ≤ 1 s | NFR | Alta | HU-23 | Especificado | CA-23.2 |
| RNF-18 | Temporizador ±1 s en 30 min; alerta ≤ 1 s, también en segundo plano | NFR | Alta | HU-11, HU-37 | Especificado | CA-11.3 · medido en CU-12 |

