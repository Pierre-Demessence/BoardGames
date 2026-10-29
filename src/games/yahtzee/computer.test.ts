import type { DieValue } from '../../kits/dice';
import type { Box, YahtzeeMove, YahtzeeState } from './rules';

import { describe, expect, it } from 'vitest';

import { createSession } from '../../core';
import {
  COMPUTER_DELAY,
  COMPUTER_HOLD_DELAY,
  COMPUTER_MIN_TURN,
  computerDelay,
  computerMove,
} from './computer';
import { LOWER_BOXES, totals, UPPER_BOXES, yahtzeeRules } from './rules';

/** The seat to play (a computer) has rolled `values` (the dice at `heldAt` are held), with the given boxes filled. */
function rolled(
  values: readonly DieValue[],
  filled: Partial<Record<Box, number>> = {},
  { heldAt = [], rollsUsed = 1 }: { heldAt?: number[]; rollsUsed?: number } = {},
): YahtzeeState {
  const base = yahtzeeRules.setup(1, { seats: ['computer'] }, 0);
  return {
    ...base,
    dice: values.map((value, index) => ({ held: heldAt.includes(index), value })),
    rollsUsed,
    sheets: [{ ...base.sheets[0]!, boxes: { ...base.sheets[0]!.boxes, ...filled } }],
  };
}

/** The boxes of the scorecard except `open` are filled with 0. */
function onlyOpen(...open: Box[]): Partial<Record<Box, number>> {
  return Object.fromEntries([...UPPER_BOXES, ...LOWER_BOXES].filter(box => !open.includes(box)).map(box => [box, 0]));
}

describe('computerMove', () => {
  it('rolls at the start of its turn', () => {
    expect(computerMove(yahtzeeRules.setup(1, { seats: ['computer'] }, 0))).toEqual({ type: 'roll' });
  });

  it('toggles the leftmost die whose hold differs from the dice it wants to keep, then rolls', () => {
    const dice: DieValue[] = [6, 6, 6, 2, 1];
    expect(computerMove(rolled(dice))).toEqual({ index: 0, type: 'toggleHold' });
    expect(computerMove(rolled(dice, {}, { heldAt: [0] }))).toEqual({ index: 1, type: 'toggleHold' });
    expect(computerMove(rolled(dice, {}, { heldAt: [0, 1, 3] }))).toEqual({ index: 2, type: 'toggleHold' });
    expect(computerMove(rolled(dice, {}, { heldAt: [3] }))).toEqual({ index: 0, type: 'toggleHold' });
    expect(computerMove(rolled(dice, {}, { heldAt: [0, 1, 2] }))).toEqual({ type: 'roll' });
  });

  it('scores at once when it keeps all five dice', () => {
    expect(computerMove(rolled([1, 2, 3, 4, 5]))).toEqual({ box: 'largeStraight', type: 'score' });
  });

  it('scores when no roll is left', () => {
    const move = computerMove(rolled([6, 6, 6, 2, 1], {}, { rollsUsed: 3 }));
    expect(move.type).toBe('score');
  });

  it('scores a rolled Yahtzee in the Yahtzee box', () => {
    expect(computerMove(rolled([3, 3, 3, 3, 3]))).toEqual({ box: 'yahtzee', type: 'score' });
  });

  it('holds the three sixes of [6, 6, 6, 2, 1] with Sixes open', () => {
    const state = rolled([6, 6, 6, 2, 1], {}, { heldAt: [0, 1, 2] });
    expect(computerMove(state)).toEqual({ type: 'roll' });
  });

  it('holds a four-long run when both straights are open and nothing better shows', () => {
    const state = rolled([2, 3, 4, 5, 2], {}, { heldAt: [0, 1, 2, 3] });
    expect(computerMove(state)).toEqual({ type: 'roll' });
  });

  it('only picks a box the joker rule allows', () => {
    expect(computerMove(rolled([4, 4, 4, 4, 4], { yahtzee: 50 }))).toEqual({ box: 'fours', type: 'score' });
  });

  it('throws when the seat has no box left', () => {
    expect(() => computerMove(rolled([1, 2, 3, 4, 5], onlyOpen()))).toThrow();
  });

  it('plays the same whatever the dice it is about to roll', () => {
    const session = createSession(yahtzeeRules, {
      computer: computerMove,
      options: { seats: ['computer'] },
      seed: 7,
      undoable: false,
    });
    let checked = 0;
    while (session.status === 'playing') {
      const { state } = session;
      expect(computerMove({ ...state, rngState: state.rngState ^ 0x9E3779B9 })).toEqual(computerMove(state));
      checked++;
      session.playComputer();
    }
    expect(checked).toBeGreaterThan(13);
  });

  it('averages at least 225 over 50 solo games from seeds 1 to 50 (measured: 239)', () => {
    let sum = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const session = createSession(yahtzeeRules, {
        computer: computerMove,
        options: { seats: ['computer'] },
        seed,
        undoable: false,
      });
      while (session.playComputer() !== null);
      sum += totals(session.state.sheets[0]!).grand;
    }
    expect(sum / 50).toBeGreaterThanOrEqual(225);
  });
});

describe('two computers through a session', () => {
  it('play a whole game from a fixed seed with legal moves and fill every box', () => {
    const session = createSession(yahtzeeRules, {
      computer: computerMove,
      options: { seats: ['computer', 'computer'] },
      seed: 2024,
      undoable: true,
    });
    let moves = 0;
    while (session.playComputer() !== null)
      moves++;
    expect(session.status).toBe('won');
    expect(moves).toBeGreaterThanOrEqual(2 * 13 * 2);
    for (const sheet of session.state.sheets) {
      expect(Object.values(sheet.boxes).every(value => value !== null)).toBe(true);
      expect(totals(sheet).grand).toBeGreaterThan(0);
    }
  });
});

describe('computerDelay', () => {
  const hold: YahtzeeMove = { index: 0, type: 'toggleHold' };
  const roll: YahtzeeMove = { type: 'roll' };
  const score: YahtzeeMove = { box: 'chance', type: 'score' };

  it('is short before a hold and longer before a roll', () => {
    expect(computerDelay(hold, 0)).toBe(COMPUTER_HOLD_DELAY);
    expect(computerDelay(roll, 0)).toBe(COMPUTER_DELAY);
    expect(COMPUTER_HOLD_DELAY).toBe(500);
    expect(COMPUTER_DELAY).toBe(800);
  });

  it('makes a turn last at least the minimum before a score, and never under the roll delay', () => {
    expect(COMPUTER_MIN_TURN).toBe(2500);
    expect(computerDelay(score, 800)).toBe(1700);
    expect(computerDelay(score, 1800)).toBe(COMPUTER_DELAY);
    expect(computerDelay(score, 10_000)).toBe(COMPUTER_DELAY);
  });
});
