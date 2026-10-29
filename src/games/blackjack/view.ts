/**
 * Blackjack's view: the two hand rows for a canvas size, and the labels,
 * sprites and result banner drawn each frame. It reads the rules' state and
 * never changes it.
 */

import type { EcsWorld } from '@pierre/ecs';
import type { Canvas2DRenderContext } from '@pierre/ecs/modules/render-canvas2d';
import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { Size } from '../../core';
import type { CardPlacement, TableLayout } from '../../kits/cards';
import type { BlackjackState, Card, RoundResult } from './rules';

import { Canvas2DRenderer } from '@pierre/ecs/modules/render-canvas2d';

import { drawBanner } from '../../core';
import { computeTableLayout, rowPositions } from '../../kits/cards';
import { handValue, isBust, roundMessage } from './rules';

export interface BlackjackLayout extends TableLayout {
  /** Top of the dealer's cards. */
  dealerY: number;
  /** Top of the player's cards. */
  playerY: number;
}

/** Card width is sized as if the table had this many columns, so cards stay moderate on wide screens. */
const SLOTS = 12;
/** Room above a hand for its label, in card heights. */
const LABEL_ROOM = 0.4;
/** Two hands with their labels plus a band between them, in card heights. */
const HEIGHT_IN_CARDS = 2 * (1 + LABEL_ROOM) + 0.6;
const CARD_ASPECT = 110 / 80;

const TABLE_COLOR = '#0b5e3a';
/** The banner text always spells the outcome out; the color is a second cue. */
const BANNER_COLORS: Record<RoundResult, string> = {
  blackjack: '#ffe14d',
  lose: '#ff8a80',
  push: '#b8c4ff',
  win: '#ffe14d',
};

const renderer = new Canvas2DRenderer();

/** Sizes the cards by width like the other tables, then shrinks them until both hands and their labels fit the height. */
export function blackjackLayout(size: Size): BlackjackLayout {
  const base = computeTableLayout(size.width, size.height, SLOTS);
  const room = size.height - base.topY * 2;
  let { cardH, cardW } = base;
  if (cardH * HEIGHT_IN_CARDS > room) {
    cardW = Math.max(1, Math.floor(room / HEIGHT_IN_CARDS / CARD_ASPECT));
    cardH = Math.round(cardW * CARD_ASPECT);
  }
  return {
    ...base,
    cardH,
    cardW,
    dealerY: base.topY + Math.round(cardH * LABEL_ROOM),
    playerY: size.height - base.topY - cardH,
  };
}

/** Every dealt card's sprite position and paint order; the deck is not placed. */
export function placements(state: BlackjackState, layout: BlackjackLayout): CardPlacement[] {
  const result: CardPlacement[] = [];
  let order = 0;
  const placeHand = (hand: readonly Card[], y: number): void => {
    const spots = rowPositions(hand.length, layout.cardW, layout.canvasW, y);
    hand.forEach((card, i) => result.push({ card, order: order++, x: spots[i]!.x, y }));
  };
  placeHand(state.dealer, layout.dealerY);
  placeHand(state.player, layout.playerY);
  return result;
}

/** Draws the table: background, the two hand labels, the card sprites and the result banner. */
export function drawTable(
  ctx: CanvasRenderingContext2D,
  size: Size,
  layout: BlackjackLayout,
  state: BlackjackState,
  world: EcsWorld,
  atlases: TextureAtlasRegistry,
): void {
  ctx.fillStyle = TABLE_COLOR;
  ctx.fillRect(0, 0, size.width, size.height);

  const holeHidden = !state.dealer[0]!.faceUp;
  drawLabel(ctx, layout, 'Dealer', holeHidden ? null : handValue(state.dealer), isBust(state.dealer), layout.dealerY);
  drawLabel(ctx, layout, 'You', handValue(state.player), isBust(state.player), layout.playerY);

  const renderContext: Canvas2DRenderContext = { atlases, ctx2d: ctx, world };
  renderer.render(renderContext);

  const message = roundMessage(state);
  if (message !== null && state.result !== null)
    drawBanner(ctx, size.width, size.height, Math.round(layout.cardH * 0.9), message, BANNER_COLORS[state.result]);
}

/** "Name: value", with "Bust" spelled out so a bust never relies on the label color. */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  layout: BlackjackLayout,
  name: string,
  value: number | null,
  bust: boolean,
  cardsY: number,
): void {
  ctx.fillStyle = bust ? '#ff8a80' : 'rgba(255,255,255,0.6)';
  ctx.font = `${Math.round(layout.cardH * 0.25)}px system-ui`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  let text = name;
  if (value !== null)
    text += `: ${value}`;
  if (bust)
    text += ' — Bust';
  ctx.fillText(text, layout.marginX, cardsY - 4);
}
