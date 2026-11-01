// Estado de los canales de entrada, compartido entre InputLayer y ChannelStatus.

import { create } from 'zustand';

export type ChannelState = 'off' | 'starting' | 'on' | 'error';

interface ChannelStore {
  voice: ChannelState;
  camera: ChannelState;
  /** Voz activada por el usuario (RNF-11). */
  voiceEnabled: boolean;
  /** Cámara apagada por el usuario (CA-16.2). */
  cameraUserOff: boolean;
  /** Se escuchó "chef" y se espera el comando. */
  wakeArmed: boolean;
}

export const useChannelStore = create<ChannelStore>(() => ({
  voice: 'off',
  camera: 'off',
  voiceEnabled: false,
  cameraUserOff: false,
  wakeArmed: false,
}));

export function setChannels(patch: Partial<ChannelStore>): void {
  useChannelStore.setState(patch);
}
