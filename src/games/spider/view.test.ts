import type { SpiderState } from './rules';

import { describe, expect, it } from 'vitest';

import { spiderRules } from './rules';
import { cardPoint, dropZones, pickCard, placements, spiderLayout, stockRect } from './view';

const SIZE = { height: 700, width: 1000 };

function dealt(): SpiderState {
  return spiderRules.setup(11, undefined, 0);
}

describe('layout and picking', () => {
  it('places one sprite per column card with distinct paint orders, and none for the stock', () => {
    const list = placements(dealt(), spiderLayout(SIZE), null);
    expect(list).toHaveLength(54);
    expect(new Set(list.map(p => p.order)).size).toBe(54);
  });

  it('keeps the last card of a 40-card column inside the canvas (B15)', () => {
    const state = dealt();
    const deep = [...state.stock.slice(0, 35).map(c => ({ ...c, faceUp: true })), ...state.tableau[9]!];
    state.tableau[9] = deep;
    for (const height of [400, 500, 700]) {
      const layout = spiderLayout({ height, width: 1000 });
      const last = cardPoint(state, layout, 9, deep.length - 1);
      expect(last.y + layout.cardH).toBeLessThanOrEqual(height);
    }
  });

  it('picks the top card of a column and nothing on empty felt', () => {
    const state = dealt();
    const layout = spiderLayout(SIZE);
    const top = state.tableau[3]!.length - 1;
    const at = cardPoint(state, layout, 3, top);
    expect(pickCard(state, layout, { x: at.x + 5, y: at.y + 5 })).toEqual({ column: 3, index: top });
    expect(pickCard(state, layout, { x: 1, y: 1 })).toBeNull();
  });

  it('has one drop zone per column, in column order', () => {
    const zones = dropZones(dealt(), spiderLayout(SIZE));
    expect(zones.map(z => z.column)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('keeps the stock area in the top row, above the columns', () => {
    const layout = spiderLayout(SIZE);
    const rect = stockRect(layout);
    expect(rect.y).toBe(layout.topY);
    expect(rect.y + rect.h).toBeLessThan(layout.tableauTop);
  });
});
