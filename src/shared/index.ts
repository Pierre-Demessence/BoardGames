import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { CardAudio } from './audio';

export type { CardAudio } from './audio';
export type { Color, Suit } from './cards';
export type { Card } from './deck';
export type { CardLayout } from './layout';

export interface GameResources {
  atlases: TextureAtlasRegistry;
  audio: CardAudio;
  audioCtx: AudioContext;
}
export { BACKS_ATLAS, CARDS_ATLAS, loadCardAtlases } from './atlas';
export { loadCardAudio, playCardSfx } from './audio';
export { CARD_BACK_FRAME, CARD_H, CARD_W, cardFrame, RANKS, suitColor, SUITS } from './cards';
export {
  BAR_HEIGHT,
  DRAG_FAN_RATIO,
  DRAG_ORDER_BUMP,
  FAN_FACE_DOWN_RATIO,
  FAN_FACE_UP_RATIO,
  HAND_CARD_OVERLAP,
  OFF_SCREEN_X,
  OFF_SCREEN_Y,
  OFF_SCREEN_Y_STEP,
  SFX_VOLUME,
  TABLEAU_Y_GAP,
} from './constants';
export { makeDeck, shuffleDeck } from './deck';
export { computeLayout } from './layout';
export { GameShell, type GameShellProps, makeWorld } from './shell.tsx';
