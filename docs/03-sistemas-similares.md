# 03 · Análisis de sistemas similares

**Responsable:** Diego García

---

## Tabla comparativa

| Sistema | Tipo | Fortalezas | Debilidades | Qué aprendemos |
|---|---|---|---|---|
| **Pantallas inteligentes con asistente** (Amazon Echo Show con Alexa, Google Nest Hub) | Hardware + asistente de voz | Control por voz maduro ("siguiente paso", temporizadores con nombre); pantalla fija en la cocina; algunos modelos aceptan gestos simples (p. ej. levantar la mano para pausar) | Requieren comprar un dispositivo; las recetas dependen de socios; la adaptación a alergias es limitada; poco útiles si el usuario no puede hablar con claridad | Los **temporizadores con nombre** y la voz para "siguiente paso" son un estándar que el usuario ya espera. Un gesto simple de pausa es valioso, pero no basta como único canal |
| **SideChef** | App de recetas paso a paso | Modo de cocina paso a paso con lectura en voz alta y comandos de voz; temporizadores dentro de cada paso | Modelo de suscripción para parte de las funciones; la voz depende de un ambiente silencioso; sin gestos | Integrar el **temporizador dentro del paso** (se inicia desde el paso, no desde otra pantalla) reduce la carga cognitiva |
| **Kitchen Stories / Tasty** | Apps de recetas con video | Videos cortos muy claros para novatos; fotos por paso; experiencia visual atractiva (nivel visceral) | Para avanzar hay que tocar la pantalla; el video exige mirar, lo que no sirve para usuarios con discapacidad visual | El **video o la imagen por paso** ayudan al novato (S01), pero deben ser un complemento y no el único canal |
| **Cookpad** | Comunidad de recetas | Recetas caseras locales (muy usada en Perú); comunidad activa; buscador por ingrediente | Sin modo manos libres; formato de recetas muy heterogéneo; sin adaptación automática | El usuario valora el **recetario local** y la búsqueda "por lo que tengo"; hay que normalizar las recetas (estructura JSON con pasos y alérgenos) |
| **Samsung Food (ex Whisk)** | Planificador de comidas con IA | Importa recetas de cualquier web; planificación semanal y lista de compras; personalización con IA | Enfocada en planificar, no en el momento de cocinar; control manual | La **despensa y la lista de compras** conectadas a la receta son útiles en A1–A2 |
| **Thermomix + Cookidoo** | Robot de cocina con recetas guiadas | Cocina guiada integrada al aparato (tiempo, temperatura); altísima tasa de éxito; comunidad fiel | Costo muy alto; ecosistema cerrado; solo para quien tiene el robot | El **"paso guiado con confirmación"** genera confianza en el novato; la sensación de éxito (nivel reflexivo) fideliza |
| **Asistentes de IA conversacionales** (modo voz de ChatGPT, Gemini, Claude) | Chatbot general con voz | Adaptan recetas en lenguaje natural, sustituyen ingredientes y responden dudas al instante | No tienen estructura de receta ni temporizadores fiables; pueden "alucinar" cantidades o pasar por alto un alérgeno; no recuerdan el paso actual de forma estructurada | El LLM es excelente para A3 y A7, pero necesita **estructura (receta en JSON) y validación local de alérgenos**; justifica la capa de abstracción y las reglas de seguridad |
| **Paprika Recipe Manager** | Gestor de recetas | Guarda recetas propias; escalado de porciones; temporizadores detectados en el texto; uso sin conexión | Interfaz densa; sin voz ni gestos | El **escalado de porciones** y el **modo offline** son funciones básicas esperadas |
| **Videollamada** (WhatsApp, Zoom) usada para cocinar juntos | Comunicación general | Ya es como las familias cocinan juntas a distancia; emocionalmente muy valiosa | No sabe nada de la receta: no muestra en qué paso va cada uno ni sincroniza temporizadores | Las **salas con indicador de paso por participante** cubren un vacío real; el valor emocional de cocinar juntos es alto |

---

## Conclusiones

1. **La voz ya es un estándar; los gestos no.** Casi ningún sistema ofrece control por gestos en el aire como canal completo. Es nuestra diferenciación principal y además es el canal natural para usuarios sordos o con dificultades del habla.
2. **Nadie combina IA adaptativa con seguridad alimentaria verificable.** Los chatbots adaptan bien pero sin garantías; las apps de recetas tienen estructura pero adaptan poco. Proponemos LLM + receta estructurada + validación local de alérgenos.
3. **La cocina a distancia se resuelve hoy con videollamadas que no conocen la receta.** Hay un vacío claro para salas sincronizadas.
4. **La accesibilidad suele ser un añadido.** La mayoría depende de un solo canal (táctil o voz). Diseñar la redundancia desde el inicio es una ventaja real.
5. **El diseño emocional fideliza** (Thermomix, apps con video atractivo): la sensación de logro al terminar es parte del producto, no un adorno.
