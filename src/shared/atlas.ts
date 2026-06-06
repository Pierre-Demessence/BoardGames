/**
 * Shared card atlas — loads the Kenney card spritesheets once for all games.
 */

import type { AssetLoader } from '@pierre/ecs/modules/asset-loader';

import { imageAsset, textAsset } from '@pierre/ecs/modules/asset-loader';
import { parseTexturePackerAtlas, TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import cardsSheetUrl from '../../assets/kenney_boardgame-pack/Spritesheets/playingCards.png?url';
import cardsXmlUrl from '../../assets/kenney_boardgame-pack/Spritesheets/playingCards.xml?url';
import backsSheetUrl from '../../assets/kenney_boardgame-pack/Spritesheets/playingCardBacks.png?url';
import backsXmlUrl from '../../assets/kenney_boardgame-pack/Spritesheets/playingCardBacks.xml?url';

export const CARDS_ATLAS = 'cards';
export const BACKS_ATLAS = 'backs';

export async function loadCardAtlases(
  assetLoader: AssetLoader,
  signal: AbortSignal,
): Promise<TextureAtlasRegistry> {
  const [cardsImg, cardsXml, backsImg, backsXml] = await Promise.all([
    assetLoader.load(imageAsset(cardsSheetUrl), { signal }),
    assetLoader.load(textAsset(cardsXmlUrl), { signal }),
    assetLoader.load(imageAsset(backsSheetUrl), { signal }),
    assetLoader.load(textAsset(backsXmlUrl), { signal }),
  ]);

  return new TextureAtlasRegistry()
    .add(CARDS_ATLAS, cardsImg, parseTexturePackerAtlas(cardsXml).frames)
    .add(BACKS_ATLAS, backsImg, parseTexturePackerAtlas(backsXml).frames);
}
