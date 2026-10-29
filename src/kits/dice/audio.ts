/**
 * Dice audio — loads and plays the Kenney boardgame dice SFX.
 */

import type { AssetLoader } from '@pierre/ecs/modules/asset-loader';

import { audioBufferAsset } from '@pierre/ecs/modules/asset-loader';
import { WebAudioProvider } from '@pierre/ecs/modules/audio';
import { pick } from '@pierre/ecs/modules/rng';

import throw1Url from '../../../assets/kenney_boardgame-pack/Bonus/dieThrow1.ogg?url';
import throw2Url from '../../../assets/kenney_boardgame-pack/Bonus/dieThrow2.ogg?url';

/** Volume level (0-1) for dice SFX. */
const SFX_VOLUME = 0.6;

const throwUrls = [throw1Url, throw2Url];

export interface DiceAudio {
  provider: WebAudioProvider;
  throw: string[];
}

export async function loadDiceAudio(
  assetLoader: AssetLoader,
  audioCtx: AudioContext,
  signal: AbortSignal,
): Promise<DiceAudio> {
  const buffers = await Promise.all(throwUrls.map(u =>
    assetLoader.load(audioBufferAsset(u, audioCtx), { signal })));
  const clips: Record<string, AudioBuffer> = {};
  const ids = buffers.map((buf, i) => {
    clips[`throw${i}`] = buf;
    return `throw${i}`;
  });
  return { provider: new WebAudioProvider({ clips, context: audioCtx }), throw: ids };
}

export function playDiceSfx(audio: DiceAudio | null, kind: 'throw'): void {
  if (!audio)
    return;
  const id = pick(audio[kind])!;
  try {
    audio.provider.play(id, { channel: 'sfx', volume: SFX_VOLUME });
  }
  catch (error) {
    console.warn('board-games: SFX play failed:', error);
  }
}
