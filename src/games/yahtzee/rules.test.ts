import type { DieValue } from '../../kits/dice';
import type { Box, YahtzeeMove, YahtzeeState } from './rules';

import { describe, expect, it } from 'vitest';

import { createSession } from '../../core';
import {
  canScore,
  LOWER_BOXES,
  MAX_ROLLS,
  scoreFor,
  totals,
  UPPER_BOXES,
  yahtzeeRules,
} from './rules';

const ALL: readonly Box[] = [...UPPER_BOXES, ...LOWER_BOXES];

/** A state mid-turn showing `values`, with the given boxes filled and `rollsUsed` rolls taken. */
function stateWith(
  values: readonly DieValue[],
  filled: Partial<Record<Box, number>> = {},
  rollsUsed = 1,
): YahtzeeState {
  const base = yahtzeeRules.setup(1, undefined, 0);
  return {
    ...base,
    boxes: { ...base.boxes, ...filled },
    dice: values.map(value => ({ held: false, value })),
    rollsUsed,
  };
}

function apply(state: YahtzeeState, move: YahtzeeMove): YahtzeeState {
  const next = yahtzeeRules.apply(state, move, 0);
  if (next === null)
    throw new Error(`illegal move ${JSON.stringify(move)}`);
  return next;
}

/** Every box filled except `open`, which stays empty. */
function almostDone(open: Box, values: readonly DieValue[], extra: Partial<Record<Box, number>> = {}): YahtzeeState {
  const filled = Object.fromEntries(ALL.filter(box => box !== open).map(box => [box, 0])) as Record<Box, number>;
  return stateWith(values, { ...filled, ...extra });
}

describe('setup', () => {
  it('deals five unrolled dice, 13 empty boxes and the seed as generator state', () => {
    const state = yahtzeeRules.setup(1234, undefined, 0);
    expect(state.dice).toEqual(Array.from({ length: 5 }, () => ({ held: false, value: 1 })));
    expect(Object.keys(state.boxes)).toHaveLength(13);
    expect(Object.values(state.boxes).every(v => v === null)).toBe(true);
    expect(state.rollsUsed).toBe(0);
    expect(MAX_ROLLS - state.rollsUsed).toBe(3);
    expect(state.rngState).toBe(1234);
    expect(yahtzeeRules.setup(1234, undefined, 99)).toEqual(state);
    expect(yahtzeeRules.status(state)).toBe('playing');
  });
});

describe('roll', () => {
  it('rolls up to three times a turn, then returns null', () => {
    let state = yahtzeeRules.setup(7, undefined, 0);
    for (let i = 1; i <= 3; i++) {
      state = apply(state, { type: 'roll' });
      expect(state.rollsUsed).toBe(i);
    }
    expect(yahtzeeRules.apply(state, { type: 'roll' }, 0)).toBeNull();
  });

  it('keeps held dice and does not mutate the input', () => {
    const first = apply(yahtzeeRules.setup(7, undefined, 0), { type: 'roll' });
    const held = apply(first, { index: 2, type: 'toggleHold' });
    const before = structuredClone(held);
    const second = apply(held, { type: 'roll' });
    expect(held).toEqual(before);
    expect(second.dice[2]).toEqual(held.dice[2]);
    expect(second.rngState).not.toBe(held.rngState);
  });

  it('is the same after a JSON round trip, and for two sessions with the same seed', () => {
    let state = apply(yahtzeeRules.setup(99, undefined, 0), { type: 'roll' });
    state = apply(state, { index: 0, type: 'toggleHold' });
    const copy = JSON.parse(JSON.stringify(state)) as YahtzeeState;
    expect(apply(copy, { type: 'roll' })).toEqual(apply(state, { type: 'roll' }));

    const moves: YahtzeeMove[] = [{ type: 'roll' }, { index: 1, type: 'toggleHold' }, { type: 'roll' }, { box: 'chance', type: 'score' }];
    const a = createSession(yahtzeeRules, { options: undefined, seed: 5, undoable: true });
    const b = createSession(yahtzeeRules, { options: undefined, seed: 5, undoable: true });
    for (const move of moves) {
      a.apply(move);
      b.apply(move);
    }
    expect(a.state).toEqual(b.state);
  });
});

describe('toggleHold', () => {
  it('is legal only after the first and before the third roll', () => {
    const fresh = yahtzeeRules.setup(3, undefined, 0);
    expect(yahtzeeRules.apply(fresh, { index: 0, type: 'toggleHold' }, 0)).toBeNull();
    const one = apply(fresh, { type: 'roll' });
    const held = apply(one, { index: 0, type: 'toggleHold' });
    expect(held.dice[0]!.held).toBe(true);
    expect(apply(held, { index: 0, type: 'toggleHold' }).dice[0]!.held).toBe(false);
    const two = apply(held, { type: 'roll' });
    expect(yahtzeeRules.apply(two, { index: 1, type: 'toggleHold' }, 0)).not.toBeNull();
    const three = apply(two, { type: 'roll' });
    expect(yahtzeeRules.apply(three, { index: 1, type: 'toggleHold' }, 0)).toBeNull();
  });

  it('returns null for a die that does not exist', () => {
    const state = stateWith([1, 2, 3, 4, 5]);
    expect(yahtzeeRules.apply(state, { index: 5, type: 'toggleHold' }, 0)).toBeNull();
    expect(yahtzeeRules.apply(state, { index: -1, type: 'toggleHold' }, 0)).toBeNull();
  });
});

describe('scoreFor', () => {
  const cases: [string, readonly DieValue[], Box, number][] = [
    ['ones', [1, 1, 2, 3, 1], 'ones', 3],
    ['twos', [2, 2, 2, 3, 1], 'twos', 6],
    ['threes none', [1, 1, 2, 4, 5], 'threes', 0],
    ['fours', [4, 4, 1, 1, 2], 'fours', 8],
    ['fives', [5, 5, 5, 5, 1], 'fives', 20],
    ['sixes', [6, 1, 2, 3, 4], 'sixes', 6],
    ['three of a kind', [3, 3, 3, 1, 2], 'threeOfAKind', 12],
    ['three of a kind from four', [3, 3, 3, 3, 2], 'threeOfAKind', 14],
    ['three of a kind missed', [3, 3, 4, 4, 2], 'threeOfAKind', 0],
    ['four of a kind', [6, 6, 6, 6, 1], 'fourOfAKind', 25],
    ['four of a kind missed', [6, 6, 6, 1, 1], 'fourOfAKind', 0],
    ['full house', [2, 2, 5, 5, 5], 'fullHouse', 25],
    ['full house missed', [2, 2, 5, 5, 4], 'fullHouse', 0],
    ['five of a kind is no full house without the joker', [4, 4, 4, 4, 4], 'fullHouse', 0],
    ['small straight', [1, 2, 3, 4, 6], 'smallStraight', 30],
    ['small straight with a pair', [3, 4, 5, 6, 6], 'smallStraight', 30],
    ['small straight missed', [1, 2, 3, 5, 6], 'smallStraight', 0],
    ['large straight', [2, 3, 4, 5, 6], 'largeStraight', 40],
    ['large straight from a small one', [1, 2, 3, 4, 6], 'largeStraight', 0],
    ['yahtzee', [5, 5, 5, 5, 5], 'yahtzee', 50],
    ['yahtzee missed', [5, 5, 5, 5, 4], 'yahtzee', 0],
    ['chance', [6, 5, 4, 2, 1], 'chance', 18],
  ];
  it.each(cases)('%s', (_name, values, box, expected) => {
    expect(scoreFor(stateWith(values), box)).toBe(expected);
  });
});

describe('score', () => {
  it('fills the box, clears holds and rolls, and counts the turn', () => {
    let state = apply(yahtzeeRules.setup(11, undefined, 0), { type: 'roll' });
    state = apply(state, { index: 3, type: 'toggleHold' });
    const expected = scoreFor(state, 'chance');
    const next = apply(state, { box: 'chance', type: 'score' });
    expect(next.boxes.chance).toBe(expected);
    expect(next.rollsUsed).toBe(0);
    expect(next.dice.every(die => !die.held)).toBe(true);
    expect(state.boxes.chance).toBeNull();
  });

  it('returns null before the first roll and for a filled box', () => {
    const fresh = yahtzeeRules.setup(11, undefined, 0);
    expect(yahtzeeRules.apply(fresh, { box: 'chance', type: 'score' }, 0)).toBeNull();
    const filled = stateWith([1, 2, 3, 4, 5], { chance: 15 });
    expect(yahtzeeRules.apply(filled, { box: 'chance', type: 'score' }, 0)).toBeNull();
  });

  it('adds the 35 upper bonus from 63 points', () => {
    const state = stateWith([1, 1, 1, 1, 1], { fives: 15, fours: 12, ones: 3, sixes: 18, threes: 9, twos: 6 });
    expect(totals(state)).toMatchObject({ grand: 98, upper: 63, upperBonus: 35 });
    const short = stateWith([1, 1, 1, 1, 1], { fives: 10, fours: 12, ones: 3, sixes: 18, threes: 9, twos: 6 });
    expect(totals(short)).toMatchObject({ grand: 58, upper: 58, upperBonus: 0 });
  });

  it('totals the lower section and the Yahtzee bonuses', () => {
    const state = { ...stateWith([1, 2, 3, 4, 5], { chance: 20, fullHouse: 25, yahtzee: 50 }), yahtzeeBonuses: 2 };
    expect(totals(state)).toEqual({ grand: 295, lower: 95, upper: 0, upperBonus: 0, yahtzeeBonus: 200 });
  });
});

describe('yahtzee bonus and joker rule', () => {
  const FIVES: readonly DieValue[] = [4, 4, 4, 4, 4];

  it('adds a 100 bonus for an extra Yahtzee when the Yahtzee box holds 50', () => {
    const state = stateWith(FIVES, { yahtzee: 50 });
    const next = apply(state, { box: 'fours', type: 'score' });
    expect(next.yahtzeeBonuses).toBe(1);
    expect(totals(next).yahtzeeBonus).toBe(100);
    expect(next.boxes.fours).toBe(20);
  });

  it('adds no bonus when the Yahtzee box holds 0, but the joker rule still applies', () => {
    const state = stateWith(FIVES, { yahtzee: 0 });
    expect(canScore(state, 'chance')).toBe(false);
    expect(apply(state, { box: 'fours', type: 'score' }).yahtzeeBonuses).toBe(0);
  });

  it('forces the matching upper box when it is open', () => {
    const state = stateWith(FIVES, { yahtzee: 50 });
    expect(canScore(state, 'fours')).toBe(true);
    for (const box of ALL.filter(b => b !== 'fours'))
      expect(canScore(state, box)).toBe(false);
  });

  it('allows any open lower box at full value when the matching upper box is filled', () => {
    const state = stateWith(FIVES, { fours: 8, yahtzee: 50 });
    expect(canScore(state, 'ones')).toBe(false);
    expect(canScore(state, 'fullHouse')).toBe(true);
    expect(scoreFor(state, 'fullHouse')).toBe(25);
    expect(scoreFor(state, 'smallStraight')).toBe(30);
    expect(scoreFor(state, 'largeStraight')).toBe(40);
    expect(scoreFor(state, 'threeOfAKind')).toBe(20);
    expect(scoreFor(state, 'fourOfAKind')).toBe(20);
    expect(scoreFor(state, 'chance')).toBe(20);
    expect(apply(state, { box: 'largeStraight', type: 'score' }).boxes.largeStraight).toBe(40);
  });

  it('forces a zero in an open upper box when every lower box is filled', () => {
    const lowerFilled = Object.fromEntries(LOWER_BOXES.map(box => [box, box === 'yahtzee' ? 50 : 1])) as Record<Box, number>;
    const state = stateWith(FIVES, { ...lowerFilled, fours: 8 });
    expect(canScore(state, 'fullHouse')).toBe(false);
    expect(canScore(state, 'ones')).toBe(true);
    expect(apply(state, { box: 'ones', type: 'score' }).boxes.ones).toBe(0);
  });

  it('returns null for a box the joker rule forbids', () => {
    const state = stateWith(FIVES, { yahtzee: 50 });
    expect(yahtzeeRules.apply(state, { box: 'chance', type: 'score' }, 0)).toBeNull();
  });

  it('does not apply to the first Yahtzee, which may go anywhere', () => {
    const state = stateWith(FIVES);
    expect(canScore(state, 'chance')).toBe(true);
    expect(canScore(state, 'yahtzee')).toBe(true);
    expect(scoreFor(state, 'fullHouse')).toBe(0);
  });
});

describe('end of the game', () => {
  it('is won once the 13th box is scored, and rejects every further move', () => {
    const state = almostDone('chance', [1, 2, 3, 4, 6]);
    expect(yahtzeeRules.status(state)).toBe('playing');
    const done = apply(state, { box: 'chance', type: 'score' });
    expect(yahtzeeRules.status(done)).toBe('won');
    expect(totals(done).grand).toBe(16);
    for (const move of [{ type: 'roll' }, { index: 0, type: 'toggleHold' }, { box: 'chance', type: 'score' }] as YahtzeeMove[])
      expect(yahtzeeRules.apply(done, move, 0)).toBeNull();
  });
});

describe('undo through a session', () => {
  it('takes back holds and scoring, but not past a roll', () => {
    const session = createSession(yahtzeeRules, {
      options: undefined,
      seed: 21,
      undoable: true,
      isIrreversible: move => move.type === 'roll',
    });
    session.apply({ type: 'roll' });
    expect(session.canUndo).toBe(false);

    session.apply({ index: 0, type: 'toggleHold' });
    expect(session.canUndo).toBe(true);
    session.undo();
    expect(session.state.dice[0]!.held).toBe(false);

    session.apply({ box: 'chance', type: 'score' });
    expect(session.state.boxes.chance).not.toBeNull();
    session.undo();
    expect(session.state.boxes.chance).toBeNull();
    expect(session.state.rollsUsed).toBe(1);
  });
});
