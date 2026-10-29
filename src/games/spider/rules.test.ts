import type { Card, SpiderMove, SpiderState } from './rules';

import { describe, expect, it } from 'vitest';

import { createSession } from '../../core';
import { canDragRun, canDropOnColumn, dealBlock, RUNS_TO_WIN, spiderRules } from './rules';

let nextId = 0;

function card(rank: number, faceUp = true): Card {
  return { id: nextId++, faceUp, rank, suit: 'Spades' };
}

function cards(...ranks: number[]): Card[] {
  return ranks.map(rank => card(rank));
}

/** K down to A, all face-up. */
function fullRun(): Card[] {
  return Array.from({ length: 13 }, (_, i) => card(13 - i));
}

function makeState(parts: Partial<SpiderState> = {}): SpiderState {
  return {
    completed: 0,
    stock: [],
    tableau: Array.from({ length: 10 }, () => []),
    ...parts,
  };
}

function withColumns(columns: Record<number, Card[]>, parts: Partial<SpiderState> = {}): SpiderState {
  const state = makeState(parts);
  for (const [col, column] of Object.entries(columns))
    state.tableau[Number(col)] = column;
  return state;
}

function move(from: number, index: number, to: number): SpiderMove {
  return { from, index, to, type: 'move' };
}

describe('setup', () => {
  it('deals 54 cards (6 in four columns, 5 in six), only the last of each face-up, and 50 to the stock', () => {
    const state = spiderRules.setup(42, undefined, 0);
    expect(state.tableau.map(col => col.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
    for (const col of state.tableau)
      expect(col.map(c => c.faceUp)).toEqual(col.map((_, i) => i === col.length - 1));
    expect(state.stock).toHaveLength(50);
    expect(state.stock.every(c => !c.faceUp)).toBe(true);
    expect(state.completed).toBe(0);
    const all = [...state.stock, ...state.tableau.flat()];
    expect(all.map(c => c.id).sort((a, b) => a - b)).toEqual(Array.from({ length: 104 }, (_, i) => i));
    expect(all.every(c => c.suit === 'Spades')).toBe(true);
    for (let rank = 1; rank <= 13; rank++)
      expect(all.filter(c => c.rank === rank)).toHaveLength(8);
  });

  it('deals the same cards for the same seed and different ones for another', () => {
    expect(spiderRules.setup(7, undefined, 0)).toEqual(spiderRules.setup(7, undefined, 0));
    expect(spiderRules.setup(7, undefined, 0)).not.toEqual(spiderRules.setup(8, undefined, 0));
  });

  it('is plain JSON: a round trip through JSON leaves the state unchanged', () => {
    const state = spiderRules.setup(3, undefined, 0);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    const dealt = spiderRules.apply(state, { type: 'deal' }, 0)!;
    expect(JSON.parse(JSON.stringify(dealt))).toEqual(dealt);
  });
});

describe('run rules', () => {
  it('picks up a face-up descending run of one suit and nothing else', () => {
    const column = [card(9, false), ...cards(5, 4, 3, 9, 8)];
    expect(canDragRun(column, 0)).toBe(false);
    expect(canDragRun(column, 1)).toBe(false);
    expect(canDragRun(column, 3)).toBe(false);
    expect(canDragRun(column, 4)).toBe(true);
    expect(canDragRun(column, 5)).toBe(true);
    expect(canDragRun(column, 6)).toBe(false);
    expect(canDragRun([card(5), card(4), card(3)], 0)).toBe(true);
    const mixed = [card(5), { ...card(4), suit: 'Hearts' as const }];
    expect(canDragRun(mixed, 0)).toBe(false);
  });

  it('drops on an empty column or on a card one rank higher, of any suit', () => {
    expect(canDropOnColumn(card(5), [])).toBe(true);
    expect(canDropOnColumn(card(5), cards(6))).toBe(true);
    expect(canDropOnColumn(card(5), cards(7))).toBe(false);
    expect(canDropOnColumn(card(5), cards(5))).toBe(false);
  });
});

describe('move', () => {
  it('moves a run, flips the card it uncovers and never mutates the input', () => {
    const state = withColumns({ 0: [card(9, false), ...cards(5, 4)], 1: cards(6) });
    const before = JSON.stringify(state);
    const next = spiderRules.apply(state, move(0, 1, 1), 0)!;
    expect(next.tableau[1]!.map(c => c.rank)).toEqual([6, 5, 4]);
    expect(next.tableau[0]!.map(c => [c.rank, c.faceUp])).toEqual([[9, true]]);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('moves onto an empty column', () => {
    const state = withColumns({ 0: cards(8, 7) });
    const next = spiderRules.apply(state, move(0, 1, 3), 0)!;
    expect(next.tableau[3]!.map(c => c.rank)).toEqual([7]);
  });

  it('refuses the same column, a wrong rank, a loose run, a face-down card and a bad index', () => {
    const state = withColumns({
      0: [card(9, false), ...cards(5), card(3)],
      1: cards(6),
      2: cards(2),
    });
    expect(spiderRules.apply(state, move(1, 0, 1), 0)).toBeNull();
    expect(spiderRules.apply(state, move(0, 3, 2), 0)).toBeNull();
    expect(spiderRules.apply(state, move(0, 1, 1), 0)).toBeNull();
    expect(spiderRules.apply(state, move(0, 0, 3), 0)).toBeNull();
    expect(spiderRules.apply(state, move(1, 5, 2), 0)).toBeNull();
    expect(spiderRules.apply(state, move(1, -1, 2), 0)).toBeNull();
    expect(spiderRules.apply(state, move(1, 0, 10), 0)).toBeNull();
    expect(spiderRules.apply(state, move(10, 0, 1), 0)).toBeNull();
  });
});

describe('completed runs', () => {
  it('takes a K-to-A run off the table when it forms, counts it and flips the card below', () => {
    const state = withColumns({
      0: [card(7, false), ...fullRun().slice(0, 12)],
      1: cards(1),
    });
    const next = spiderRules.apply(state, move(1, 0, 0), 0)!;
    expect(next.completed).toBe(1);
    expect(next.tableau[0]!.map(c => [c.rank, c.faceUp])).toEqual([[7, true]]);
    expect(next.tableau[1]).toEqual([]);
  });

  it('keeps a K-to-A run with a face-down card in it (B17)', () => {
    const run = fullRun();
    run[4] = { ...run[4]!, faceUp: false };
    const state = withColumns({ 0: run, 1: cards(5), 2: cards(6) });
    const next = spiderRules.apply(state, move(1, 0, 2), 0)!;
    expect(next.completed).toBe(0);
    expect(next.tableau[0]).toHaveLength(13);
  });

  it('keeps a run of mixed suits', () => {
    const run = fullRun();
    run[6] = { ...run[6]!, suit: 'Hearts' };
    const state = withColumns({ 0: run, 1: cards(5), 2: cards(6) });
    expect(spiderRules.apply(state, move(1, 0, 2), 0)!.completed).toBe(0);
  });

  it('wins at eight runs, after which no move is legal', () => {
    const state = withColumns(
      { 0: fullRun().slice(0, 12), 1: cards(1), 2: cards(3), 3: cards(2) },
      { completed: RUNS_TO_WIN - 1 },
    );
    expect(spiderRules.status(state)).toBe('playing');
    const won = spiderRules.apply(state, move(1, 0, 0), 0)!;
    expect(won.completed).toBe(RUNS_TO_WIN);
    expect(spiderRules.status(won)).toBe('won');
    expect(spiderRules.apply(won, move(3, 0, 2), 0)).toBeNull();
  });
});

describe('deal', () => {
  function dealable(): SpiderState {
    return makeState({
      stock: Array.from({ length: 20 }, () => card(2, false)),
      tableau: Array.from({ length: 10 }, () => cards(9)),
    });
  }

  it('puts one face-up card from the stock on every column', () => {
    const next = spiderRules.apply(dealable(), { type: 'deal' }, 0)!;
    expect(next.stock).toHaveLength(10);
    for (const column of next.tableau) {
      expect(column).toHaveLength(2);
      expect(column[1]!.faceUp).toBe(true);
    }
  });

  it('refuses with an empty column, and says why (B18)', () => {
    const state = dealable();
    state.tableau[4] = [];
    expect(spiderRules.apply(state, { type: 'deal' }, 0)).toBeNull();
    expect(dealBlock(state)).toBe('empty-column');
  });

  it('refuses with an empty stock, and says why', () => {
    const state = dealable();
    state.stock = [];
    expect(spiderRules.apply(state, { type: 'deal' }, 0)).toBeNull();
    expect(dealBlock(state)).toBe('empty-stock');
    expect(dealBlock(dealable())).toBeNull();
  });

  it('clears a run that the dealt cards complete', () => {
    const state = dealable();
    state.tableau[0] = fullRun().slice(0, 12);
    state.stock[state.stock.length - 1] = card(1, false);
    const next = spiderRules.apply(state, { type: 'deal' }, 0)!;
    expect(next.completed).toBe(1);
    expect(next.tableau[0]).toEqual([]);
  });
});

describe('session', () => {
  it('undoes a deal, and is disabled with no history', () => {
    const session = createSession(spiderRules, { options: undefined, seed: 5, undoable: true });
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);
    const start = JSON.stringify(session.state);
    expect(session.apply({ type: 'deal' })).toBe(true);
    expect(session.canUndo).toBe(true);
    expect(session.undo()).toBe(true);
    expect(JSON.stringify(session.state)).toBe(start);
    expect(session.canUndo).toBe(false);
  });
});
