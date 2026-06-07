/**
 * Board rendering for Solitaire (Klondike) — dynamic layout.
 */

import type { EcsWorld } from '@pierre/ecs';
import type { Canvas2DRenderContext } from '@pierre/ecs/modules/render-canvas2d';
import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { CardLayout } from '../../shared/layout';
import type { Card, GameState, PileRef } from './game';

import { Canvas2DRenderer, RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';

import { BACKS_ATLAS, CARD_BACK_FRAME, cardFrame, CARDS_ATLAS } from '../../shared';
import { cardPosition, slotPosition } from './game';

export const DRAG_ORDER_BUMP = 100_000;

const DRAG_FAN_RATIO = 0.3; // vertical fan between dragged cards as fraction of card height

export interface DragOverride {
  cards: Card[];
  grabX: number;
  grabY: number;
  pointerX: number;
  pointerY: number;
}

const renderer = new Canvas2DRenderer();

export function syncLayout(world: EcsWorld, state: GameState, drag?: DragOverride | null): void {
  const { layout } = state;
  const positions = world.getStore(PositionDef);
  const renderables = world.getStore(RenderableDef);
  const orders = world.getStore(RenderOrderDef);
  let order = 0;

  const place = (card: Card, pile: PileRef, index: number): void => {
    const pos = cardPosition(state, pile, index);
    positions.set(card.id, pos);
    renderables.set(card.id, {
      anchor: 'top-left',
      atlas: card.faceUp ? CARDS_ATLAS : BACKS_ATLAS,
      dh: layout.cardH,
      dw: layout.cardW,
      frame: card.faceUp ? cardFrame(card.suit, card.rank) : CARD_BACK_FRAME,
      kind: 'sprite',
    });
    orders.set(card.id, { value: order++ });
  };

  state.stock.forEach((card, i) => place(card, { index: 0, kind: 'stock' }, i));
  state.waste.forEach((card, i) => place(card, { index: 0, kind: 'waste' }, i));
  state.foundations.forEach((pile, f) =>
    pile.forEach((card, i) => place(card, { index: f, kind: 'foundation' }, i)));
  state.tableau.forEach((pile, t) =>
    pile.forEach((card, i) => place(card, { index: t, kind: 'tableau' }, i)));

  if (drag) {
    const dragFan = Math.round(layout.cardH * DRAG_FAN_RATIO);
    drag.cards.forEach((card, i) => {
      positions.set(card.id, {
        x: drag.pointerX - drag.grabX,
        y: drag.pointerY - drag.grabY + i * dragFan,
      });
      orders.set(card.id, { value: DRAG_ORDER_BUMP + i });
    });
  }
}

export function renderFrame(
  ctx2d: CanvasRenderingContext2D,
  world: EcsWorld,
  atlases: TextureAtlasRegistry,
  state: GameState,
): void {
  const { layout } = state;
  ctx2d.fillStyle = '#0b3d2e';
  ctx2d.fillRect(0, 0, layout.canvasW, layout.canvasH);

  drawSlot(ctx2d, layout, slotPosition(layout, { index: 0, kind: 'stock' }), state.stock.length === 0 ? '↻' : '');
  drawSlot(ctx2d, layout, slotPosition(layout, { index: 0, kind: 'waste' }), '');
  for (let f = 0; f < 4; f++)
    drawSlot(ctx2d, layout, slotPosition(layout, { index: f, kind: 'foundation' }), 'A');
  for (let t = 0; t < 7; t++) {
    if (state.tableau[t]!.length === 0)
      drawSlot(ctx2d, layout, slotPosition(layout, { index: t, kind: 'tableau' }), '');
  }

  const renderCtx: Canvas2DRenderContext = { atlases, ctx2d, world };
  renderer.render(renderCtx);

  if (state.won)
    drawBanner(ctx2d, layout);
}

function drawSlot(
  ctx2d: CanvasRenderingContext2D,
  layout: CardLayout,
  pos: { x: number; y: number },
  label: string,
): void {
  const r = Math.round(layout.cardW * 0.1);
  roundRect(ctx2d, pos.x, pos.y, layout.cardW, layout.cardH, r);
  ctx2d.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx2d.lineWidth = Math.max(1, Math.round(layout.cardW / 40));
  ctx2d.stroke();
  if (label !== '') {
    ctx2d.fillStyle = 'rgba(255,255,255,0.3)';
    ctx2d.font = `${Math.round(layout.cardH * 0.25)}px system-ui`;
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillText(label, pos.x + layout.cardW / 2, pos.y + layout.cardH / 2);
  }
}

function drawBanner(ctx2d: CanvasRenderingContext2D, layout: CardLayout): void {
  const cy = layout.canvasH / 2;
  const bh = Math.round(layout.cardH * 1.1);
  ctx2d.fillStyle = 'rgba(0,0,0,0.6)';
  ctx2d.fillRect(0, cy - bh / 2, layout.canvasW, bh);
  ctx2d.fillStyle = '#ffe14d';
  ctx2d.font = `700 ${Math.round(bh * 0.5)}px system-ui`;
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  ctx2d.fillText('You win!', layout.canvasW / 2, cy);
}

function roundRect(
  ctx2d: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx2d.beginPath();
  ctx2d.moveTo(x + r, y);
  ctx2d.arcTo(x + w, y, x + w, y + h, r);
  ctx2d.arcTo(x + w, y + h, x, y + h, r);
  ctx2d.arcTo(x, y + h, x, y, r);
  ctx2d.arcTo(x, y, x + w, y, r);
  ctx2d.closePath();
}
