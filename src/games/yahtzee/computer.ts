/**
 * Yahtzee's computer player: it plans one turn at a time for its own score sheet. For
 * every set of five dice it values scoring the best box now, then works back through
 * the rolls left: the value of keeping some dice is the average, over every way the
 * others can land, of the value of the dice that result. It never reads `rngState` or the
 * other seats' sheets, so it plays for its own best total and cannot peek at the next roll.
 */

import type { Die, DieValue } from '../../kits/dice';
import type { Box, ScoreSheet, YahtzeeMove, YahtzeeState } from './rules';

import { seatToPlay } from '../../core';
import { DIE_FACES } from '../../kits/dice';
import {
  canScore,
  DICE_COUNT,
  LOWER_BOXES,
  MAX_ROLLS,
  sheetToPlay,
  totals,
  UPPER_BONUS_THRESHOLD,
  UPPER_BOXES,
  yahtzeeRules,
} from './rules';

/** Pause before a hold, in milliseconds; about as long as a roll's tumble. */
export const COMPUTER_HOLD_DELAY = 500;
/** Pause before a roll or a score; longer than the tumble, so a roll settles before the score. */
export const COMPUTER_DELAY = 800;
/** A turn lasts at least this long, so a turn scored on its first roll is still followed. */
export const COMPUTER_MIN_TURN = 2500;

/** What each box is worth to a sheet that leaves it open: its average score under optimal play. */
const OPEN_BOX_VALUE: Record<Box, number> = {
  chance: 22.01,
  fives: 15.69,
  fourOfAKind: 13.1,
  fours: 12.16,
  fullHouse: 22.59,
  largeStraight: 32.71,
  ones: 2.11,
  sixes: 19.19,
  smallStraight: 29.46,
  threeOfAKind: 21.66,
  threes: 8.57,
  twos: 5.28,
  yahtzee: 16.87,
};
/** Reward per point an upper box scores above three of its face, while the upper bonus is not yet reached. */
const UPPER_PAR_WEIGHT = 1.2;
/** Values closer than this are ties, so float noise never changes a move. */
const EPSILON = 1e-9;

const SCORECARD_ORDER: readonly Box[] = [...UPPER_BOXES, ...LOWER_BOXES];
/** Dice counts are at most `DICE_COUNT`, so a multiset of dice is a number in this base. */
const COUNT_BASE = DICE_COUNT + 1;

/** A kept multiset of fewer than five dice and what rolling the rest can give. */
interface Kept {
  /** How many dice of each face are kept. */
  counts: readonly number[];
  /** Every result of rolling the others: the full set it makes and its probability. */
  outcomes: readonly { probability: number; set: number }[];
}

/** The shape of the dice problem, the same for every sheet. */
interface Structure {
  /** The 252 sets of five dice, as a count per face. */
  fullSets: readonly (readonly number[])[];
  /** Maps `keyOf(counts)` to an index in `fullSets`. */
  indexOfKey: Int32Array;
  /** The kept multisets of 0 to 4 dice. */
  kepts: readonly Kept[];
  /** For each full set, the kept multisets that can be held out of it. */
  subsets: readonly (readonly number[])[];
}

/** What the planner knows about one sheet. */
interface Table {
  /** For each full set, the box scored with it now. */
  bestBox: readonly Box[];
  /** Indexed by rolls left (1 and 2; index 0 is an unused placeholder), the expected value of keeping each `Kept`. */
  expected: readonly Float64Array[];
  /** For each full set, the value of scoring `bestBox` now. */
  scoreNow: Float64Array;
}

let structureCache: null | Structure = null;
let tableCache: null | { key: string; table: Table } = null;

function keyOf(counts: readonly number[]): number {
  let key = 0;
  for (let face = DIE_FACES - 1; face >= 0; face--) key = key * COUNT_BASE + counts[face]!;
  return key;
}

/** Every way to split `total` dice over `parts` faces. */
function compositions(total: number, parts: number): number[][] {
  if (parts === 1)
    return [[total]];
  const result: number[][] = [];
  for (let first = 0; first <= total; first++) {
    for (const rest of compositions(total - first, parts - 1)) result.push([first, ...rest]);
  }
  return result;
}

function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

function getStructure(): Structure {
  if (structureCache)
    return structureCache;
  const fullSets = compositions(DICE_COUNT, DIE_FACES);
  const indexOfKey = new Int32Array(COUNT_BASE ** DIE_FACES).fill(-1);
  fullSets.forEach((counts, index) => {
    indexOfKey[keyOf(counts)] = index;
  });
  const kepts: Kept[] = [];
  for (let size = 0; size < DICE_COUNT; size++) {
    const rolled = DICE_COUNT - size;
    for (const counts of compositions(size, DIE_FACES)) {
      const outcomes = compositions(rolled, DIE_FACES).map((roll) => {
        const ways = factorial(rolled) / roll.reduce((product, n) => product * factorial(n), 1);
        return {
          probability: ways / DIE_FACES ** rolled,
          set: indexOfKey[keyOf(roll.map((n, face) => n + counts[face]!))]!,
        };
      });
      kepts.push({ counts, outcomes });
    }
  }
  const subsets = fullSets.map((set) => {
    const inside: number[] = [];
    kepts.forEach((kept, index) => {
      if (kept.counts.every((n, face) => n <= set[face]!))
        inside.push(index);
    });
    return inside;
  });
  structureCache = { fullSets, indexOfKey, kepts, subsets };
  return structureCache;
}

function sheetKey(sheet: ScoreSheet): string {
  return `${SCORECARD_ORDER.map(box => sheet.boxes[box] ?? '-').join(',')}|${sheet.yahtzeeBonuses}`;
}

function diceOf(counts: readonly number[]): Die[] {
  return counts.flatMap((n, face) =>
    Array.from({ length: n }, () => ({ held: false, value: (face + 1) as DieValue })));
}

/** The planner's table for the seat to play. The rules score each hypothetical roll, so the joker rule and both bonuses are theirs. */
function buildTable(state: YahtzeeState): Table {
  const { fullSets, kepts, subsets } = getStructure();
  const seat = seatToPlay(state.seats);
  const before = totals(sheetToPlay(state));
  const bonusNotReached = before.upper < UPPER_BONUS_THRESHOLD;
  const scoreNow = new Float64Array(fullSets.length);
  const bestBox: Box[] = [];
  fullSets.forEach((counts, index) => {
    const hypothetical: YahtzeeState = { ...state, dice: diceOf(counts), rollsUsed: 1 };
    let best = Number.NEGATIVE_INFINITY;
    let bestOf: Box = SCORECARD_ORDER[0]!;
    for (const box of SCORECARD_ORDER) {
      if (!canScore(hypothetical, box))
        continue;
      const next = yahtzeeRules.apply(hypothetical, { box, type: 'score' }, 0)!;
      const scored = next.sheets[seat]!;
      let gain = totals(scored).grand - before.grand - OPEN_BOX_VALUE[box];
      const upperIndex = (UPPER_BOXES as readonly Box[]).indexOf(box);
      if (upperIndex >= 0 && bonusNotReached)
        gain += UPPER_PAR_WEIGHT * (scored.boxes[box]! - 3 * (upperIndex + 1));
      if (gain > best) {
        best = gain;
        bestOf = box;
      }
    }
    scoreNow[index] = best;
    bestBox.push(bestOf);
  });

  const expected: Float64Array[] = [new Float64Array(0)];
  let valueBefore = scoreNow;
  for (let rollsLeft = 1; rollsLeft < MAX_ROLLS; rollsLeft++) {
    const keptValue = Float64Array.from(kepts, kept =>
      kept.outcomes.reduce((total, { probability, set }) => total + probability * valueBefore[set]!, 0));
    expected.push(keptValue);
    valueBefore = Float64Array.from(fullSets, (_, set) =>
      subsets[set]!.reduce((best, kept) => Math.max(best, keptValue[kept]!), scoreNow[set]!));
  }
  return { bestBox, expected, scoreNow };
}

function tableFor(state: YahtzeeState): Table {
  const key = sheetKey(sheetToPlay(state));
  if (tableCache?.key !== key)
    tableCache = { key, table: buildTable(state) };
  return tableCache.table;
}

/** Which dice to hold to keep `counts`: the leftmost dice of each face. */
function wantedHolds(dice: readonly Die[], counts: readonly number[]): boolean[] {
  const left = [...counts];
  return dice.map((die) => {
    const face = die.value - 1;
    if (left[face]! <= 0)
      return false;
    left[face]!--;
    return true;
  });
}

/**
 * The move for the seat to play: a roll at the start of its turn; then, until the dice it
 * wants to keep are held, one toggle of the leftmost die that differs; then a roll, or the
 * best box once keeping everything or rolling again is not worth more. Depends only on the
 * dice, the roll count and the seat's own sheet.
 */
export function computerMove(state: YahtzeeState): YahtzeeMove {
  if (state.rollsUsed === 0)
    return { type: 'roll' };
  if (SCORECARD_ORDER.every(box => sheetToPlay(state).boxes[box] !== null))
    throw new Error('The seat to play has no box left to score.');
  const { indexOfKey, kepts, subsets } = getStructure();
  const table = tableFor(state);
  const counts = Array.from<number>({ length: DIE_FACES }).fill(0);
  for (const die of state.dice) counts[die.value - 1]!++;
  const set = indexOfKey[keyOf(counts)]!;
  const rollsLeft = MAX_ROLLS - state.rollsUsed;

  let best = table.scoreNow[set]!;
  let keep: null | readonly number[] = null;
  if (rollsLeft > 0) {
    for (const kept of subsets[set]!) {
      const value = table.expected[rollsLeft]![kept]!;
      if (value > best + EPSILON) {
        best = value;
        keep = kepts[kept]!.counts;
      }
    }
  }
  if (keep === null)
    return { box: table.bestBox[set]!, type: 'score' };
  const wanted = wantedHolds(state.dice, keep);
  const index = state.dice.findIndex((die, i) => die.held !== wanted[i]);
  return index === -1 ? { type: 'roll' } : { index, type: 'toggleHold' };
}

/**
 * Milliseconds to wait before the computer plays `next`, `elapsedMs` after its turn began:
 * a short pause per hold, a longer one before a roll, and before a score whatever is
 * left of `COMPUTER_MIN_TURN` (at least `COMPUTER_DELAY`).
 */
export function computerDelay(next: YahtzeeMove, elapsedMs: number): number {
  switch (next.type) {
    case 'roll':
      return COMPUTER_DELAY;
    case 'score':
      return Math.max(COMPUTER_DELAY, COMPUTER_MIN_TURN - elapsedMs);
    case 'toggleHold':
      return COMPUTER_HOLD_DELAY;
  }
}
