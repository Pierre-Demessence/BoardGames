/**
 * Resources every game needs: the card atlases (required) and the audio
 * (optional, `null` when the browser or a clip fails).
 */

import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { CardAudio } from '../shared';

import { AssetLoader } from '@pierre/ecs/modules/asset-loader';

import { loadCardAtlases } from '../kits/cards/atlas';
import { loadCardAudio } from '../shared/audio';

export interface GameResources {
  atlases: TextureAtlasRegistry;
  audio: CardAudio | null;
  audioCtx: AudioContext | null;
}

/**
 * Closes the audio context. Safe to call twice or without audio.
 */
export function closeResources(resources: Pick<GameResources, 'audioCtx'>): void {
  resources.audioCtx?.close().catch(() => {});
}

/**
 * Loads the atlases, then tries the audio. A failed atlas rejects; a failed
 * audio context or clip leaves `audio` and `audioCtx` `null` so games run silent.
 */
export async function loadResources(signal: AbortSignal): Promise<GameResources> {
  const assetLoader = new AssetLoader();
  const audioCtx = createAudioContext();
  try {
    const [atlases, audio] = await Promise.all([
      loadCardAtlases(assetLoader, signal),
      audioCtx ? loadAudioOrNull(assetLoader, audioCtx, signal) : null,
    ]);
    return { atlases, audio, audioCtx: audio ? audioCtx : null };
  }
  catch (error) {
    audioCtx?.close().catch(() => {});
    throw error;
  }
}

/**
 * Browsers only let an audio context play after a user gesture: resume it on
 * the first pointer press anywhere. Returns a function that removes the listeners.
 */
export function resumeOnFirstPress(
  audioCtx: AudioContext | null,
  target: EventTarget = window,
): () => void {
  if (!audioCtx)
    return () => {};
  const events = ['pointerdown', 'pointerup'];
  const stop = () => {
    for (const name of events) target.removeEventListener(name, onPress, true);
  };
  function onPress() {
    // A mouse pointerdown can precede the browser's user activation, so pointerup retries.
    audioCtx!.resume().then(() => {
      if (audioCtx!.state === 'running')
        stop();
    }).catch(() => {});
  }
  for (const name of events) target.addEventListener(name, onPress, true);
  return stop;
}

function createAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    return AudioContextClass ? new AudioContextClass() : null;
  }
  catch (error) {
    console.warn('board-games: audio unavailable:', error);
    return null;
  }
}

async function loadAudioOrNull(
  assetLoader: AssetLoader,
  audioCtx: AudioContext,
  signal: AbortSignal,
): Promise<CardAudio | null> {
  try {
    return await loadCardAudio(assetLoader, audioCtx, signal);
  }
  catch (error) {
    if (signal.aborted)
      throw error;
    console.warn('board-games: audio failed to load, playing silent:', error);
    audioCtx.close().catch(() => {});
    return null;
  }
}
