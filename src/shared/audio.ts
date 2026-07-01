/**
 * Shared card audio — loads and provides the Kenney boardgame SFX.
 *
 * All card games share the same place / slide sounds so the experience
 * feels cohesive across games.
 */

import type { AssetLoader } from '@pierre/ecs/modules/asset-loader';

import { audioBufferAsset } from '@pierre/ecs/modules/asset-loader';
import { WebAudioProvider } from '@pierre/ecs/modules/audio';
import { pick } from '@pierre/ecs/modules/rng';

import place1Url from '../../assets/kenney_boardgame-pack/Bonus/cardPlace1.ogg?url';
import place2Url from '../../assets/kenney_boardgame-pack/Bonus/cardPlace2.ogg?url';
import place3Url from '../../assets/kenney_boardgame-pack/Bonus/cardPlace3.ogg?url';
import slide1Url from '../../assets/kenney_boardgame-pack/Bonus/cardSlide1.ogg?url';
import slide2Url from '../../assets/kenney_boardgame-pack/Bonus/cardSlide2.ogg?url';
import slide3Url from '../../assets/kenney_boardgame-pack/Bonus/cardSlide3.ogg?url';
import { SFX_VOLUME } from './constants';

const slideUrls = [slide1Url, slide2Url, slide3Url];
const placeUrls = [place1Url, place2Url, place3Url];

export interface CardAudio {
  place: string[];
  provider: WebAudioProvider;
  slide: string[];
}

export async function loadCardAudio(
  assetLoader: AssetLoader,
  audioCtx: AudioContext,
  signal: AbortSignal,
): Promise<CardAudio> {
  const [slideBufs, placeBufs] = await Promise.all([
    Promise.all(slideUrls.map(u =>
      assetLoader.load(audioBufferAsset(u, audioCtx), { signal }))),
    Promise.all(placeUrls.map(u =>
      assetLoader.load(audioBufferAsset(u, audioCtx), { signal }))),
  ]);

  const clips: Record<string, AudioBuffer> = {};
  const slide = slideBufs.map((buf, i) => registerClip(clips, `slide${i}`, buf));
  const place = placeBufs.map((buf, i) => registerClip(clips, `place${i}`, buf));

  return { place, provider: new WebAudioProvider({ clips, context: audioCtx }), slide };
}

export function playCardSfx(audio: CardAudio | null, kind: 'place' | 'slide'): void {
  if (!audio)
    return;
  const ids = kind === 'slide' ? audio.slide : audio.place;
  const id = pick(ids)!;
  try {
    audio.provider.play(id, { channel: 'sfx', volume: SFX_VOLUME });
  }
  catch {
    // A clip can fail if decoding was skipped; SFX is non-essential.
  }
}

function registerClip(clips: Record<string, AudioBuffer>, id: string, buf: AudioBuffer): string {
  clips[id] = buf;
  return id;
}
