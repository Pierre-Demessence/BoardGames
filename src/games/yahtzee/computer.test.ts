import type { DieValue } from '../../kits/dice';
import type { Box, YahtzeeState } from './rules';

import { describe, expect, it } from 'vitest';

import { createSession } from '../../core';
import { computerMove } from './computer';
import { LOWER_BOXES, totals, UPPER_BOXES, yahtzeeRules } from './rules';

/** The seat to play (a computer) has rolled `values`, with the given boxes filled. */
function rolled(values: readonly DieValue[], filled: Partial<Record<Box, number>> = {}): YahtzeeState {
  const base = yahtzeeRules.setup(1, { seats: ['computer'] }, 0);
  return {
    ...base,
    dice: values.map(value => ({ held: false, value })),
    rollsUsed: 1,
    sheets: [{ ...base.sheets[0]!, boxes: { ...base.sheets[0]!.boxes, ...filled } }],
  };
}

describe('computerMove', () => {
  it('rolls at the start of its turn', () => {
    expect(computerMove(yahtzeeRules.setup(1, { seats: ['computer'] }, 0))).toEqual({ type: 'roll' });
  });

  it('scores the open box worth the most after its roll', () => {
    expect(computerMove(rolled([2, 2, 2, 5, 5]))).toEqual({ box: 'fullHouse', type: 'score' });
    expect(computerMove(rolled([6, 6, 1, 2, 3], { sixes: 0 }))).toEqual({ box: 'chance', type: 'score' });
  });

  it('takes the first box in scorecard order on a tie', () => {
    const open: Box[] = ['twos', 'fours'];
    const filled = Object.fromEntries([...UPPER_BOXES, ...LOWER_BOXES].filter(box => !open.includes(box)).map(box => [box, 0]));
    expect(computerMove(rolled([2, 2, 4, 1, 3], filled))).toEqual({ box: 'twos', type: 'score' });
  });

  it('only picks a box the joker rule allows', () => {
    expect(computerMove(rolled([4, 4, 4, 4, 4], { yahtzee: 50 }))).toEqual({ box: 'fours', type: 'score' });
  });
});

describe('two computers through a session', () => {
  it('play a whole game from a fixed seed and fill every box', () => {
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
    expect(moves).toBe(2 * 13 * 2);
    for (const sheet of session.state.sheets) {
      expect(Object.values(sheet.boxes).every(value => value !== null)).toBe(true);
      expect(totals(sheet).grand).toBeGreaterThan(0);
    }
  });
});
