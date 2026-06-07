/**
 * Board rendering for Spider Solitaire.
 *
 * 10 tableau columns + stock pile + completed-run indicators.
 * Uses the shared card atlas and layout constants.
 */

import type { EcsWorld } from '@pierre/ecs';
import type { Canvas2DRenderContext } from '@pierre/ecs/modules/render-canvas2d';
import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { Card, GameState } from './game';

import { Canvas2DRenderer, RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';

import { BACKS_ATLAS, CARD_BACK_FRAME, CARD_H, CARD_W, cardFrame, CARDS_ATLAS } from '../../shared';
import {
  CANVAS_H,
  CANVAS_W,
  cardPosition,
  COLUMNS,
  columnSlotPosition,
  STOCK_DECK_H,
  STOCK_DECK_W,
  stockSlotPosition,
} from './game';

export const DRAG_ORDER_BUMP = 100_000;

const DRAG_FAN = 24;

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
  const positions = world.getStore(PositionDef);
  const renderables = world.getStore(RenderableDef);
  const orders = world.getStore(RenderOrderDef);
  let order = 0;

  const placeCard = (card: Card, x: number, y: number): void => {
    positions.set(card.id, { x, y });
    renderables.set(card.id, {
      anchor: 'top-left',
      atlas: card.faceUp ? CARDS_ATLAS : BACKS_ATLAS,
      dh: CARD_H,
      dw: CARD_W,
      frame: card.faceUp ? cardFrame(card.suit, card.rank) : CARD_BACK_FRAME,
      kind: 'sprite',
    });
    orders.set(card.id, { value: order++ });
  };

  // Stock cards — hidden off-screen
  state.stock.forEach((card, i) => {
    placeCard(card, -200, -200 + i * 2);
  });

  // Tableau cards (skip ones being dragged)
  const draggedIds = new Set(drag ? drag.cards.map(c => c.id) : []);
  state.tableau.forEach((column, col) => {
    column.forEach((card, i) => {
      if (draggedIds.has(card.id))
        return;
      const pos = cardPosition(state, col, i);
      placeCard(card, pos.x, pos.y);
    });
  });

  // Dragged cards — follow pointer
  if (drag) {
    drag.cards.forEach((card, i) => {
      placeCard(
        card,
        drag.pointerX - drag.grabX,
        drag.pointerY - drag.grabY + i * DRAG_FAN,
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
  ctx2d.fillStyle = '#0b3d2e';
  ctx2d.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stock pile — drawn as a small deck stack
  drawStockDeck(ctx2d, stockSlotPosition(), state.stock.length);

  // Completion counter
  drawCompletionCounter(ctx2d, state.completed);

  // Empty tableau slots
  for (let col = 0; col < COLUMNS; col++) {
    if (state.tableau[col]!.length === 0)
      drawSlot(ctx2d, columnSlotPosition(col), '');
  }

  const renderCtx: Canvas2DRenderContext = { atlases, ctx2d, world };
  renderer.render(renderCtx);

  if (state.won)
    drawBanner(ctx2d);
}

function drawStockDeck(
  ctx2d: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  count: number,
): void {
  const w = STOCK_DECK_W;
  const h = STOCK_DECK_H;

  // Draw 3 offset rectangles to suggest a stack of cards
  for (let i = 2; i >= 0; i--) {
    const ox = pos.x + i * 2;
    const oy = pos.y + i * 2;
    ctx2d.fillStyle = i === 0 ? '#1a3a5c' : '#15304d';
    roundRect(ctx2d, ox, oy, w, h, 6);
    ctx2d.fill();
    ctx2d.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx2d.lineWidth = 1;
    ctx2d.stroke();
  }

  // Count label
  ctx2d.fillStyle = 'rgba(255,255,255,0.6)';
  ctx2d.font = '13px system-ui';
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'top';
  ctx2d.fillText(count > 0 ? `${count}` : '↻', pos.x + w / 2, pos.y + h + 4);
}

function drawCompletionCounter(
  ctx2d: CanvasRenderingContext2D,
  completed: number,
): void {
  const x = 160;
  const y = 20;
  ctx2d.fillStyle = 'rgba(255,255,255,0.45)';
  ctx2d.font = '16px system-ui';
  ctx2d.textAlign = 'left';
  ctx2d.textBaseline = 'middle';
  ctx2d.fillText(`🏆 Completed: ${completed}/8`, x, y + STOCK_DECK_H / 2);
}

function drawSlot(
  ctx2d: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  label: string,
): void {
  roundRect(ctx2d, pos.x, pos.y, CARD_W, CARD_H, 8);
  ctx2d.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx2d.lineWidth = 2;
  ctx2d.stroke();
  if (label !== '') {
    ctx2d.fillStyle = 'rgba(255,255,255,0.3)';
    ctx2d.font = label === 'K♠' ? '20px system-ui' : '24px system-ui';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillText(label, pos.x + CARD_W / 2, pos.y + CARD_H / 2);
  }
}

function drawBanner(ctx2d: CanvasRenderingContext2D): void {
  ctx2d.fillStyle = 'rgba(0,0,0,0.6)';
  ctx2d.fillRect(0, CANVAS_H / 2 - 60, CANVAS_W, 120);
  ctx2d.fillStyle = '#ffe14d';
  ctx2d.font = '700 56px system-ui';
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  ctx2d.fillText('You win!', CANVAS_W / 2, CANVAS_H / 2);
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
