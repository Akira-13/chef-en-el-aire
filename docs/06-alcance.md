# 06 · Alcance del proyecto

**Responsable:** Jarem Villalobos


## 1. Alcance del MVP (producto)

| Incluye | Requerimientos | Justificación |
|---|---|---|
| 10 recetas de ejemplo en JSON, con unidades caseras y alérgenos | RF-04 | Permite probar todo el flujo con datos controlados |
| Modo cocina con un paso a la vez, ayuda contextual y lectura en voz alta | RF-11 a RF-15 | Es el núcleo de la propuesta de valor |
| Temporizadores con nombre y alerta persistente | RF-16, RF-17 | Evita que la comida se queme; los sistemas similares ya lo establecen como estándar |
| Comandos de voz esenciales | RF-18, RF-19 | La voz es el canal principal para S04 y S05 |
| 4 gestos básicos con MediaPipe | RF-20 a RF-23 | Diferenciador frente a los sistemas similares; canal principal para S07 |
| Accesibilidad multimodal para S04 a S07 | RF-24 a RF-27 | Son usuarios primarios, no un añadido |
| Adaptación de recetas con LLM, capa de abstracción y validación local de alérgenos | RF-05 a RF-10 | Requisito de la práctica y seguridad alimentaria |
| Perfil persistente de prueba (`datos/perfiles.json`) y pantalla "lo que aprendí de ti" | RF-28 a RF-31 | Personalización continua |
| Una sala de cocina conjunta con sincronización de pasos | RF-33 a RF-37 | Requisito de multiusuario; una sola sala basta para demostrarlo |
| Diseño emocional en los tres niveles de Norman | RF-38 a RF-42 | Requisito de la práctica |
| PWA instalable con modo sin conexión | RF-43, RF-44 | Requisito de plataforma y respuesta a la conexión variable |

## 2. Fuera del alcance

| Queda fuera | Justificación |
|---|---|
| Cuidador que configura el perfil de otra persona (RF-32) | Prioridad baja; se diseña la pantalla en el prototipo pero se implementa solo si sobra tiempo |
| Reconocimiento de emociones por análisis facial | Riesgo de privacidad y de error; las emociones se declaran o se infieren de la interacción (repeticiones, errores), nunca de la imagen de la cámara |
| Videollamada de audio y video integrada en la sala | La sala sincroniza pasos y temporizadores; el audio y video ya se resuelven con WhatsApp o Zoom, y no es el vacío que cubrimos |
| Más de una sala simultánea por usuario y salas de más de 4 participantes | Con una sala de hasta 4 personas se demuestra el requisito sin costos de backend |
| Planificación semanal, lista de compras y compras en línea | No mejora el momento de cocinar |
| Importar recetas desde cualquier web | Las recetas heterogéneas exigirían normalización; el MVP usa recetas propias estructuradas |
| Cálculo nutricional y calorías | Exige datos nutricionales fiables y puede interpretarse como consejo de salud |
| Lengua de señas y otros idiomas distintos del español | El español peruano es el contexto de uso; la lengua de señas requeriría un modelo propio. Los usuarios sordos se atienden con gestos simples, subtítulos y alertas visuales |
| Aplicación nativa (iOS y Android)  | La PWA cubre laptop y móvil sin tiendas de apps |

## 3. Supuestos y restricciones

- **Supuestos:** el dispositivo tiene cámara y micrófono; el usuario concede los permisos; en la cocina hay un punto de apoyo para el dispositivo a 1 a 2 m.
- **Restricciones:** tiempo y presupuesto académicos; el LLM remoto puede tener costos y latencia, por eso existe la capa de abstracción y el modo local con Ollama; MediaPipe corre en el navegador, por lo que el rendimiento depende del equipo.
- **Riesgos:** reconocimiento de voz con ruido (RNF-04), detección de manos con poca luz (RF-23) y errores del LLM con alérgenos (RF-07, RNF-06). Cada riesgo tiene un requerimiento de mitigación.
