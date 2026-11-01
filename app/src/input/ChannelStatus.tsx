// Indicadores de micrófono y cámara activos, con control para apagarlos (RF-21, CA-16.2).

import { commandBus } from '../core/commandBus';
import { output, useProfile } from '../core/services';
import { setChannels, useChannelStore } from './channelStore';
import styles from './input.module.css';
import { requestMicrophone } from './voice/recognizer';
import { WAKE_WORD } from './voice/wakeWord';

export function ChannelStatus() {
  const prefs = useProfile().accessibility;
  const { voice, camera, voiceEnabled, cameraUserOff, wakeArmed } = useChannelStore();
  const voiceAllowed = prefs.activeInputs.includes('voz') && !prefs.voiceDisabled;
  const gesturesAllowed = prefs.activeInputs.includes('gestos');

  async function toggleVoice() {
    if (voiceEnabled) {
      setChannels({ voiceEnabled: false });
      output.announce({ text: 'Voz desactivada.', kind: 'info' });
      return;
    }
    if (await requestMicrophone()) {
      setChannels({ voiceEnabled: true });
      output.announce({
        text: `Voz activada. Di «${WAKE_WORD}» antes de cada orden.`,
        kind: 'info',
      });
    } else {
      setChannels({ voice: 'error' });
      output.cue('error');
      output.announce({
        text: 'No tengo permiso para usar el micrófono. Usa gestos o toca la pantalla.',
        kind: 'error',
      });
    }
  }

  const voiceLabel = !voiceEnabled
    ? 'Activar voz'
    : voice === 'error'
      ? 'Voz no disponible'
      : wakeArmed
        ? 'Te escucho…'
        : `Di «${WAKE_WORD}…»`;

  const cameraLabel =
    camera === 'on'
      ? 'Cámara activa'
      : camera === 'starting'
        ? 'Abriendo cámara…'
        : camera === 'error'
          ? 'Cámara no disponible'
          : 'Cámara apagada';

  return (
    <div className={styles.status}>
      {voiceAllowed && (
        <button
          type="button"
          className={styles.pill}
          data-state={voiceEnabled ? voice : 'off'}
          data-armed={wakeArmed || undefined}
          aria-pressed={voiceEnabled}
          aria-label={voiceEnabled ? 'Desactivar voz' : 'Activar voz'}
          onClick={() => void toggleVoice()}
        >
          <span aria-hidden="true">🎙️</span>
          <span className={styles.pillText}>{voiceLabel}</span>
        </button>
      )}
      {gesturesAllowed && (
        <button
          type="button"
          className={styles.pill}
          data-state={cameraUserOff ? 'off' : camera}
          aria-pressed={!cameraUserOff}
          aria-label={cameraUserOff ? 'Encender cámara' : `${cameraLabel}. Apagar cámara`}
          onClick={() =>
            commandBus.emit({ type: cameraUserOff ? 'cameraOn' : 'cameraOff' }, 'touch')
          }
        >
          <span aria-hidden="true">📷</span>
          <span className={styles.pillText}>{cameraUserOff ? 'Cámara apagada' : cameraLabel}</span>
        </button>
      )}
    </div>
  );
}
