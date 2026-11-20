import { describe, expect, it } from 'vitest';
import type { Command } from '@chef/shared';
import { parseCommand } from './parseCommand';

describe('parseCommand (CA-13.1)', () => {
  const cases: [string, Command][] = [
    ['siguiente', { type: 'next' }],
    ['Adelante', { type: 'next' }],
    ['anterior', { type: 'previous' }],
    ['atrás', { type: 'previous' }],
    ['repite', { type: 'repeat' }],
    ['repetir', { type: 'repeat' }],
    ['pausa', { type: 'pause' }],
    ['continúa', { type: 'resume' }],
    ['sigue', { type: 'resume' }],
    ['inicia temporizador', { type: 'startTimer' }],
    ['inicia el temporizador del arroz', { type: 'startTimer', name: 'arroz' }],
    ['Inicia el temporizador de la papa', { type: 'startTimer', name: 'papa' }],
    ['detén el temporizador', { type: 'stopTimer' }],
    ['para el temporizador de huevos', { type: 'stopTimer', name: 'huevos' }],
    ['¿cuánto falta?', { type: 'queryTimer' }],
    ['¿Cuánto falta del arroz?', { type: 'queryTimer', name: 'arroz' }],
    ['explícame', { type: 'explain' }],
    ['ayuda', { type: 'help' }],
    ['¿dónde estoy?', { type: 'whereAmI' }],
    ['confirmo', { type: 'confirm' }],
    ['cancela', { type: 'cancel' }],
    ['listo', { type: 'dismissAlert' }],
    ['saltar', { type: 'skip' }],
    ['sustituye la mantequilla', { type: 'substitute', ingredient: 'mantequilla' }],
    ['apaga la cámara', { type: 'cameraOff' }],
    ['enciende la camara', { type: 'cameraOn' }],
    ['bloquea gestos', { type: 'lockGestures' }],
    ['bloquea los gestos por 60 segundos', { type: 'lockGestures', seconds: 60 }],
    ['me gustó', { type: 'rate', value: 'up' }],
    ['no me gustó', { type: 'rate', value: 'down' }],
    ['estoy nervioso', { type: 'feeling', feeling: 'nervous' }],
    ['estoy nerviosa', { type: 'feeling', feeling: 'nervous' }],
    ['estoy cansada', { type: 'feeling', feeling: 'tired' }],
    ['busca lomo saltado', { type: 'search', query: 'lomo saltado' }],
    ['desactiva temporizador cebolla', { type: 'stopTimer', name: 'cebolla' }],
    ['apaga el temporizador', { type: 'stopTimer' }],
    ['cancela el temporizador del arroz', { type: 'stopTimer', name: 'arroz' }],
    ['quita el temporizador', { type: 'stopTimer' }],
    ['activa el temporizador', { type: 'startTimer' }],
    ['comienza el temporizador de la pasta', { type: 'startTimer', name: 'pasta' }],
    ['apaga la alarma', { type: 'dismissAlert' }],
    ['cancela', { type: 'cancel' }],
    ['apaga la cámara', { type: 'cameraOff' }],
    ['tengo arroz, huevos y cebolla', { type: 'addPantry', items: ['arroz', 'huevos', 'cebolla'] }],
    // Frase cortada a la mitad: la "y" suelta del final no es parte del ingrediente.
    ['tengo arroz, huevo y', { type: 'addPantry', items: ['arroz', 'huevo'] }],
  ];

  it.each(cases)('"%s"', (text, expected) => {
    expect(parseCommand(text)).toEqual(expected);
  });

  it('tolera mayúsculas, tildes y signos', () => {
    expect(parseCommand('¡SIGUIENTE!')).toEqual({ type: 'next' });
    expect(parseCommand('Explicame.')).toEqual({ type: 'explain' });
  });

  it('convierte en pregunta lo que no es un comando, conservando el texto original', () => {
    expect(parseCommand('¿Puedo usar mantequilla?')).toEqual({
      type: 'ask',
      question: '¿Puedo usar mantequilla?',
    });
  });

  it('no confunde una pregunta que empieza con una palabra de comando', () => {
    expect(parseCommand('sigue estando caliente la olla')).toMatchObject({ type: 'ask' });
  });

  it('devuelve null para una frase vacía', () => {
    expect(parseCommand('  ¿? ')).toBeNull();
  });
});

describe('porciones por voz (CA-04.2)', () => {
  it.each([
    ['para 2 porciones', 2],
    ['para dos porciones', 2],
    ['para una porción', 1],
    ['Para 12 porciones', 12],
    ['para doce porciones', 12],
  ])('"%s" → %i porciones', (text, servings) => {
    expect(parseCommand(text)).toEqual({ type: 'setServings', servings });
  });

  it('fuera de 1 a 12 no cambia las porciones', () => {
    expect(parseCommand('para 20 porciones')).toMatchObject({ type: 'ask' });
    expect(parseCommand('para 0 porciones')).toMatchObject({ type: 'ask' });
  });

  it('"para" sigue deteniendo el temporizador', () => {
    expect(parseCommand('para el temporizador')).toEqual({ type: 'stopTimer' });
  });
});

describe('abrir la Comunidad y publicar una receta (CA-27.1)', () => {
  it.each([
    ['abre la comunidad', { type: 'openCommunity' }],
    ['ir a la comunidad', { type: 'openCommunity' }],
    ['publica mi receta', { type: 'share' }],
    ['comparte mi receta', { type: 'share' }],
  ] satisfies [string, Command][])('"%s"', (text, expected) => {
    expect(parseCommand(text)).toEqual(expected);
  });
});

describe('aplaudir y comentar por voz (CA-28.2)', () => {
  it.each([
    ['aplaude', { type: 'applaud' }],
    ['aplauso', { type: 'applaud' }],
    ['comenta que me salió rica', { type: 'comment', text: 'me salió rica' }],
    ['comentario: ¡Qué Rico!', { type: 'comment', text: '¡Qué Rico!' }],
    ['Comenta, se ve buenaza', { type: 'comment', text: 'se ve buenaza' }],
  ] satisfies [string, Command][])('"%s"', (text, expected) => {
    expect(parseCommand(text)).toEqual(expected);
  });

  it('"comenta qué rico" es un comentario y no una pregunta al asistente', () => {
    expect(parseCommand('comenta qué rico')).toEqual({ type: 'comment', text: 'qué rico' });
  });
});

describe('compartir el logro (CA-29.2)', () => {
  it.each(['comparte mi logro', 'publícalo'])('"%s"', (text) => {
    expect(parseCommand(text)).toEqual({ type: 'share' });
  });
});
