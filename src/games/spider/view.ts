/**
 * Spider's view: where every column and card sits for a canvas size, hit
 * testing, and the stock, slots and sprites drawn each frame. It reads the
 * rules' state and never changes it.
 */

import type { EcsWorld } from '@pierre/ecs';
import type { Canvas2DRenderContext } from '@pierre/ecs/modules/render-canvas2d';
import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { Point, Size } from '../../core';
import type { CardPlacement, DragView, Rect, TableLayout } from '../../kits/cards';
import type { SpiderState } from './rules';

import { Canvas2DRenderer } from '@pierre/ecs/modules/render-canvas2d';

import { drawBanner, drawSlot, roundRect } from '../../core';
import { computeTableLayout, fanColumn, floatDraggedCards, rectContains } from '../../kits/cards';
import { COLUMNS, RUNS_TO_WIN } from './rules';

export interface DropZone {
  column: number;
  rect: Rect;
}

const TABLE_COLOR = '#0b3d2e';
/** Stock deck size relative to a card; a little taller to look like a stack. */
const STOCK_DECK_W_RATIO = 0.75;
const STOCK_DECK_H_RATIO = 1.05;
/** How far below its last card a column still takes a drop (fraction of card height). */
const DROP_REACH_BELOW = 0.4;

const renderer = new Canvas2DRenderer();

export function spiderLayout(size: Size): TableLayout {
  return computeTableLayout(size.width, size.height, COLUMNS);
}

function columnX(layout: TableLayout, column: number): number {
  return layout.marginX + column * layout.colPitch;
}

/** The area that deals from the stock when pressed. */
export function stockRect(layout: TableLayout): Rect {
  return {
    h: Math.round(layout.cardH * STOCK_DECK_H_RATIO),
    w: Math.round(layout.cardW * STOCK_DECK_W_RATIO),
    x: layout.marginX,
    y: layout.topY,
  };
}

function columnYs(state: SpiderState, layout: TableLayout, column: number): number[] {
  return fanColumn(state.tableau[column]!, layout.tableauTop, layout.tableauBottom, layout.cardH);
}

/** Top-left of the card at `index` in `column`. */
export function cardPoint(
  state: SpiderState,
  layout: TableLayout,
  column: number,
  index: number,
): Point {
  return { x: columnX(layout, column), y: columnYs(state, layout, column)[index] ?? layout.tableauTop };
}

/** The card under `point` (topmost first): its column and index. */
export function pickCard(
  state: SpiderState,
  layout: TableLayout,
  point: Point,
): { column: number; index: number } | null {
  const { cardH, cardW } = layout;
  for (let column = COLUMNS - 1; column >= 0; column--) {
    const ys = columnYs(state, layout, column);
    const x = columnX(layout, column);
    for (let i = ys.length - 1; i >= 0; i--) {
      if (rectContains({ h: cardH, w: cardW, x, y: ys[i]! }, point))
        return { column, index: i };
    }
  }
  return null;
}

/** Where a dragged run can land: one zone per column, down to just below its last card. */
export function dropZones(state: SpiderState, layout: TableLayout): DropZone[] {
  const { cardH, cardW } = layout;
  return Array.from({ length: COLUMNS }, (_, column) => {
    const x = columnX(layout, column);
    const bottom = (columnYs(state, layout, column).at(-1) ?? layout.tableauTop) + cardH + cardH * DROP_REACH_BELOW;
    return { column, rect: { h: bottom - layout.tableauTop, w: cardW, x, y: layout.tableauTop } };
  });
}

/** Every column card's sprite position and paint order; the stock is not placed, its deck is drawn instead. */
export function placements(
  state: SpiderState,
  layout: TableLayout,
  drag: DragView | null,
): CardPlacement[] {
  const result: CardPlacement[] = [];
  let order = 0;
  state.tableau.forEach((column, col) => {
    const ys = columnYs(state, layout, col);
    const x = columnX(layout, col);
    column.forEach((card, i) => result.push({ card, order: order++, x, y: ys[i]! }));
  });
  if (drag)
    floatDraggedCards(result, drag, layout.cardH);
  return result;
}

/** Draws the table: background, stock, completed counter, empty columns, the card sprites and the win banner. */
export function drawTable(
  ctx: CanvasRenderingContext2D,
  size: Size,
  layout: TableLayout,
  state: SpiderState,
  world: EcsWorld,
  atlases: TextureAtlasRegistry,
  won: boolean,
): void {
  const { cardH, cardW } = layout;
  ctx.fillStyle = TABLE_COLOR;
  ctx.fillRect(0, 0, size.width, size.height);

  drawStock(ctx, layout, state.stock.length);
  drawCompleted(ctx, layout, state.completed);

  state.tableau.forEach((column, col) => {
    if (column.length === 0)
      drawSlot(ctx, { x: columnX(layout, col), y: layout.tableauTop }, cardW, cardH);
  });

  const renderContext: Canvas2DRenderContext = { atlases, ctx2d: ctx, world };
  renderer.render(renderContext);

  if (won)
    drawBanner(ctx, size.width, size.height, Math.round(cardH * 1.1), 'You win!');
}

/** A stack of card backs with the card count; an empty stock is only an outline, since Spider never recycles it. */
function drawStock(ctx: CanvasRenderingContext2D, layout: TableLayout, count: number): void {
  const { h, w, x, y } = stockRect(layout);
  if (count === 0) {
    drawSlot(ctx, { x, y }, layout.cardW, layout.cardH);
    return;
  }
  for (let i = 2; i >= 0; i--) {
    ctx.fillStyle = i === 0 ? '#1a3a5c' : '#15304d';
    roundRect(ctx, x + i * 2, y + i * 2, w, h, Math.round(w * 0.1));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `${Math.round(h * 0.15)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${count}`, x + w / 2, y + h + 4);
}

function drawCompleted(ctx: CanvasRenderingContext2D, layout: TableLayout, completed: number): void {
  const x = layout.marginX + layout.colPitch + Math.round(layout.cardW * 0.2);
  const y = layout.topY + Math.round(layout.cardH * STOCK_DECK_H_RATIO / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `${Math.round(layout.cardH * 0.2)}px system-ui`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`🏆 Completed: ${completed}/${RUNS_TO_WIN}`, x, y);
}
