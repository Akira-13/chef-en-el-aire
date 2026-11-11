// Comandos y gestos válidos según la pantalla y el perfil, para la ayuda contextual (RF-14,
// CA-12.3) y para sugerir el gesto equivalente cuando la voz falla (CA-14.2).

import {
  COMMAND_LABELS,
  type AccessibilityPrefs,
  type CommandContext,
  type CommandType,
  type GestureId,
  type ScreenId,
} from '@chef/shared';

type HelpPrefs = Pick<
  AccessibilityPrefs,
  'activeInputs' | 'voiceDisabled' | 'enabledGestures' | 'requiresActivationGesture'
>;

export interface GestureHint {
  icon: string;
  /** Cómo se hace, por ejemplo "palma abierta sostenida". */
  how: string;
  /** Qué hace, con el nombre del comando. */
  does: string;
  command: CommandType;
}

export interface HelpContent {
  voice: string[];
  gestures: GestureHint[];
  /** Aviso previo a los gestos, por ejemplo el gesto de activación. */
  gestureNote?: string;
  touch: boolean;
}

export const GESTURE_SCREENS: ScreenId[] = ['cooking', 'celebration', 'onboarding'];

// Pantallas donde corre el reconocimiento de voz. Es la única lista: `InputLayer` enciende el
// micrófono con ella y la ayuda contextual solo ofrece comandos de voz donde está encendido, para
// no prometer lo que no funciona. La cámara se queda solo en `GESTURE_SCREENS`, que gasta más.
export const VOICE_SCREENS: ScreenId[] = ['home', 'recipe', 'cooking', 'celebration', 'onboarding'];

const VOICE_BY_SCREEN: Record<ScreenId, CommandType[]> = {
  home: ['search', 'addPantry', 'ask'],
  recipe: ['substitute', 'ask', 'whereAmI'],
  cooking: [
    'next',
    'previous',
    'repeat',
    'pause',
    'resume',
    'explain',
    'substitute',
    'ask',
    'skip',
    'whereAmI',
  ],
  celebration: ['rate', 'feeling', 'skip'],
  profile: ['whereAmI'],
  onboarding: ['next', 'previous', 'confirm', 'cancel'],
};

export function voiceAllowed(prefs: Pick<HelpPrefs, 'activeInputs' | 'voiceDisabled'>): boolean {
  return prefs.activeInputs.includes('voz') && !prefs.voiceDisabled;
}

/** True si la voz está activa y la pantalla la escucha. */
function voiceHere(screen: ScreenId, prefs: Pick<HelpPrefs, 'activeInputs' | 'voiceDisabled'>) {
  return voiceAllowed(prefs) && VOICE_SCREENS.includes(screen);
}

function voiceCommands(ctx: CommandContext, prefs: HelpPrefs): CommandType[] {
  const commands = [...VOICE_BY_SCREEN[ctx.screen]];
  if (ctx.screen === 'cooking') {
    if (ctx.alertActive) commands.unshift('dismissAlert');
    if (ctx.stepHasTimer) commands.push('startTimer');
    if (ctx.activeTimers.length > 0) commands.push('queryTimer', 'stopTimer');
    if (prefs.activeInputs.includes('gestos')) commands.push('lockGestures', 'cameraOff');
  }
  commands.push('help');
  return commands;
}

function gesture(
  id: GestureId,
  icon: string,
  how: string,
  command: CommandType,
  does = COMMAND_LABELS[command],
): { id: GestureId; hint: GestureHint } {
  return { id, hint: { icon, how, does, command } };
}

function gestureHints(ctx: CommandContext, prefs: HelpPrefs): GestureHint[] {
  if (!prefs.activeInputs.includes('gestos') || !GESTURE_SCREENS.includes(ctx.screen)) return [];
  const all =
    ctx.screen === 'celebration'
      ? [
          gesture('pulgar_arriba_confirmar', '👍', 'pulgar arriba', 'rate', 'me gustó'),
          gesture('pulgar_arriba_confirmar', '👎', 'pulgar abajo', 'rate', 'no me gustó'),
        ]
      : [
          gesture('deslizar_siguiente', '👈', 'desliza la mano hacia tu izquierda', 'next'),
          gesture('deslizar_anterior', '👉', 'desliza la mano hacia tu derecha', 'previous'),
          gesture('palma_abierta_pausar', '✋', 'palma abierta sostenida', 'pause'),
          ctx.alertActive
            ? gesture('pulgar_arriba_confirmar', '👍', 'pulgar arriba', 'dismissAlert')
            : gesture('pulgar_arriba_confirmar', '👍', 'pulgar arriba', 'confirm'),
        ];
  return all.filter(({ id }) => prefs.enabledGestures.includes(id)).map(({ hint }) => hint);
}

export function helpFor(ctx: CommandContext, prefs: HelpPrefs): HelpContent {
  const gestures = gestureHints(ctx, prefs);
  return {
    voice: voiceHere(ctx.screen, prefs)
      ? voiceCommands(ctx, prefs).map((c) => COMMAND_LABELS[c])
      : [],
    gestures,
    gestureNote:
      gestures.length > 0 && prefs.requiresActivationGesture
        ? 'Primero levanta el índice ☝️ para activar los gestos.'
        : undefined,
    touch: prefs.activeInputs.includes('tactil'),
  };
}

/** Texto para leer en voz alta; `short` solo nombra los comandos de voz. */
export function helpSpeech({ voice, gestures, gestureNote, touch }: HelpContent): {
  text: string;
  short: string;
} {
  const parts: string[] = [];
  if (voice.length > 0) parts.push(`Puedes decir «chef» y luego: ${voice.join(', ')}.`);
  if (gestures.length > 0) {
    if (gestureNote) parts.push(gestureNote.replace(' ☝️', ''));
    parts.push(`Gestos: ${gestures.map((g) => `${g.how} para ${g.does}`).join('; ')}.`);
  }
  if (touch || parts.length === 0) parts.push('También puedes tocar los botones de la pantalla.');
  return { text: parts.join(' '), short: parts[0]! };
}

/** Gesto que hace lo mismo que `command` en este contexto, si hay uno habilitado. */
export function gestureFor(
  command: CommandType,
  ctx: CommandContext,
  prefs: HelpPrefs,
): GestureHint | undefined {
  return gestureHints(ctx, prefs).find((hint) => hint.command === command);
}
