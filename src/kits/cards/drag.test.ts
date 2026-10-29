import type { Card } from './deck';
import type { CardPlacement } from './sprites';

import { describe, expect, it } from 'vitest';

import { DRAG_FAN_RATIO, DRAG_ORDER_BUMP } from './constants';
import { dragProbe, floatDraggedCards, rectContains } from './drag';

function card(id: number): Card {
  return { id, faceUp: true, rank: 5, suit: 'Spades' };
}

describe('rectContains', () => {
  const rect = { h: 20, w: 10, x: 5, y: 5 };

  it('includes the edges and excludes the outside', () => {
    expect(rectContains(rect, { x: 5, y: 5 })).toBe(true);
    expect(rectContains(rect, { x: 15, y: 25 })).toBe(true);
    expect(rectContains(rect, { x: 15.1, y: 10 })).toBe(false);
    expect(rectContains(rect, { x: 10, y: 4 })).toBe(false);
  });
});

describe('dragProbe', () => {
  it('is the middle of the first dragged card', () => {
    expect(dragProbe({ cards: [], position: { x: 10, y: 20 } }, { cardH: 100, cardW: 60 }))
      .toEqual({ x: 40, y: 70 });
  });
});

describe('floatDraggedCards', () => {
  it('fans the dragged cards at the pointer above the rest and skips unplaced ones', () => {
    const cards = [card(0), card(1), card(2)];
    const placements: CardPlacement[] = cards.map((c, i) => ({ card: c, order: i, x: 0, y: 0 }));
    floatDraggedCards(placements, { cards: [cards[1]!, cards[2]!, card(9)], position: { x: 30, y: 40 } }, 100);
    const fan = Math.round(100 * DRAG_FAN_RATIO);
    expect(placements[0]).toMatchObject({ order: 0, x: 0, y: 0 });
    expect(placements[1]).toMatchObject({ order: DRAG_ORDER_BUMP, x: 30, y: 40 });
    expect(placements[2]).toMatchObject({ order: DRAG_ORDER_BUMP + 1, x: 30, y: 40 + fan });
  });
});
