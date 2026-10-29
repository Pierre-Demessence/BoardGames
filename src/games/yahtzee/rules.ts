/**
 * Yahtzee for one to four seats: five dice shared by the seats, up to three rolls a
 * turn, 13 boxes on each seat's scorecard. The state is plain JSON; the dice are rolled
 * from `rngState`, so the same state and move always give the same result.
 */

import type { GameRules, GameStatus, SeatKind, Seats } from '../../core';
import type { Die } from '../../kits/dice';

import { makeSeats, passTurn, seatToPlay } from '../../core';
import { makeDice, rollDice, toggleHold } from '../../kits/dice';

export const UPPER_BOXES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const;
export const LOWER_BOXES = [
  'threeOfAKind',
  'fourOfAKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
] as const;

export type UpperBox = (typeof UPPER_BOXES)[number];
export type LowerBox = (typeof LOWER_BOXES)[number];
export type Box = LowerBox | UpperBox;

export const DICE_COUNT = 5;
export const MAX_ROLLS = 3;
export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS = 35;
export const YAHTZEE_BONUS = 100;
export const MAX_SEATS = 4;

const FULL_HOUSE_SCORE = 25;
const SMALL_STRAIGHT_SCORE = 30;
const LARGE_STRAIGHT_SCORE = 40;
const YAHTZEE_SCORE = 50;
const ALL_BOXES: readonly Box[] = [...UPPER_BOXES, ...LOWER_BOXES];

export interface ScoreSheet {
  boxes: Record<Box, number | null>;
  /** Extra Yahtzees scored while the Yahtzee box held 50. */
  yahtzeeBonuses: number;
}

export interface YahtzeeOptions {
  seats: SeatKind[];
}

export interface YahtzeeState {
  dice: Die[];
  /** State of the dice's random generator. */
  rngState: number;
  /** Rolls taken this turn; 0 before the first roll. */
  rollsUsed: number;
  seats: Seats;
  /** One score sheet per seat, indexed by seat. */
  sheets: ScoreSheet[];
}

export type YahtzeeMove
  = | { box: Box; type: 'score' }
    | { index: number; type: 'toggleHold' }
    | { type: 'roll' };

export interface Totals {
  grand: number;
  lower: number;
  upper: number;
  upperBonus: number;
  yahtzeeBonus: number;
}

const FACE_OF: Record<UpperBox, number> = { fives: 5, fours: 4, ones: 1, sixes: 6, threes: 3, twos: 2 };

function isUpper(box: Box): box is UpperBox {
  return (UPPER_BOXES as readonly string[]).includes(box);
}

function sum(dice: readonly Die[]): number {
  return dice.reduce((total, die) => total + die.value, 0);
}

function counts(dice: readonly Die[]): number[] {
  const result: number[] = Array.from<number>({ length: 7 }).fill(0);
  for (const die of dice) result[die.value]!++;
  return result;
}

function isYahtzee(dice: readonly Die[]): boolean {
  return dice.every(die => die.value === dice[0]!.value);
}

function longestRun(dice: readonly Die[]): number {
  const seen = counts(dice);
  let best = 0;
  let run = 0;
  for (let face = 1; face <= 6; face++) {
    run = seen[face]! > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** The score sheet of the seat to play. */
export function sheetToPlay(state: YahtzeeState): ScoreSheet {
  return state.sheets[seatToPlay(state.seats)]!;
}

/** An extra Yahtzee: the dice are five of a kind and the Yahtzee box is already filled (with 50 or 0). */
function isJoker(state: YahtzeeState): boolean {
  return state.rollsUsed > 0 && sheetToPlay(state).boxes.yahtzee !== null && isYahtzee(state.dice);
}

/** What `box` would score for the seat to play with the current dice (the joker rule gives the lower boxes their full value). */
export function scoreFor(state: YahtzeeState, box: Box): number {
  const { dice } = state;
  if (isUpper(box))
    return dice.filter(die => die.value === FACE_OF[box]).length * FACE_OF[box];
  const seen = counts(dice);
  const joker = isJoker(state);
  switch (box) {
    case 'chance':
      return sum(dice);
    case 'fourOfAKind':
      return seen.some(n => n >= 4) ? sum(dice) : 0;
    case 'fullHouse':
      return joker || (seen.includes(3) && seen.includes(2)) ? FULL_HOUSE_SCORE : 0;
    case 'largeStraight':
      return joker || longestRun(dice) >= 5 ? LARGE_STRAIGHT_SCORE : 0;
    case 'smallStraight':
      return joker || longestRun(dice) >= 4 ? SMALL_STRAIGHT_SCORE : 0;
    case 'threeOfAKind':
      return seen.some(n => n >= 3) ? sum(dice) : 0;
    case 'yahtzee':
      return isYahtzee(dice) ? YAHTZEE_SCORE : 0;
  }
}

/** Whether `box` may be scored now: the turn has a roll, the box is open and the joker rule allows it. */
export function canScore(state: YahtzeeState, box: Box): boolean {
  const { boxes } = sheetToPlay(state);
  if (state.rollsUsed === 0 || boxes[box] !== null)
    return false;
  if (!isJoker(state))
    return true;
  const matching = UPPER_BOXES.find(name => FACE_OF[name] === state.dice[0]!.value)!;
  if (boxes[matching] === null)
    return box === matching;
  if (LOWER_BOXES.some(name => boxes[name] === null))
    return !isUpper(box);
  return isUpper(box);
}

export function totals(sheet: ScoreSheet): Totals {
  const total = (names: readonly Box[]): number =>
    names.reduce((acc, name) => acc + (sheet.boxes[name] ?? 0), 0);
  const upper = total(UPPER_BOXES);
  const lower = total(LOWER_BOXES);
  const upperBonus = upper >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
  const yahtzeeBonus = sheet.yahtzeeBonuses * YAHTZEE_BONUS;
  return { grand: upper + upperBonus + lower + yahtzeeBonus, lower, upper, upperBonus, yahtzeeBonus };
}

/** The game ends once every seat has filled its 13 boxes: 13 full rounds of turns. */
function isOver(state: YahtzeeState): boolean {
  return state.seats.turn.rounds >= ALL_BOXES.length;
}

/** The seats with the highest grand total: one winner, or several on a tie. */
export function leaders(state: YahtzeeState): number[] {
  const grands = state.sheets.map(sheet => totals(sheet).grand);
  const best = Math.max(...grands);
  return grands.flatMap((grand, seat) => (grand === best ? [seat] : []));
}

export const yahtzeeRules: GameRules<YahtzeeState, YahtzeeMove, YahtzeeOptions> = {
  seats: state => state.seats,

  apply(state, move) {
    if (isOver(state))
      return null;
    switch (move.type) {
      case 'roll': {
        if (state.rollsUsed >= MAX_ROLLS)
          return null;
        const { dice, rngState } = rollDice(state.dice, state.rngState);
        return { ...state, dice, rngState, rollsUsed: state.rollsUsed + 1 };
      }
      case 'score': {
        if (!canScore(state, move.box))
          return null;
        const seat = seatToPlay(state.seats);
        const sheet = sheetToPlay(state);
        const bonus = isJoker(state) && sheet.boxes.yahtzee === YAHTZEE_SCORE;
        const scored: ScoreSheet = {
          boxes: { ...sheet.boxes, [move.box]: scoreFor(state, move.box) },
          yahtzeeBonuses: sheet.yahtzeeBonuses + (bonus ? 1 : 0),
        };
        return {
          ...state,
          dice: state.dice.map(die => ({ ...die, held: false })),
          rollsUsed: 0,
          seats: passTurn(state.seats),
          sheets: state.sheets.map((other, index) => (index === seat ? scored : other)),
        };
      }
      case 'toggleHold': {
        if (state.rollsUsed < 1 || state.rollsUsed >= MAX_ROLLS)
          return null;
        if (!Number.isInteger(move.index) || move.index < 0 || move.index >= state.dice.length)
          return null;
        return { ...state, dice: toggleHold(state.dice, move.index) };
      }
    }
  },

  setup(seed, options) {
    if (options.seats.length < 1 || options.seats.length > MAX_SEATS)
      throw new Error(`Yahtzee takes 1 to ${MAX_SEATS} seats, not ${options.seats.length}.`);
    return {
      dice: makeDice(DICE_COUNT),
      rngState: seed >>> 0,
      rollsUsed: 0,
      seats: makeSeats(options.seats),
      sheets: options.seats.map(() => ({
        boxes: Object.fromEntries(ALL_BOXES.map(box => [box, null])) as Record<Box, number | null>,
        yahtzeeBonuses: 0,
      })),
    };
  },

  status(state): GameStatus {
    return isOver(state) ? 'won' : 'playing';
  },
};
