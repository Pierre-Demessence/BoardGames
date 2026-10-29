import type { Suit } from '../../kits/cards';
import type { Card, PileRef, SolitaireMove, SolitaireState } from './rules';

import { describe, expect, it } from 'vitest';

import { createSession } from '../../core';
import {
  displayScore,
  elapsedMs,
  FLIP_POINTS,
  foundationTarget,
  nextAutoFinishMove,
  RECYCLE_PENALTY,
  solitaireRules,
  timePenalty,
} from './rules';

let nextId = 0;

function card(suit: Suit, rank: number, faceUp = true): Card {
  return { id: nextId++, faceUp, rank, suit };
}

function makeState(parts: Partial<SolitaireState> = {}): SolitaireState {
  return {
    endedAt: null,
    foundations: [[], [], [], []],
    score: 0,
    startedAt: 0,
    stock: [],
    tableau: [[], [], [], [], [], [], []],
    waste: [],
    ...parts,
  };
}

function suitRun(suit: Suit, upTo: number): Card[] {
  return Array.from({ length: upTo }, (_, i) => card(suit, i + 1));
}

function tableau(col: number): PileRef {
  return { index: col, kind: 'tableau' };
}

function foundation(index: number): PileRef {
  return { index, kind: 'foundation' };
}

function move(from: PileRef, index: number, to: PileRef): SolitaireMove {
  return { from, index, to, type: 'move' };
}

const WASTE: PileRef = { index: 0, kind: 'waste' };

function snapshot(state: SolitaireState): string {
  return JSON.stringify(state);
}

describe('setup', () => {
  it('deals 7 tableau columns with only the last card face-up, and 24 in the stock', () => {
    const state = solitaireRules.setup(42, undefined, 1000);
    expect(state.tableau.map(col => col.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const col of state.tableau) {
      expect(col.map(c => c.faceUp)).toEqual(col.map((_, i) => i === col.length - 1));
    }
    expect(state.stock).toHaveLength(24);
    expect(state.stock.every(c => !c.faceUp)).toBe(true);
    expect(state.waste).toHaveLength(0);
    expect(state.startedAt).toBe(1000);
    expect(state.endedAt).toBeNull();
    const ids = [...state.stock, ...state.tableau.flat()].map(c => c.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });

  it('deals the same cards for the same seed and different ones for another', () => {
    const a = solitaireRules.setup(7, undefined, 0);
    const b = solitaireRules.setup(7, undefined, 0);
    const c = solitaireRules.setup(8, undefined, 0);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('is plain JSON: a round trip through JSON leaves the state unchanged', () => {
    const state = solitaireRules.setup(3, undefined, 5);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    const moved = solitaireRules.apply(state, { type: 'draw' }, 9)!;
    expect(JSON.parse(JSON.stringify(moved))).toEqual(moved);
  });
});

describe('draw', () => {
  it('moves the stock top face-up to the waste', () => {
    const top = card('Hearts', 5, false);
    const state = makeState({ stock: [card('Clubs', 2, false), top] });
    const next = solitaireRules.apply(state, { type: 'draw' }, 0)!;
    expect(next.stock).toHaveLength(1);
    expect(next.waste.map(c => c.id)).toEqual([top.id]);
    expect(next.waste[0]!.faceUp).toBe(true);
  });

  it('recycles the waste face-down in order for -100, floored at 0', () => {
    const first = card('Hearts', 5);
    const second = card('Clubs', 9);
    const state = makeState({ score: 130, waste: [first, second] });
    const next = solitaireRules.apply(state, { type: 'draw' }, 0)!;
    expect(next.waste).toHaveLength(0);
    expect(next.stock.map(c => c.id)).toEqual([second.id, first.id]);
    expect(next.stock.every(c => !c.faceUp)).toBe(true);
    expect(next.score).toBe(130 + RECYCLE_PENALTY);

    expect(solitaireRules.apply(makeState({ score: 40, waste: [first] }), { type: 'draw' }, 0)!.score).toBe(0);
  });

  it('refuses with an empty stock and waste', () => {
    expect(solitaireRules.apply(makeState(), { type: 'draw' }, 0)).toBeNull();
  });
});

describe('tableau moves', () => {
  it('moves a run onto a card one rank higher and of the other color', () => {
    const state = makeState({
      tableau: [
        [card('Spades', 8)],
        [card('Hearts', 7, false), card('Hearts', 7), card('Clubs', 6)],
        [],
        [],
        [],
        [],
        [],
      ],
    });
    // Column 1 index 1 holds 7H on top of 6C; 7H goes on 8S.
    const next = solitaireRules.apply(state, move(tableau(1), 1, tableau(0)), 0)!;
    expect(next.tableau[0]!.map(c => c.rank)).toEqual([8, 7, 6]);
    expect(next.tableau[1]!.map(c => c.faceUp)).toEqual([true]);
    expect(next.score).toBe(FLIP_POINTS);
  });

  it('refuses the same color, a wrong rank, a face-down card and an occupied-by-nothing non-king', () => {
    const state = makeState({
      tableau: [
        [card('Spades', 8)],
        [card('Clubs', 7)],
        [card('Hearts', 5, false), card('Hearts', 5)],
        [card('Hearts', 6)],
        [],
        [],
        [],
      ],
    });
    expect(solitaireRules.apply(state, move(tableau(1), 0, tableau(0)), 0)).toBeNull();
    expect(solitaireRules.apply(state, move(tableau(3), 0, tableau(0)), 0)).toBeNull();
    expect(solitaireRules.apply(state, move(tableau(2), 0, tableau(3)), 0)).toBeNull();
    expect(solitaireRules.apply(state, move(tableau(1), 0, tableau(4)), 0)).toBeNull();
  });

  it('puts only a king on an empty column', () => {
    const state = makeState({ tableau: [[card('Spades', 13)], [card('Hearts', 12)], [], [], [], [], []] });
    expect(solitaireRules.apply(state, move(tableau(0), 0, tableau(2)), 0)).not.toBeNull();
    expect(solitaireRules.apply(state, move(tableau(1), 0, tableau(2)), 0)).toBeNull();
  });

  it('scores waste to tableau +5 and foundation to tableau -15 (floored at 0)', () => {
    const state = makeState({
      foundations: [[card('Hearts', 1), card('Hearts', 2), card('Hearts', 3)], [], [], []],
      score: 10,
      tableau: [[card('Spades', 4)], [], [], [], [], [], []],
      waste: [card('Hearts', 3)],
    });
    expect(solitaireRules.apply(state, move(WASTE, 0, tableau(0)), 0)!.score).toBe(15);
    expect(solitaireRules.apply(state, move(foundation(0), 2, tableau(0)), 0)!.score).toBe(0);
  });

  it('refuses a move onto the same pile, from the stock, and to the stock or waste', () => {
    const state = makeState({
      stock: [card('Clubs', 3, false)],
      tableau: [[card('Spades', 8)], [], [], [], [], [], []],
      waste: [card('Hearts', 7)],
    });
    expect(solitaireRules.apply(state, move(tableau(0), 0, tableau(0)), 0)).toBeNull();
    expect(solitaireRules.apply(state, move({ index: 0, kind: 'stock' }, 0, tableau(0)), 0)).toBeNull();
    expect(solitaireRules.apply(state, move(WASTE, 0, { index: 0, kind: 'stock' }), 0)).toBeNull();
    expect(solitaireRules.apply(state, move(tableau(0), 0, WASTE), 0)).toBeNull();
  });

  it('refuses an index outside the pile', () => {
    const state = makeState({ tableau: [[card('Spades', 13)], [], [], [], [], [], []] });
    expect(solitaireRules.apply(state, move(tableau(0), 1, tableau(1)), 0)).toBeNull();
    expect(solitaireRules.apply(state, move(tableau(0), -1, tableau(1)), 0)).toBeNull();
    expect(solitaireRules.apply(state, move(tableau(5), 0, tableau(1)), 0)).toBeNull();
  });

  it('takes only the top card from the waste and the foundations', () => {
    const state = makeState({
      tableau: [[card('Spades', 8)], [], [], [], [], [], []],
      waste: [card('Hearts', 7), card('Clubs', 2)],
    });
    expect(solitaireRules.apply(state, move(WASTE, 0, tableau(0)), 0)).toBeNull();
  });

  it('never mutates the state it is given', () => {
    const state = makeState({
      tableau: [[card('Spades', 8)], [card('Hearts', 7, false), card('Hearts', 7)], [], [], [], [], []],
      waste: [card('Clubs', 6)],
    });
    const before = snapshot(state);
    solitaireRules.apply(state, move(tableau(1), 1, tableau(0)), 0);
    solitaireRules.apply(state, move(WASTE, 0, tableau(1)), 0);
    solitaireRules.apply(state, { type: 'draw' }, 0);
    expect(snapshot(state)).toBe(before);
  });
});

describe('foundation moves', () => {
  it('starts with an ace and builds up in suit', () => {
    const state = makeState({
      foundations: [[card('Spades', 1)], [], [], []],
      tableau: [[card('Spades', 2)], [card('Hearts', 3)], [card('Hearts', 1)], [], [], [], []],
    });
    expect(solitaireRules.apply(state, move(tableau(0), 0, foundation(0)), 0)!.score).toBe(10);
    expect(solitaireRules.apply(state, move(tableau(1), 0, foundation(0)), 0)).toBeNull();
    expect(solitaireRules.apply(state, move(tableau(2), 0, foundation(1)), 0)).not.toBeNull();
    expect(solitaireRules.apply(state, move(tableau(0), 0, foundation(1)), 0)).toBeNull();
  });

  it('refuses a run of two or more cards (B10)', () => {
    // 2S then AH is a valid run; the first card fits the foundation, the run as a whole does not.
    const state = makeState({
      foundations: [[card('Spades', 1)], [], [], []],
      tableau: [[card('Spades', 2), card('Hearts', 1)], [], [], [], [], [], []],
    });
    expect(solitaireRules.apply(state, move(tableau(0), 0, foundation(0)), 0)).toBeNull();
    expect(solitaireRules.apply(state, move(tableau(0), 1, foundation(1)), 0)).not.toBeNull();
  });

  it('refuses a move from one foundation to another', () => {
    const state = makeState({ foundations: [[card('Spades', 1)], [], [], []] });
    expect(solitaireRules.apply(state, move(foundation(0), 0, foundation(1)), 0)).toBeNull();
  });

  it('finds the target for a double-click', () => {
    const state = makeState({ foundations: [[], [card('Hearts', 1)], [], []] });
    expect(foundationTarget(state, card('Hearts', 2))).toBe(1);
    expect(foundationTarget(state, card('Spades', 1))).toBe(0);
    expect(foundationTarget(state, card('Spades', 2))).toBeNull();
  });
});

describe('time and score', () => {
  it('shows exactly -6 for time after 35 seconds (B11)', () => {
    const state = makeState({ score: 20, startedAt: 1000 });
    expect(timePenalty(35_000)).toBe(-6);
    expect(displayScore(state, 1000 + 35_000)).toBe(14);
    expect(displayScore(state, 1000 + 9_999)).toBe(20);
    expect(displayScore(state, 1000 + 10_000)).toBe(18);
  });

  it('never shows a negative score', () => {
    expect(displayScore(makeState({ score: 3 }), 600_000)).toBe(0);
  });

  describe('winning', () => {
    function almostWon(): SolitaireState {
      return makeState({
        foundations: [suitRun('Spades', 13), suitRun('Hearts', 13), suitRun('Diamonds', 13), suitRun('Clubs', 12)],
        score: 100,
        startedAt: 1000,
        tableau: [[card('Clubs', 13)], [], [], [], [], [], []],
      });
    }

    it('stops the clock and the penalty at the win and adds the time bonus once (B12)', () => {
      const won = solitaireRules.apply(almostWon(), move(tableau(0), 0, foundation(3)), 1000 + 40_000)!;
      expect(solitaireRules.status(won)).toBe('won');
      expect(won.endedAt).toBe(41_000);
      expect(elapsedMs(won, 999_999)).toBe(40_000);
      // 100 + 10 for the move + floor(700000 / 40) for the bonus
      expect(won.score).toBe(110 + 17_500);
      const shown = displayScore(won, 41_000);
      expect(shown).toBe(110 + 17_500 - 8);
      expect(displayScore(won, 41_000 + 120_000)).toBe(shown);
    });

    it('gives no time bonus for a win in under 30 seconds', () => {
      const won = solitaireRules.apply(almostWon(), move(tableau(0), 0, foundation(3)), 1000 + 29_000)!;
      expect(won.score).toBe(110);
    });

    it('takes no more moves once won', () => {
      const won = solitaireRules.apply(almostWon(), move(tableau(0), 0, foundation(3)), 5000)!;
      expect(solitaireRules.apply(won, { type: 'draw' }, 6000)).toBeNull();
    });
  });
});

describe('auto-finish', () => {
  it('does not apply with cards in the stock or a face-down tableau card', () => {
    const stock = makeState({ foundations: [[], [], [], []], stock: [card('Clubs', 9, false)], tableau: [[card('Spades', 1)], [], [], [], [], [], []] });
    const hidden = makeState({ tableau: [[card('Hearts', 5, false), card('Spades', 1)], [], [], [], [], [], []] });
    expect(nextAutoFinishMove(stock)).toBeNull();
    expect(nextAutoFinishMove(hidden)).toBeNull();
  });

  it('moves the waste top first, then the first tableau top that fits', () => {
    const state = makeState({
      tableau: [[card('Hearts', 1)], [card('Spades', 1)], [], [], [], [], []],
      waste: [card('Clubs', 1)],
    });
    expect(nextAutoFinishMove(state)).toEqual(move(WASTE, 0, foundation(0)));
    const noWaste = { ...state, waste: [] };
    expect(nextAutoFinishMove(noWaste)).toEqual(move(tableau(0), 0, foundation(0)));
  });

  it('returns null when nothing fits a foundation', () => {
    expect(nextAutoFinishMove(makeState({ tableau: [[card('Hearts', 5)], [], [], [], [], [], []] }))).toBeNull();
  });
});

describe('session', () => {
  it('undo reverts the last move, score included, and is empty at the start', () => {
    const start = makeState({
      score: 0,
      tableau: [[card('Spades', 1)], [], [], [], [], [], []],
    });
    const session = createSession({ ...solitaireRules, setup: () => start }, { options: undefined, seed: 1, undoable: true });
    expect(session.canUndo).toBe(false);
    expect(session.apply(move(tableau(0), 0, foundation(0)))).toBe(true);
    expect(session.state.score).toBe(10);
    expect(session.canUndo).toBe(true);
    expect(session.undo()).toBe(true);
    expect(session.state.score).toBe(0);
    expect(session.state.foundations[0]).toHaveLength(0);
    expect(session.canUndo).toBe(false);
  });
});
