// Arranca y detiene los canales de entrada (voz y gestos) según el perfil y la pantalla
// actual, y publica lo reconocido en el bus de comandos. Se monta una sola vez.

import { useEffect, useRef, useState } from 'react';
import { COMMAND_LABELS, type Command, type ScreenId } from '@chef/shared';
import { commandBus, useCommands } from '../core/commandBus';
import { getCommandContext, useCommandContext } from '../core/commandContext';
import { metrics } from '../core/metrics';
import { output, profileService, useProfile } from '../core/services';
import { showGestureNotice, speechAt } from '../output';
import { setChannels, useChannelStore } from './channelStore';
import { reportFallback } from './fallback';
import {
  createGestureInterpreter,
  createHandWatcher,
  SENSITIVITY,
} from './gestures/interpretGestures';
import { GESTURE_SCREENS, VOICE_SCREENS, voiceAllowed as isVoiceAllowed } from './help';
import { HelpPanel } from './HelpPanel';
import { createConfirmation } from './voice/confirmation';
import { isEcho } from './voice/echo';
import { resolveMicrophone } from './voice/permission';
import { DEFAULT_SILENCE_MS, startVoice } from './voice/recognizer';

// Pantallas donde se puede mostrar la pregunta del navegador por el micrófono. No son todas las
// de `VOICE_SCREENS`: pedirlo al abrir la app, sin que el usuario haya hecho nada, es la forma más
// segura de que lo rechace y se quede sin voz. Se pide donde la voz es el centro de la pantalla
// (la bienvenida lo pide la primera vez) y después ya está concedido para Inicio y Receta.
const MIC_PROMPT_SCREENS: ScreenId[] = ['cooking', 'celebration', 'onboarding'];

const WAKE_TIMEOUT_MS = 5000;
const DEFAULT_LOCK_SECONDS = 30;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function gestureLabel(command: Command): string {
  if (command.type === 'rate') return command.value === 'up' ? 'Me gustó' : 'No me gustó';
  return capitalize(COMMAND_LABELS[command.type]);
}

export function InputLayer() {
  const profile = useProfile();
  const screen = useCommandContext((s) => s.screen);
  const voiceEnabled = useChannelStore((s) => s.voiceEnabled);
  const cameraUserOff = useChannelStore((s) => s.cameraUserOff);
  const online = useChannelStore((s) => s.online);
  const [confirmation] = useState(createConfirmation);
  const lockTimer = useRef<number | undefined>(undefined);
  const prefs = profile.accessibility;

  const voiceAllowed = isVoiceAllowed(prefs);
  const voiceWanted = voiceAllowed && voiceEnabled && VOICE_SCREENS.includes(screen);
  const voiceRuns = voiceWanted && online;
  const gesturesAllowed = prefs.activeInputs.includes('gestos');
  const gesturesRun = gesturesAllowed && !cameraUserOff && GESTURE_SCREENS.includes(screen);

  // El micrófono se pide al llegar a una pantalla con voz; si ya tenía permiso, se activa sin
  // preguntar. Si el usuario lo rechaza, se avisa una vez y el botón permite reintentar.
  const mayAskMic = MIC_PROMPT_SCREENS.includes(screen);
  useEffect(() => {
    if (!voiceAllowed || useChannelStore.getState().voiceEnabled) return;
    let cancelled = false;
    const askedAt = performance.now();
    void resolveMicrophone(mayAskMic).then(({ granted, asked }) => {
      if (cancelled) return;
      if (granted) setChannels({ voiceEnabled: true });
      else if (asked) {
        setChannels({ voice: 'error' });
        reportFallback('not-allowed', askedAt);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [voiceAllowed, mayAskMic]);

  useEffect(() => {
    const update = () => setChannels({ online: navigator.onLine });
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.clearTimeout(lockTimer.current);
      confirmation.dispose();
    };
  }, [confirmation]);

  useCommands(({ command }) => {
    if (command.type === 'cameraOff') setChannels({ cameraUserOff: true });
    if (command.type === 'cameraOn') setChannels({ cameraUserOff: false });
    if (command.type === 'lockGestures') lockGestures(command.seconds ?? DEFAULT_LOCK_SECONDS);
  });

  // "Bloquea gestos": se reactivan solos y se avisa (CA-17.2).
  function lockGestures(seconds: number): void {
    setChannels({ gesturesLockedUntil: Date.now() + seconds * 1000 });
    output.announce({ text: `Gestos bloqueados por ${seconds} segundos.`, kind: 'info' });
    window.clearTimeout(lockTimer.current);
    lockTimer.current = window.setTimeout(() => {
      setChannels({ gesturesLockedUntil: 0 });
      output.cue('success');
      output.announce({ text: 'Los gestos están activos de nuevo.', kind: 'info' });
    }, seconds * 1000);
  }

  // ---------- Voz (RF-18, RF-19) ----------
  const silenceMs = prefs.voiceTimeoutMs ?? DEFAULT_SILENCE_MS;
  // Ahora que la voz vive en cinco pantallas, el aviso de «sin internet» se da una sola vez
  // mientras no haya red, y no en cada pantalla por la que pase el usuario.
  const offlineNoticed = useRef(false);
  useEffect(() => {
    if (online) {
      offlineNoticed.current = false;
      return;
    }
    if (!voiceWanted || offlineNoticed.current) return;
    offlineNoticed.current = true;
    setChannels({ voice: 'error' });
    reportFallback('offline', performance.now());
  }, [voiceWanted, online]);

  // Rastro en la consola de por qué la voz no escucha en una pantalla que la usa.
  useEffect(() => {
    if (!VOICE_SCREENS.includes(screen) || voiceRuns) return;
    console.debug('[voz] apagada en', screen, { voiceAllowed, voiceEnabled, online });
  }, [screen, voiceRuns, voiceAllowed, voiceEnabled, online]);

  useEffect(() => {
    if (!voiceRuns) return;
    const startedAt = performance.now();
    setChannels({ voice: 'on' });
    let wakeTimer: number | undefined;
    const stop = startVoice(
      {
        onCommand(command, extra, text) {
          window.clearTimeout(wakeTimer);
          setChannels({ wakeArmed: false });
          confirmation.command(command, extra, text);
        },
        onPhrase: (transcript) => confirmation.phrase(transcript),
        onWake() {
          setChannels({ wakeArmed: true });
          output.cue('listening');
          window.clearTimeout(wakeTimer);
          wakeTimer = window.setTimeout(() => setChannels({ wakeArmed: false }), WAKE_TIMEOUT_MS);
        },
        onError(kind) {
          if (kind === 'other') return;
          setChannels({ voice: 'error' });
          reportFallback(kind, startedAt);
        },
      },
      {
        silenceMs,
        isEcho: (transcript, heardAt) => isEcho(transcript, speechAt(heardAt)),
      },
    );
    return () => {
      stop();
      window.clearTimeout(wakeTimer);
      setChannels({ voice: 'off', wakeArmed: false });
    };
  }, [voiceRuns, silenceMs, confirmation]);

  // ---------- Gestos (RF-20 a RF-23) ----------
  const sensitivity = SENSITIVITY[prefs.gestureSensitivity] ?? SENSITIVITY.normal;
  useEffect(() => {
    if (!gesturesRun) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const startedAt = performance.now();
    const interpreter = createGestureInterpreter({
      ...sensitivity,
      onActivate() {
        showGestureNotice('Gestos activos');
        output.cue('gesture');
      },
    });
    const handWatcher = createHandWatcher();
    setChannels({ camera: 'starting' });

    // MediaPipe pesa: se carga solo cuando hace falta la cámara.
    void import('./gestures/recognizer').then(({ startGestures }) => {
      if (cancelled) return;
      stop = startGestures({
        onFrame(frame, t) {
          const detectedAt = performance.now();
          const channels = useChannelStore.getState();
          if (channels.camera !== 'on') setChannels({ camera: 'on' });
          if (Date.now() < channels.gesturesLockedUntil) {
            interpreter.reset();
            return;
          }
          if (handWatcher.update(frame, t)) {
            output.announce({ text: 'No veo bien tu mano.', kind: 'info' });
          }
          const command = interpreter.update(
            frame,
            t,
            getCommandContext(),
            profileService.getProfile().accessibility,
          );
          if (!command) return;
          const confirmed = confirmation.gesture(command);
          if (confirmed) {
            showGestureNotice(`Gesto: Sí, ${gestureLabel(confirmed).toLowerCase()}`);
            output.cue('gesture');
            return;
          }
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
          reportFallback(kind, startedAt);
        },
      });
    });

    return () => {
      cancelled = true;
      stop?.();
      setChannels({ camera: 'off' });
    };
  }, [gesturesRun, sensitivity, confirmation]);

  return <HelpPanel />;
}
