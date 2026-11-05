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
    ['tengo arroz, huevos y cebolla', { type: 'addPantry', items: ['arroz', 'huevos', 'cebolla'] }],
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
