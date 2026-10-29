import type { SolitaireState } from './rules';

import { describe, expect, it } from 'vitest';

import { solitaireRules } from './rules';
import {
  cardPoint,
  dropZones,
  pickCard,
  placements,
  slotPosition,
  solitaireLayout,
  startVictory,
  stepVictory,
  victoryMoving,
} from './view';

const SIZE = { height: 700, width: 1000 };

function dealt(): SolitaireState {
  return solitaireRules.setup(11, undefined, 0);
}

describe('layout and picking', () => {
  it('places one sprite per card with distinct paint orders', () => {
    const state = dealt();
    const list = placements(state, solitaireLayout(SIZE), null);
    expect(list).toHaveLength(52);
    expect(new Set(list.map(p => p.order)).size).toBe(52);
  });

  it('keeps the last card of a deep column inside the canvas (B15)', () => {
    const state = dealt();
    const deep = [...state.stock.slice(0, 20).map(c => ({ ...c, faceUp: true })), ...state.tableau[6]!];
    state.tableau[6] = deep;
    const layout = solitaireLayout({ height: 400, width: 1000 });
    const last = cardPoint(state, layout, { index: 6, kind: 'tableau' }, deep.length - 1);
    expect(last.y + layout.cardH).toBeLessThanOrEqual(400);
  });

  it('picks the top card of a column and the waste, and nothing on empty felt', () => {
    const state = dealt();
    state.waste = [state.stock.pop()!];
    state.waste[0]!.faceUp = true;
    const layout = solitaireLayout(SIZE);

    const top = state.tableau[3]!.length - 1;
    const at = cardPoint(state, layout, { index: 3, kind: 'tableau' }, top);
    const hit = pickCard(state, layout, { x: at.x + 5, y: at.y + 5 });
    expect(hit).toEqual({ index: top, pile: { index: 3, kind: 'tableau' } });

    const waste = slotPosition(layout, { index: 0, kind: 'waste' });
    expect(pickCard(state, layout, { x: waste.x + 5, y: waste.y + 5 })?.pile.kind).toBe('waste');
    expect(pickCard(state, layout, { x: 1, y: 1 })).toBeNull();
  });

  it('lists foundations before columns as drop zones', () => {
    const zones = dropZones(dealt(), solitaireLayout(SIZE));
    expect(zones.map(z => z.pile.kind)).toEqual([
      'foundation',
      'foundation',
      'foundation',
      'foundation',
      'tableau',
      'tableau',
      'tableau',
      'tableau',
      'tableau',
      'tableau',
      'tableau',
    ]);
  });

  it('lifts dragged cards above the table, fanned from the drag position', () => {
    const state = dealt();
    const layout = solitaireLayout(SIZE);
    const col = state.tableau[6]!;
    const cards = col.slice(-2);
    const list = placements(state, layout, { cards, position: { x: 50, y: 60 } });
    const first = list.find(p => p.card.id === cards[0]!.id)!;
    const second = list.find(p => p.card.id === cards[1]!.id)!;
    expect(first).toMatchObject({ x: 50, y: 60 });
    expect(second.y).toBeGreaterThan(first.y);
    expect(second.order).toBeGreaterThan(first.order);
    expect(first.order).toBeGreaterThan(51);
  });
});

describe('victory animation', () => {
  it('settles so no further frames are needed', () => {
    const state = dealt();
    state.foundations = [[], [], [], []];
    state.foundations[0] = state.tableau.flat().slice(0, 6);
    const layout = solitaireLayout(SIZE);
    const cards = startVictory(state, layout, () => 0.5);
    expect(victoryMoving(cards, SIZE, layout)).toBe(true);

    let frames = 0;
    while (victoryMoving(cards, SIZE, layout) && frames < 5000) {
      stepVictory(cards, SIZE, layout);
      frames++;
    }
    expect(frames).toBeLessThan(5000);
    for (const v of cards) {
      expect(v.y).toBeLessThanOrEqual(SIZE.height - layout.cardH);
      expect(v.x).toBeGreaterThanOrEqual(0);
    }
  });
});
