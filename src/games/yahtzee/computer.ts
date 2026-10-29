/**
 * Yahtzee's computer player until a real strategy lands (M1.3): roll once, then score
 * the open legal box worth the most. Deterministic from the state.
 */

import type { Box, YahtzeeMove, YahtzeeState } from './rules';

import { canScore, LOWER_BOXES, scoreFor, UPPER_BOXES } from './rules';

const SCORECARD_ORDER: readonly Box[] = [...UPPER_BOXES, ...LOWER_BOXES];

/** The move for the seat to play: a roll at the start of its turn, then the best box. The first box in scorecard order wins a tie. */
export function computerMove(state: YahtzeeState): YahtzeeMove {
  if (state.rollsUsed === 0)
    return { type: 'roll' };
  let best: Box | null = null;
  let bestScore = -1;
  for (const box of SCORECARD_ORDER) {
    if (!canScore(state, box))
      continue;
    const value = scoreFor(state, box);
    if (value > bestScore) {
      best = box;
      bestScore = value;
    }
  }
  if (best === null)
    throw new Error('The seat to play has no box left to score.');
  return { box: best, type: 'score' };
}
