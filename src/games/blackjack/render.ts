/**
 * Board rendering for Blackjack — two rows of cards.
 */

import type { EcsWorld } from '@pierre/ecs';
import type { Canvas2DRenderContext } from '@pierre/ecs/modules/render-canvas2d';
import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { CardLayout } from '../../shared/layout';
import type { Card, GameState } from './game';

import { Canvas2DRenderer, RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';

import { BACKS_ATLAS, CARD_BACK_FRAME, HAND_CARD_OVERLAP as CARD_OVERLAP, cardFrame, CARDS_ATLAS, OFF_SCREEN_X, OFF_SCREEN_Y, OFF_SCREEN_Y_STEP } from '../../shared';
import { handValue, isBust } from './game';

const renderer = new Canvas2DRenderer();

export function syncLayout(world: EcsWorld, state: GameState): void {
  const { layout } = state;
  const positions = world.getStore(PositionDef);
  const renderables = world.getStore(RenderableDef);
  const orders = world.getStore(RenderOrderDef);
  let order = 0;

  const placeHand = (hand: Card[], y: number): void => {
    const totalW = hand.length === 1
      ? layout.cardW
      : layout.cardW + (hand.length - 1) * Math.round(layout.cardW * CARD_OVERLAP);
    const startX = (layout.canvasW - totalW) / 2;

    hand.forEach((card, i) => {
      const x = startX + i * Math.round(layout.cardW * CARD_OVERLAP);
      positions.set(card.id, { x, y });
      renderables.set(card.id, {
        anchor: 'top-left',
        atlas: card.faceUp ? CARDS_ATLAS : BACKS_ATLAS,
        dh: layout.cardH,
        dw: layout.cardW,
        frame: card.faceUp ? cardFrame(card.suit, card.rank) : CARD_BACK_FRAME,
        kind: 'sprite',
      });
      orders.set(card.id, { value: order++ });
    });
  };

  // Dealer at top, player at bottom
  const dealerY = layout.topY + layout.cardH * 0.5;
  const playerY = layout.canvasH - layout.cardH * 2;

  placeHand(state.dealerHand, dealerY);
  placeHand(state.playerHand, playerY);

  // Deck cards — off-screen
  state.deck.forEach((card, i) => {
    positions.set(card.id, { x: OFF_SCREEN_X, y: OFF_SCREEN_Y + i * OFF_SCREEN_Y_STEP });
    renderables.set(card.id, {
      anchor: 'top-left',
      atlas: BACKS_ATLAS,
      dh: layout.cardH,
      dw: layout.cardW,
      frame: CARD_BACK_FRAME,
      kind: 'sprite',
    });
    orders.set(card.id, { value: order++ });
  });
}

export function renderFrame(
  ctx2d: CanvasRenderingContext2D,
  world: EcsWorld,
  atlases: TextureAtlasRegistry,
  state: GameState,
): void {
  const { layout } = state;
  ctx2d.fillStyle = '#0b5e3a';
  ctx2d.fillRect(0, 0, layout.canvasW, layout.canvasH);

  // Dealer label + value
  const dealerVal = state.dealerHand[0]!.faceUp || state.status === 'roundOver'
    ? handValue(state.dealerHand)
    : null;
  drawLabel(ctx2d, layout, 'Dealer', dealerVal, layout.topY + layout.cardH * 0.5, isBust(state.dealerHand));

  // Player label + value
  drawLabel(ctx2d, layout, 'You', handValue(state.playerHand), layout.canvasH - layout.cardH * 2, isBust(state.playerHand));

  const renderCtx: Canvas2DRenderContext = { atlases, ctx2d, world };
  renderer.render(renderCtx);

  // Result banner
  if (state.status === 'roundOver' && state.message) {
    drawBanner(ctx2d, layout, state.message, state.result);
  }
}

function drawLabel(
  ctx2d: CanvasRenderingContext2D,
  layout: CardLayout,
  label: string,
  value: number | null,
  y: number,
  bust: boolean,
): void {
  const x = layout.marginX;
  ctx2d.fillStyle = bust ? '#f88' : 'rgba(255,255,255,0.5)';
  ctx2d.font = `${Math.round(layout.cardH * 0.25)}px system-ui`;
  ctx2d.textAlign = 'left';
  ctx2d.textBaseline = 'bottom';
  const text = value !== null ? `${label}: ${value}` : label;
  ctx2d.fillText(text, x, y - 4);
}

function drawBanner(
  ctx2d: CanvasRenderingContext2D,
  layout: CardLayout,
  message: string,
  result: string | null,
): void {
  const cy = layout.canvasH / 2;
  const bh = Math.round(layout.cardH * 1.2);
  ctx2d.fillStyle = 'rgba(0,0,0,0.7)';
  ctx2d.fillRect(0, cy - bh / 2, layout.canvasW, bh);

  let color = '#ffe14d';
  if (result === 'lose')
    color = '#f66';
  else if (result === 'push')
    color = '#aac';

  ctx2d.fillStyle = color;
  ctx2d.font = `700 ${Math.round(bh * 0.35)}px system-ui`;
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  ctx2d.fillText(message, layout.canvasW / 2, cy);
}
