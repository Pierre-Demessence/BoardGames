/**
 * Geometry shared by the card games' drag and drop: rectangles for drop zones,
 * the point tested against them, and the floating fan of dragged cards.
 */

import type { Card } from './deck';
import type { Point } from './layout';
import type { CardPlacement } from './sprites';

import { DRAG_FAN_RATIO, DRAG_ORDER_BUMP } from './constants';

export interface Rect {
  h: number;
  w: number;
  x: number;
  y: number;
}

/** Cards being dragged: the top-left of the first one, and the cards in order. */
export interface DragView {
  cards: readonly Card[];
  position: Point;
}

export function rectContains(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w
    && point.y >= rect.y && point.y <= rect.y + rect.h;
}

/** The point tested against the drop zones: the middle of the first dragged card. */
export function dragProbe(drag: DragView, size: { cardH: number; cardW: number }): Point {
  return { x: drag.position.x + size.cardW / 2, y: drag.position.y + size.cardH / 2 };
}

/**
 * Moves the placements of the dragged cards to float at the pointer, fanned
 * downwards and painted above everything else. Cards without a placement are
 * ignored.
 */
export function floatDraggedCards(
  placements: readonly CardPlacement[],
  drag: DragView,
  cardH: number,
): void {
  const fan = Math.round(cardH * DRAG_FAN_RATIO);
  const byId = new Map(placements.map(p => [p.card.id, p]));
  drag.cards.forEach((card, i) => {
    const placement = byId.get(card.id);
    if (!placement)
      return;
    placement.x = drag.position.x;
    placement.y = drag.position.y + i * fan;
    placement.order = DRAG_ORDER_BUMP + i;
  });
}
