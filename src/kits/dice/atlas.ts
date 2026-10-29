/**
 * Dice atlases — the Kenney dice spritesheets, added to the shared registry.
 * White dice are free, red dice are held; games also raise held dice and label
 * them, so holding never relies on color alone.
 */

import type { AssetLoader } from '@pierre/ecs/modules/asset-loader';
import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { DieValue } from './dice';

import { imageAsset, textAsset } from '@pierre/ecs/modules/asset-loader';
import { parseTexturePackerAtlas } from '@pierre/ecs/modules/texture-atlas';

import redSheetUrl from '../../../assets/kenney_boardgame-pack/Spritesheets/diceRed_border.png?url';
import redXmlUrl from '../../../assets/kenney_boardgame-pack/Spritesheets/diceRed_border.xml?url';
import whiteSheetUrl from '../../../assets/kenney_boardgame-pack/Spritesheets/diceWhite_border.png?url';
import whiteXmlUrl from '../../../assets/kenney_boardgame-pack/Spritesheets/diceWhite_border.xml?url';

export const DICE_ATLAS = 'diceWhite_border';
export const DICE_HELD_ATLAS = 'diceRed_border';

export function diceAtlas(held: boolean): string {
  return held ? DICE_HELD_ATLAS : DICE_ATLAS;
}

/** The frame name of a die face, such as `dieWhite_border3.png`; it lives in the atlas `diceAtlas(held)`. */
export function dieFrame(value: DieValue, held: boolean): string {
  return `${held ? 'dieRed' : 'dieWhite'}_border${value}.png`;
}

export async function loadDiceAtlases(
  assetLoader: AssetLoader,
  signal: AbortSignal,
  registry: TextureAtlasRegistry,
): Promise<void> {
  const [whiteImg, whiteXml, redImg, redXml] = await Promise.all([
    assetLoader.load(imageAsset(whiteSheetUrl), { signal }),
    assetLoader.load(textAsset(whiteXmlUrl), { signal }),
    assetLoader.load(imageAsset(redSheetUrl), { signal }),
    assetLoader.load(textAsset(redXmlUrl), { signal }),
  ]);
  registry
    .add(DICE_ATLAS, whiteImg, parseTexturePackerAtlas(whiteXml).frames)
    .add(DICE_HELD_ATLAS, redImg, parseTexturePackerAtlas(redXml).frames);
}
