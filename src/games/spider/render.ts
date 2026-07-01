/**
 * Board rendering for Spider Solitaire — dynamic layout.
 */

import type { EcsWorld } from '@pierre/ecs';
import type { Canvas2DRenderContext } from '@pierre/ecs/modules/render-canvas2d';
import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { CardLayout } from '../../shared/layout';
import type { Card, GameState } from './game';

import { Canvas2DRenderer, RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';

import { BACKS_ATLAS, CARD_BACK_FRAME, cardFrame, CARDS_ATLAS, DRAG_FAN_RATIO, DRAG_ORDER_BUMP, OFF_SCREEN_X, OFF_SCREEN_Y, OFF_SCREEN_Y_STEP } from '../../shared';
import {
  cardPosition,
  COLUMNS,
  columnSlotPosition,
  STOCK_DECK_H_RATIO,
  STOCK_DECK_W_RATIO,
  stockSlotPosition,
} from './game';

export { DRAG_ORDER_BUMP } from '../../shared';

export interface DragOverride {
  cards: Card[];
  fromCol: number;
  fromIndex: number;
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

  const placeCard = (card: Card, x: number, y: number): void => {
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
  };

  state.stock.forEach((card, i) => {
    placeCard(card, OFF_SCREEN_X, OFF_SCREEN_Y + i * OFF_SCREEN_Y_STEP);
  });

  const draggedIds = new Set(drag ? drag.cards.map(c => c.id) : []);
  state.tableau.forEach((column, col) => {
    column.forEach((card, i) => {
      if (draggedIds.has(card.id))
        return;
      const pos = cardPosition(state, col, i);
      placeCard(card, pos.x, pos.y);
    });
  });

  if (drag) {
    const dragFan = Math.round(layout.cardH * DRAG_FAN_RATIO);
    drag.cards.forEach((card, i) => {
      placeCard(
        card,
        drag.pointerX - drag.grabX,
        drag.pointerY - drag.grabY + i * dragFan,
      );
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

  drawStockDeck(ctx2d, layout, state.stock.length);
  drawCompletionCounter(ctx2d, layout, state.completed);

  for (let col = 0; col < COLUMNS; col++) {
    if (state.tableau[col]!.length === 0)
      drawSlot(ctx2d, layout, columnSlotPosition(layout, col), '');
  }

  const renderCtx: Canvas2DRenderContext = { atlases, ctx2d, world };
  renderer.render(renderCtx);

  if (state.won)
    drawBanner(ctx2d, layout);
}

function drawStockDeck(
  ctx2d: CanvasRenderingContext2D,
  layout: CardLayout,
  count: number,
): void {
  const pos = stockSlotPosition(layout);
  const w = Math.round(layout.cardW * STOCK_DECK_W_RATIO);
  const h = Math.round(layout.cardH * STOCK_DECK_H_RATIO);

  for (let i = 2; i >= 0; i--) {
    const ox = pos.x + i * 2;
    const oy = pos.y + i * 2;
    ctx2d.fillStyle = i === 0 ? '#1a3a5c' : '#15304d';
    roundRect(ctx2d, ox, oy, w, h, Math.round(w * 0.1));
    ctx2d.fill();
    ctx2d.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx2d.lineWidth = 1;
    ctx2d.stroke();
  }

  ctx2d.fillStyle = 'rgba(255,255,255,0.6)';
  ctx2d.font = `${Math.round(h * 0.15)}px system-ui`;
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'top';
  ctx2d.fillText(count > 0 ? `${count}` : '↻', pos.x + w / 2, pos.y + h + 4);
}

function drawCompletionCounter(
  ctx2d: CanvasRenderingContext2D,
  layout: CardLayout,
  completed: number,
): void {
  const x = layout.marginX + layout.colPitch + Math.round(layout.cardW * 0.2);
  const y = layout.topY + Math.round(layout.cardH * STOCK_DECK_H_RATIO / 2);
  ctx2d.fillStyle = 'rgba(255,255,255,0.45)';
  ctx2d.font = `${Math.round(layout.cardH * 0.2)}px system-ui`;
  ctx2d.textAlign = 'left';
  ctx2d.textBaseline = 'middle';
  ctx2d.fillText(`🏆 Completed: ${completed}/8`, x, y);
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
