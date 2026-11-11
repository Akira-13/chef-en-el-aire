// Reconocedor de gestos con MediaPipe (RF-20). El video no sale del dispositivo (RNF-11).

import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import type { GestureFrame } from './interpretGestures';

const WASM_PATH = '/wasm';
const MODEL_PATH = '/models/gesture_recognizer.task';
/** Unos 20 fps. */
const FRAME_INTERVAL_MS = 50;
const FPS_REPORT_MS = 5000;
const MIN_GESTURE_SCORE = 0.6;

export type GestureErrorKind = 'camera' | 'model';

export interface GestureHandlers {
  onFrame(frame: GestureFrame, t: number): void;
  onFps?(fps: number): void;
  onError(kind: GestureErrorKind, detail: string): void;
}

async function createRecognizer(): Promise<GestureRecognizer> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO' as const,
    numHands: 1,
  });
  try {
    return await GestureRecognizer.createFromOptions(fileset, options('GPU'));
  } catch {
    return GestureRecognizer.createFromOptions(fileset, options('CPU'));
  }
}

/** Enciende la cámara y devuelve la función que la apaga. */
export function startGestures(handlers: GestureHandlers): () => void {
  let stopped = false;
  let stream: MediaStream | undefined;
  let recognizer: GestureRecognizer | undefined;
  let frameHandle: number | undefined;
  let fpsTimer: number | undefined;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;

  const hasVideoFrameCallback = 'requestVideoFrameCallback' in video;

  function scheduleFrame(): void {
    if (stopped) return;
    frameHandle = hasVideoFrameCallback
      ? video.requestVideoFrameCallback(onFrame)
      : requestAnimationFrame(onFrame);
  }

  let lastProcessed = 0;
  let frames = 0;

  function onFrame(): void {
    if (stopped || !recognizer) return;
    const now = performance.now();
    if (now - lastProcessed >= FRAME_INTERVAL_MS && video.readyState >= 2) {
      lastProcessed = now;
      frames++;
      const result = recognizer.recognizeForVideo(video, now);
      const top = result.gestures[0]?.[0];
      const wrist = result.landmarks[0]?.[0];
      handlers.onFrame(
        {
          category: top && top.score >= MIN_GESTURE_SCORE ? top.categoryName : null,
          wristX: wrist ? wrist.x : null,
          wristY: wrist ? wrist.y : null,
        },
        now,
      );
    }
    scheduleFrame();
  }

  async function start(): Promise<void> {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
    } catch (error) {
      if (!stopped) handlers.onError('camera', String(error));
      return;
    }
    if (stopped) return stop();
    video.srcObject = stream;
    try {
      await video.play();
      recognizer = await createRecognizer();
    } catch (error) {
      if (!stopped) handlers.onError('model', String(error));
      return stop();
    }
    if (stopped) return stop();
    fpsTimer = window.setInterval(() => {
      handlers.onFps?.(frames / (FPS_REPORT_MS / 1000));
      frames = 0;
    }, FPS_REPORT_MS);
    scheduleFrame();
  }

  function stop(): void {
    stopped = true;
    if (frameHandle !== undefined) {
      if (hasVideoFrameCallback) video.cancelVideoFrameCallback(frameHandle);
      else cancelAnimationFrame(frameHandle);
    }
    window.clearInterval(fpsTimer);
    for (const track of stream?.getTracks() ?? []) track.stop();
    video.srcObject = null;
    recognizer?.close();
    recognizer = undefined;
  }

  void start();
  return stop;
}
