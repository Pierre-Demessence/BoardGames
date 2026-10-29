/**
 * Klondike Solitaire (draw-1) rules as pure functions over plain JSON state.
 * Scoring follows the Windows rules; the time penalty is derived from the
 * clock when displayed, not accumulated in the state.
 */

import type { GameRules, GameStatus } from '../../core';
import type { Card } from '../../kits/cards';

import { makeSeededRng } from '@pierre/ecs/modules/rng';

import { makeDeck, suitColor } from '../../kits/cards';

export type { Card } from '../../kits/cards';

export type PileKind = 'foundation' | 'stock' | 'tableau' | 'waste';

export interface PileRef {
  index: number;
  kind: PileKind;
}

export interface SolitaireState {
  /** When the last foundation card was placed, `null` while playing. */
  endedAt: number | null;
  foundations: Card[][];
  /** Move points only; the time penalty is added when displaying (see {@link displayScore}). */
  score: number;
  startedAt: number;
  stock: Card[];
  tableau: Card[][];
  waste: Card[];
}

export type SolitaireMove
  = | { type: 'draw' }
    | { type: 'move'; from: PileRef; index: number; to: PileRef };

export const TABLEAU_COLUMNS = 7;
export const FOUNDATIONS = 4;

/** Points for flipping a face-down tableau card. */
export const FLIP_POINTS = 5;

/** Points for recycling the waste pile back into the stock. */
export const RECYCLE_PENALTY = -100;

/** The time penalty is this many points ... */
const TIME_PENALTY_POINTS = 2;
/** ... per this many seconds. */
const TIME_PENALTY_SECONDS = 10;

/** A win faster than this earns no time bonus. */
const TIME_BONUS_MIN_SECONDS = 30;
const TIME_BONUS_NUMERATOR = 700_000;

function setup(seed: number, _options: void, now: number): SolitaireState {
  const deck = makeDeck({ decks: 1, suits: 4 }, makeSeededRng(seed));
  const tableau: Card[][] = Array.from({ length: TABLEAU_COLUMNS }, () => []);
  for (let col = 0; col < TABLEAU_COLUMNS; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop()!;
      card.faceUp = row === col;
      tableau[col]!.push(card);
    }
  }
  return {
    endedAt: null,
    foundations: Array.from({ length: FOUNDATIONS }, () => []),
    score: 0,
    startedAt: now,
    stock: deck,
    tableau,
    waste: [],
  };
}

function status(state: SolitaireState): GameStatus {
  return state.foundations.every(f => f.length === 13) ? 'won' : 'playing';
}

function apply(state: SolitaireState, move: SolitaireMove, now: number): SolitaireState | null {
  if (status(state) === 'won')
    return null;
  const next = cloneState(state);
  const ok = move.type === 'draw' ? draw(next) : moveCards(next, move.from, move.index, move.to);
  if (!ok)
    return null;
  if (status(next) === 'won') {
    next.endedAt = now;
    next.score = Math.max(0, next.score + timeBonus(next.endedAt - next.startedAt));
  }
  return next;
}

export const solitaireRules: GameRules<SolitaireState, SolitaireMove> = {
  apply,
  setup,
  status,
};

/** Draws a card from the stock to the waste, or recycles the waste when the stock is empty. */
function draw(state: SolitaireState): boolean {
  if (state.stock.length > 0) {
    const card = state.stock.pop()!;
    card.faceUp = true;
    state.waste.push(card);
    return true;
  }
  if (state.waste.length === 0)
    return false;
  while (state.waste.length > 0) {
    const card = state.waste.pop()!;
    card.faceUp = false;
    state.stock.push(card);
  }
  awardPoints(state, RECYCLE_PENALTY);
  return true;
}

function moveCards(state: SolitaireState, from: PileRef, index: number, to: PileRef): boolean {
  if (from.kind === 'stock' || to.kind === 'stock' || to.kind === 'waste')
    return false;
  if (from.kind === to.kind && from.index === to.index)
    return false;
  // Moving between foundations changes nothing a player wants.
  if (from.kind === 'foundation' && to.kind === 'foundation')
    return false;

  const source = pileOf(state, from);
  const target = pileOf(state, to);
  if (!source || !target || !Number.isInteger(index) || index < 0 || index >= source.length)
    return false;

  const moving = source.slice(index);
  const first = moving[0]!;
  if (!first.faceUp)
    return false;
  // Only a tableau column is picked up as a run; every other pile gives its top card.
  if (from.kind !== 'tableau' && moving.length !== 1)
    return false;

  if (to.kind === 'foundation') {
    if (moving.length !== 1 || !canDropOnFoundation(first, target))
      return false;
  }
  else if (!canDropOnTableau(first, target)) {
    return false;
  }

  source.splice(index, moving.length);
  target.push(...moving);
  awardPoints(state, movePoints(from, to));
  const exposed = from.kind === 'tableau' ? source.at(-1) : undefined;
  if (exposed && !exposed.faceUp) {
    exposed.faceUp = true;
    awardPoints(state, FLIP_POINTS);
  }
  return true;
}

export function pileOf(state: SolitaireState, pile: PileRef): Card[] | undefined {
  switch (pile.kind) {
    case 'foundation':
      return state.foundations[pile.index];
    case 'stock':
      return state.stock;
    case 'tableau':
      return state.tableau[pile.index];
    case 'waste':
      return state.waste;
  }
}

export function canDropOnFoundation(card: Card, foundation: readonly Card[]): boolean {
  const top = foundation.at(-1);
  if (top === undefined)
    return card.rank === 1;
  return top.suit === card.suit && card.rank === top.rank + 1;
}

export function canDropOnTableau(first: Card, column: readonly Card[]): boolean {
  const top = column.at(-1);
  if (top === undefined)
    return first.rank === 13;
  return suitColor(top.suit) !== suitColor(first.suit) && first.rank === top.rank - 1;
}

/** The foundation that takes `card` (for a double-click), or `null`. */
export function foundationTarget(state: SolitaireState, card: Card): number | null {
  const index = state.foundations.findIndex(f => canDropOnFoundation(card, f));
  return index === -1 ? null : index;
}

/**
 * The next move of the automatic finish, or `null` when it does not apply: it
 * applies once the stock is empty and every tableau card is face-up, and moves
 * the waste top or the first tableau top that fits a foundation.
 */
export function nextAutoFinishMove(state: SolitaireState): SolitaireMove | null {
  if (state.stock.length > 0 || state.tableau.some(col => col.some(card => !card.faceUp)))
    return null;
  const wasteTop = state.waste.at(-1);
  if (wasteTop) {
    const target = foundationTarget(state, wasteTop);
    if (target !== null) {
      return {
        from: { index: 0, kind: 'waste' },
        index: state.waste.length - 1,
        to: { index: target, kind: 'foundation' },
        type: 'move',
      };
    }
  }
  for (let col = 0; col < state.tableau.length; col++) {
    const pile = state.tableau[col]!;
    const top = pile.at(-1);
    const target = top ? foundationTarget(state, top) : null;
    if (target !== null) {
      return {
        from: { index: col, kind: 'tableau' },
        index: pile.length - 1,
        to: { index: target, kind: 'foundation' },
        type: 'move',
      };
    }
  }
  return null;
}

// --- Scoring ---

function awardPoints(state: SolitaireState, points: number): void {
  state.score = Math.max(0, state.score + points);
}

/** Points for moving cards between piles (Windows Klondike rules). */
export function movePoints(from: PileRef, to: PileRef): number {
  if (to.kind === 'foundation' && (from.kind === 'waste' || from.kind === 'tableau'))
    return 10;
  if (to.kind === 'tableau' && from.kind === 'waste')
    return 5;
  if (to.kind === 'tableau' && from.kind === 'foundation')
    return -15;
  return 0;
}

/** Milliseconds played: up to the win, or up to `now` while playing. */
export function elapsedMs(state: SolitaireState, now: number): number {
  return Math.max(0, (state.endedAt ?? now) - state.startedAt);
}

/** Time penalty: 2 points per full 10 seconds played, as a negative number. */
export function timePenalty(elapsed: number): number {
  return -Math.floor(elapsed / 1000 / TIME_PENALTY_SECONDS) * TIME_PENALTY_POINTS;
}

/** Time bonus for a win after `elapsed` milliseconds: 700000 ÷ seconds, from 30 seconds on. */
function timeBonus(elapsed: number): number {
  const seconds = elapsed / 1000;
  if (seconds < TIME_BONUS_MIN_SECONDS)
    return 0;
  return Math.floor(TIME_BONUS_NUMERATOR / seconds);
}

/** The score to show: move points plus the time penalty so far, never below 0. */
export function displayScore(state: SolitaireState, now: number): number {
  return Math.max(0, state.score + timePenalty(elapsedMs(state, now)));
}

export function cloneState(state: SolitaireState): SolitaireState {
  const clonePile = (pile: Card[]): Card[] => pile.map(card => ({ ...card }));
  return {
    endedAt: state.endedAt,
    foundations: state.foundations.map(clonePile),
    score: state.score,
    startedAt: state.startedAt,
    stock: clonePile(state.stock),
    tableau: state.tableau.map(clonePile),
    waste: clonePile(state.waste),
  };
}
