/**
 * Solitaire's view: where every pile and card sits for a canvas size, hit
 * testing, the sprites and slots drawn each frame, and the victory animation.
 * It reads the rules' state and never changes it.
 */

import type { EcsWorld } from '@pierre/ecs';
import type { Canvas2DRenderContext } from '@pierre/ecs/modules/render-canvas2d';
import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { Point, Size } from '../../core';
import type { Card, CardPlacement, TableLayout } from '../../kits/cards';
import type { PileRef, SolitaireState } from './rules';

import { Canvas2DRenderer } from '@pierre/ecs/modules/render-canvas2d';

import { drawBanner, drawSlot } from '../../core';
import {
  computeTableLayout,
  DRAG_FAN_RATIO,
  DRAG_ORDER_BUMP,
  fanColumn,
} from '../../kits/cards';
import { FOUNDATIONS, TABLEAU_COLUMNS } from './rules';

export interface Rect {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface DropZone {
  pile: PileRef;
  rect: Rect;
}

/** Cards being dragged: the top-left of the first one, and the cards in order. */
export interface DragView {
  cards: readonly Card[];
  position: Point;
}

export interface VictoryCard {
  card: Card;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

const TABLE_COLOR = '#0b3d2e';
const FOUNDATION_FIRST_COLUMN = 3;
/** How far below its last card a column still takes a drop (fraction of card height). */
const DROP_REACH_BELOW = 0.4;
/** Paint order of the victory cards, above everything else. */
const VICTORY_ORDER = 200_000;

const renderer = new Canvas2DRenderer();

export function solitaireLayout(size: Size): TableLayout {
  return computeTableLayout(size.width, size.height, TABLEAU_COLUMNS);
}

function columnX(layout: TableLayout, column: number): number {
  return layout.marginX + column * layout.colPitch;
}

/** Top-left of a pile's first card position. */
export function slotPosition(layout: TableLayout, pile: PileRef): Point {
  switch (pile.kind) {
    case 'foundation':
      return { x: columnX(layout, FOUNDATION_FIRST_COLUMN + pile.index), y: layout.topY };
    case 'stock':
      return { x: columnX(layout, 0), y: layout.topY };
    case 'tableau':
      return { x: columnX(layout, pile.index), y: layout.tableauTop };
    case 'waste':
      return { x: columnX(layout, 1), y: layout.topY };
  }
}

function tableauYs(state: SolitaireState, layout: TableLayout, column: number): number[] {
  return fanColumn(state.tableau[column]!, layout.tableauTop, layout.tableauBottom, layout.cardH);
}

/** Top-left of the card at `index` in `pile`. */
export function cardPoint(
  state: SolitaireState,
  layout: TableLayout,
  pile: PileRef,
  index: number,
): Point {
  const base = slotPosition(layout, pile);
  if (pile.kind !== 'tableau')
    return base;
  return { x: base.x, y: tableauYs(state, layout, pile.index)[index] ?? base.y };
}

export function rectContains(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w
    && point.y >= rect.y && point.y <= rect.y + rect.h;
}

/** The pickable card under `point` (topmost first): its pile and index. */
export function pickCard(
  state: SolitaireState,
  layout: TableLayout,
  point: Point,
): { index: number; pile: PileRef } | null {
  const { cardH, cardW } = layout;
  const hit = (at: Point): boolean => rectContains({ h: cardH, w: cardW, x: at.x, y: at.y }, point);

  for (let col = TABLEAU_COLUMNS - 1; col >= 0; col--) {
    const ys = tableauYs(state, layout, col);
    const x = slotPosition(layout, { index: col, kind: 'tableau' }).x;
    for (let i = ys.length - 1; i >= 0; i--) {
      if (hit({ x, y: ys[i]! }))
        return { index: i, pile: { index: col, kind: 'tableau' } };
    }
  }
  for (let f = FOUNDATIONS - 1; f >= 0; f--) {
    const pile: PileRef = { index: f, kind: 'foundation' };
    const size = state.foundations[f]!.length;
    if (size > 0 && hit(slotPosition(layout, pile)))
      return { index: size - 1, pile };
  }
  const wasteSize = state.waste.length;
  const waste: PileRef = { index: 0, kind: 'waste' };
  if (wasteSize > 0 && hit(slotPosition(layout, waste)))
    return { index: wasteSize - 1, pile: waste };
  return null;
}

export function isOverStock(layout: TableLayout, point: Point): boolean {
  const { x, y } = slotPosition(layout, { index: 0, kind: 'stock' });
  return rectContains({ h: layout.cardH, w: layout.cardW, x, y }, point);
}

/** Where a dragged card can land, highest priority first: the foundations, then the columns. */
export function dropZones(state: SolitaireState, layout: TableLayout): DropZone[] {
  const { cardH, cardW } = layout;
  const zones: DropZone[] = [];
  for (let f = 0; f < FOUNDATIONS; f++) {
    const pile: PileRef = { index: f, kind: 'foundation' };
    const { x, y } = slotPosition(layout, pile);
    zones.push({ pile, rect: { h: cardH, w: cardW, x, y } });
  }
  for (let col = 0; col < TABLEAU_COLUMNS; col++) {
    const pile: PileRef = { index: col, kind: 'tableau' };
    const ys = tableauYs(state, layout, col);
    const { x, y } = slotPosition(layout, pile);
    const bottom = (ys.at(-1) ?? y) + cardH + cardH * DROP_REACH_BELOW;
    zones.push({ pile, rect: { h: bottom - y, w: cardW, x, y } });
  }
  return zones;
}

/** The point tested against the drop zones: the middle of the first dragged card. */
export function dragProbe(drag: DragView, layout: TableLayout): Point {
  return { x: drag.position.x + layout.cardW / 2, y: drag.position.y + layout.cardH / 2 };
}

/** Every card's sprite position and paint order; dragged cards float above, fanned. */
export function placements(
  state: SolitaireState,
  layout: TableLayout,
  drag: DragView | null,
): CardPlacement[] {
  const result: CardPlacement[] = [];
  let order = 0;
  const place = (card: Card, at: Point): void => {
    result.push({ card, order: order++, x: at.x, y: at.y });
  };

  const stock = slotPosition(layout, { index: 0, kind: 'stock' });
  for (const card of state.stock) place(card, stock);
  const waste = slotPosition(layout, { index: 0, kind: 'waste' });
  for (const card of state.waste) place(card, waste);
  state.foundations.forEach((pile, f) => {
    const at = slotPosition(layout, { index: f, kind: 'foundation' });
    for (const card of pile) place(card, at);
  });
  state.tableau.forEach((pile, col) => {
    const ys = tableauYs(state, layout, col);
    const x = slotPosition(layout, { index: col, kind: 'tableau' }).x;
    pile.forEach((card, i) => place(card, { x, y: ys[i]! }));
  });

  if (drag) {
    const fan = Math.round(layout.cardH * DRAG_FAN_RATIO);
    const byId = new Map(result.map(p => [p.card.id, p]));
    drag.cards.forEach((card, i) => {
      const placement = byId.get(card.id);
      if (!placement)
        return;
      placement.x = drag.position.x;
      placement.y = drag.position.y + i * fan;
      placement.order = DRAG_ORDER_BUMP + i;
    });
  }
  return result;
}

/** Draws the table: background, empty slots, the card sprites and the win banner. */
export function drawTable(
  ctx: CanvasRenderingContext2D,
  size: Size,
  layout: TableLayout,
  state: SolitaireState,
  world: EcsWorld,
  atlases: TextureAtlasRegistry,
  won: boolean,
): void {
  const { cardH, cardW } = layout;
  ctx.fillStyle = TABLE_COLOR;
  ctx.fillRect(0, 0, size.width, size.height);

  drawSlot(ctx, slotPosition(layout, { index: 0, kind: 'stock' }), cardW, cardH, {
    label: state.stock.length === 0 ? '↻' : '',
  });
  drawSlot(ctx, slotPosition(layout, { index: 0, kind: 'waste' }), cardW, cardH);
  for (let f = 0; f < FOUNDATIONS; f++)
    drawSlot(ctx, slotPosition(layout, { index: f, kind: 'foundation' }), cardW, cardH, { label: 'A' });
  state.tableau.forEach((pile, col) => {
    if (pile.length === 0)
      drawSlot(ctx, slotPosition(layout, { index: col, kind: 'tableau' }), cardW, cardH);
  });

  const renderContext: Canvas2DRenderContext = { atlases, ctx2d: ctx, world };
  renderer.render(renderContext);

  if (won)
    drawBanner(ctx, size.width, size.height, Math.round(cardH * 1.1), 'You win!');
}

// --- Victory animation ---

/** Cards start at their foundation spot and fly up and sideways at random. */
export function startVictory(
  state: SolitaireState,
  layout: TableLayout,
  random: () => number = Math.random,
): VictoryCard[] {
  const cards: VictoryCard[] = [];
  state.foundations.forEach((pile, f) => {
    const at = slotPosition(layout, { index: f, kind: 'foundation' });
    for (const card of pile) {
      cards.push({
        card,
        vx: (random() - 0.5) * layout.cardW * 0.3,
        vy: -layout.cardH * (0.2 + random() * 0.3),
        x: at.x,
        y: at.y,
      });
    }
  });
  return cards;
}

/** Advances every card one frame: gravity, bounces off the floor and walls, friction on the floor. */
export function stepVictory(cards: VictoryCard[], size: Size, layout: TableLayout): void {
  const floor = size.height - layout.cardH;
  const rightWall = size.width - layout.cardW;
  for (const v of cards) {
    v.vy += layout.cardH * 0.015;
    v.x += v.vx;
    v.y += v.vy;
    if (v.y > floor) {
      v.y = floor;
      v.vy *= -0.5;
      if (Math.abs(v.vy) < 1) {
        v.vy = 0;
        // Resting on the floor: slide to a stop so the animation ends.
        v.vx *= 0.9;
        if (Math.abs(v.vx) < 0.05)
          v.vx = 0;
      }
    }
    if (v.x < 0) {
      v.x = 0;
      v.vx *= -0.5;
    }
    if (v.x > rightWall) {
      v.x = rightWall;
      v.vx *= -0.5;
    }
  }
}

/** Whether any victory card is still moving. */
export function victoryMoving(cards: readonly VictoryCard[], size: Size, layout: TableLayout): boolean {
  const floor = size.height - layout.cardH;
  return cards.some(v => v.vx !== 0 || v.vy !== 0 || v.y < floor);
}

export function victoryPlacements(cards: readonly VictoryCard[]): CardPlacement[] {
  return cards.map((v, i) => ({ card: v.card, order: VICTORY_ORDER + i, x: v.x, y: v.y }));
}
