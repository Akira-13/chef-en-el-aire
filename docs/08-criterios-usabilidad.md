# 08 · Criterios de usabilidad medibles

**Responsable:** Jarem Villalobos


## Criterios

| ID | Criterio | Métrica | Umbral | Método | Requerimientos |
|---|---|---|---|---|---|
| CU-01 | Eficacia | Porcentaje de participantes que completa una receta de 10 pasos sin ayuda externa | ≥ 90 % | Prueba con tarea guiada | RNF-12, RF-11, RF-12 |
| CU-02 | Eficiencia por voz | Tiempo desde el fin de la frase hasta el cambio de paso | ≤ 1,5 s (p95) | Cronómetro o registro de eventos | RNF-01, RF-18 |
| CU-03 | Eficiencia por gestos | Tiempo del gesto a la acción y cuadros por segundo | ≤ 300 ms; ≥ 15 cuadros/s | Registro de eventos | RNF-02, RF-20 |
| CU-04 | Latencia del asistente | Tiempo hasta el indicador "pensando…" y hasta la respuesta completa | ≤ 1 s; ≤ 8 s remoto, ≤ 15 s local (p90) | Registro de eventos | RNF-03, RF-08 |
| CU-05 | Tasa de error de voz | Porcentaje de comandos mal interpretados | ≤ 10 % con ruido ≤ 60 dB; ≤ 20 % a 70–80 dB | Lista de 20 comandos por participante, con ruido de cocina grabado | RNF-04, RF-19 |
| CU-06 | Tasa de error de gestos | Aciertos de los 4 gestos básicos y falsos positivos | ≥ 90 %; ≤ 1 cada 5 min | 10 repeticiones por gesto y 5 min de cocina con acompañante | RNF-05, RF-20, RF-22 |
| CU-07 | Errores críticos de seguridad | Alérgenos declarados no detectados | 0 | Conjunto de prueba: 10 recetas × 4 perfiles | RNF-06, RF-07 |
| CU-08 | Aprendizaje | Tiempo de onboarding hasta ejecutar correctamente los gestos y comandos básicos | ≤ 2 min | Observación con cronómetro | RNF-12, RF-14 |
| CU-09 | Recuperación ante errores | Porcentaje que se recupera en ≤ 2 intentos y tiempo para cambiar de canal | ≥ 90 %; ≤ 3 s | Prueba con fallo inducido (voz o cámara) | RNF-15, RF-19, RF-24 |
| CU-10 | Legibilidad | Porcentaje de participantes que lee el paso sin error a 2 m | 100 % | Prueba de lectura a 2 m, con luz normal y tenue | RNF-07, RF-11 |
| CU-11 | Accesibilidad por grupo | Porcentaje de éxito al completar una receta por el canal principal de cada grupo (S04 voz, S05 audio, S06 visual, S07 gestos) | ≥ 90 % por grupo | Prueba con al menos 1 persona por grupo, o simulación con restricción de canal | RNF-08, RF-24 a RF-27 |
| CU-12 | Alerta del temporizador | Tiempo hasta que el participante nota la alerta | ≤ 3 s; 100 % la nota (incluido S06) | Observación con temporizador de 1 min | RNF-18, RF-17, RF-26 |
| CU-13 | Sincronización percibida | Porcentaje que identifica en qué paso va el otro participante sin preguntar; retraso del cambio de paso | ≥ 90 %; ≤ 1 s | Prueba con 2 dispositivos | RNF-09, RF-35 |
| CU-14 | Carga cognitiva | NASA-TLX (versión simplificada) | ≤ 40 sobre 100 | Cuestionario al terminar la receta | RNF-12 |
| CU-15 | Satisfacción general | Puntaje SUS | ≥ 75 | Cuestionario al terminar | RNF-12 |
| CU-16 | Experiencia emocional | Cuestionario de 5 ítems en escala de 1 a 5 (acompañamiento, tono, celebración, ambientación, confianza) | ≥ 4 de 5 en promedio | Cuestionario tras la celebración | RNF-16, RF-38 a RF-42 |

