// Arranca y detiene los canales de entrada (voz y gestos) según el perfil y la pantalla
// actual, y publica lo reconocido en el bus de comandos. Se monta una sola vez.

import { useEffect } from 'react';
import { COMMAND_LABELS, type Command, type ScreenId } from '@chef/shared';
import { commandBus, useCommands } from '../core/commandBus';
import { getCommandContext, useCommandContext } from '../core/commandContext';
import { metrics } from '../core/metrics';
import { output, profileService, useProfile } from '../core/services';
import { showGestureNotice } from '../output';
import { setChannels, useChannelStore } from './channelStore';
import { createGestureInterpreter, SWIPE_THRESHOLD } from './gestures/interpretGestures';
import { startVoice, type VoiceErrorKind } from './voice/recognizer';

// Voz y cámara compiten por batería: solo corren donde se cocina.
const VOICE_SCREENS: ScreenId[] = ['cooking', 'celebration', 'onboarding'];
const GESTURE_SCREENS: ScreenId[] = ['cooking', 'celebration', 'onboarding'];

const WAKE_TIMEOUT_MS = 5000;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function gestureLabel(command: Command): string {
  if (command.type === 'rate') return command.value === 'up' ? 'Me gustó' : 'No me gustó';
  return capitalize(COMMAND_LABELS[command.type]);
}

const VOICE_ERRORS: Record<VoiceErrorKind, string> = {
  unsupported: 'Este navegador no reconoce la voz. Usa gestos o toca la pantalla.',
  'not-allowed': 'No tengo permiso para usar el micrófono. Usa gestos o toca la pantalla.',
  network: 'La voz necesita internet. Mientras tanto, usa gestos o toca la pantalla.',
  other: 'La voz tuvo un problema. Puedes usar gestos o tocar la pantalla.',
};

export function InputLayer() {
  const profile = useProfile();
  const screen = useCommandContext((s) => s.screen);
  const voiceEnabled = useChannelStore((s) => s.voiceEnabled);
  const cameraUserOff = useChannelStore((s) => s.cameraUserOff);
  const prefs = profile.accessibility;

  const voiceAllowed = prefs.activeInputs.includes('voz') && !prefs.voiceDisabled;
  const voiceRuns = voiceAllowed && voiceEnabled && VOICE_SCREENS.includes(screen);
  const gesturesAllowed = prefs.activeInputs.includes('gestos');
  const gesturesRun = gesturesAllowed && !cameraUserOff && GESTURE_SCREENS.includes(screen);

  // Si el micrófono ya tenía permiso, la voz se activa sin volver a preguntar.
  useEffect(() => {
    if (!voiceAllowed || useChannelStore.getState().voiceEnabled) return;
    void navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (status.state === 'granted') setChannels({ voiceEnabled: true });
      })
      .catch(() => {});
  }, [voiceAllowed]);

  useCommands(({ command }) => {
    if (command.type === 'cameraOff') setChannels({ cameraUserOff: true });
    if (command.type === 'cameraOn') setChannels({ cameraUserOff: false });
  });

  // ---------- Voz (RF-18) ----------
  useEffect(() => {
    if (!voiceRuns) return;
    setChannels({ voice: 'on' });
    let wakeTimer: number | undefined;
    const stop = startVoice({
      onCommand(command, extra) {
        window.clearTimeout(wakeTimer);
        setChannels({ wakeArmed: false });
        metrics.start('voice.commandToRender');
        commandBus.emit(command, 'voice', extra);
        // Hasta el siguiente cuadro (RNF-01).
        requestAnimationFrame(() =>
          metrics.end('voice.commandToRender', '', { command: command.type }),
        );
      },
      onWake() {
        setChannels({ wakeArmed: true });
        output.cue('navigate');
        window.clearTimeout(wakeTimer);
        wakeTimer = window.setTimeout(() => setChannels({ wakeArmed: false }), WAKE_TIMEOUT_MS);
      },
      onError(kind) {
        if (kind === 'other') return;
        setChannels({ voice: 'error' });
        output.cue('error');
        output.announce({ text: VOICE_ERRORS[kind], kind: 'error' });
      },
    });
    return () => {
      stop();
      window.clearTimeout(wakeTimer);
      setChannels({ voice: 'off', wakeArmed: false });
    };
  }, [voiceRuns]);

  // ---------- Gestos (RF-20, RF-21) ----------
  const swipeThreshold = SWIPE_THRESHOLD[prefs.gestureSensitivity] ?? SWIPE_THRESHOLD.normal;
  useEffect(() => {
    if (!gesturesRun) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const interpreter = createGestureInterpreter({ swipeThreshold });
    setChannels({ camera: 'starting' });

    // MediaPipe pesa: se carga solo cuando hace falta la cámara.
    void import('./gestures/recognizer').then(({ startGestures }) => {
      if (cancelled) return;
      stop = startGestures({
        onFrame(frame, t) {
          const detectedAt = performance.now();
          if (useChannelStore.getState().camera !== 'on') setChannels({ camera: 'on' });
          const command = interpreter.update(
            frame,
            t,
            getCommandContext(),
            profileService.getProfile().accessibility,
          );
          if (!command) return;
          commandBus.emit(command, 'gesture');
          metrics.record('gesture.toAction', performance.now() - detectedAt, 'ms', {
            command: command.type,
          });
          showGestureNotice(`Gesto: ${gestureLabel(command)}`);
          output.cue('gesture');
        },
        onFps(fps) {
          metrics.record('gesture.fps', fps, 'fps');
        },
        onError(kind) {
          setChannels({ camera: 'error' });
          output.cue('error');
          output.announce({
            text:
              kind === 'camera'
                ? 'No puedo usar la cámara. Usa la voz o toca la pantalla.'
                : 'No pude cargar los gestos. Usa la voz o toca la pantalla.',
            kind: 'error',
          });
        },
      });
    });

    return () => {
      cancelled = true;
      stop?.();
      setChannels({ camera: 'off' });
    };
  }, [gesturesRun, swipeThreshold]);

  return null;
}
