/**
 * Spider Solitaire (1-suit, 2 decks) rules as pure functions over plain JSON
 * state. A completed K-to-A run of one suit leaves the table and counts toward
 * the eight needed to win.
 */

import type { GameRules, GameStatus } from '../../core';
import type { Card } from '../../kits/cards';

import { makeSeededRng } from '@pierre/ecs/modules/rng';

import { makeDeck } from '../../kits/cards';

export type { Card } from '../../kits/cards';

export interface SpiderState {
  /** Runs taken off the table. */
  completed: number;
  stock: Card[];
  tableau: Card[][];
}

export type SpiderMove
  = | { type: 'deal' }
    | { type: 'move'; from: number; index: number; to: number };

/** Why a deal from the stock is refused, for the hint text. */
export type DealBlock = 'empty-column' | 'empty-stock';

export const COLUMNS = 10;
export const RUNS_TO_WIN = 8;

/** A complete run is a King down to an Ace. */
const RUN_LENGTH = 13;
/** The first columns get one more card in the initial deal. */
const LONG_COLUMNS = 4;
const LONG_COLUMN_CARDS = 6;
const SHORT_COLUMN_CARDS = 5;

function setup(seed: number): SpiderState {
  const deck = makeDeck({ decks: 2, suits: 1 }, makeSeededRng(seed));
  const tableau: Card[][] = Array.from({ length: COLUMNS }, () => []);
  for (let col = 0; col < COLUMNS; col++) {
    const count = col < LONG_COLUMNS ? LONG_COLUMN_CARDS : SHORT_COLUMN_CARDS;
    for (let row = 0; row < count; row++) {
      const card = deck.pop()!;
      card.faceUp = row === count - 1;
      tableau[col]!.push(card);
    }
  }
  return { completed: 0, stock: deck, tableau };
}

function status(state: SpiderState): GameStatus {
  return state.completed >= RUNS_TO_WIN ? 'won' : 'playing';
}

function apply(state: SpiderState, move: SpiderMove): SpiderState | null {
  if (status(state) === 'won')
    return null;
  const next = cloneState(state);
  const ok = move.type === 'deal' ? deal(next) : moveRun(next, move.from, move.index, move.to);
  if (!ok)
    return null;
  clearCompletedRuns(next);
  return next;
}

export const spiderRules: GameRules<SpiderState, SpiderMove> = {
  apply,
  setup,
  status,
};

function deal(state: SpiderState): boolean {
  if (dealBlock(state) !== null)
    return false;
  for (const column of state.tableau) {
    const card = state.stock.pop()!;
    card.faceUp = true;
    column.push(card);
  }
  return true;
}

function moveRun(state: SpiderState, from: number, index: number, to: number): boolean {
  if (from === to)
    return false;
  const source = state.tableau[from];
  const target = state.tableau[to];
  if (!source || !target || !Number.isInteger(index) || index < 0 || index >= source.length)
    return false;
  if (!canDragRun(source, index) || !canDropOnColumn(source[index]!, target))
    return false;
  target.push(...source.splice(index));
  flipTop(source);
  return true;
}

function flipTop(column: Card[]): void {
  const top = column.at(-1);
  if (top)
    top.faceUp = true;
}

/** A complete run needs all 13 cards face-up, of one suit, King first. */
function isCompleteRun(column: readonly Card[]): boolean {
  if (column.length < RUN_LENGTH)
    return false;
  const run = column.slice(-RUN_LENGTH);
  const suit = run[0]!.suit;
  return run.every((card, i) => card.faceUp && card.suit === suit && card.rank === RUN_LENGTH - i);
}

function clearCompletedRuns(state: SpiderState): void {
  for (const column of state.tableau) {
    while (isCompleteRun(column)) {
      column.splice(-RUN_LENGTH);
      state.completed++;
      flipTop(column);
    }
  }
}

/** Whether the cards from `index` down are a face-up, same-suit, descending run that can be picked up. */
export function canDragRun(column: readonly Card[], index: number): boolean {
  const first = column[index];
  if (!first?.faceUp)
    return false;
  for (let i = index + 1; i < column.length; i++) {
    const prev = column[i - 1]!;
    const cur = column[i]!;
    if (!cur.faceUp || cur.suit !== prev.suit || cur.rank !== prev.rank - 1)
      return false;
  }
  return true;
}

/** Any card goes on an empty column; otherwise on a card one rank higher, of any suit. */
export function canDropOnColumn(card: Card, column: readonly Card[]): boolean {
  const top = column.at(-1);
  return top === undefined || card.rank === top.rank - 1;
}

/** Why a deal is refused now, or `null` when it is allowed. */
export function dealBlock(state: SpiderState): DealBlock | null {
  if (state.stock.length < COLUMNS)
    return 'empty-stock';
  if (state.tableau.some(column => column.length === 0))
    return 'empty-column';
  return null;
}

export function cloneState(state: SpiderState): SpiderState {
  const clonePile = (pile: Card[]): Card[] => pile.map(card => ({ ...card }));
  return {
    completed: state.completed,
    stock: clonePile(state.stock),
    tableau: state.tableau.map(clonePile),
  };
}
