/**
 * Spider Solitaire (1-suit) — game state, layout, and move rules.
 *
 * The deck is 104 cards (8 copies of each rank A→K, all the same suit).
 * Cards are dealt into 10 tableau columns; the stock deals one card to
 * each column on click. Completed K→A runs auto-remove.
 */

import type { EntityId } from '@pierre/ecs';

import type { Card } from '../../shared';

import { CARD_H, CARD_W, shuffleDeck } from '../../shared';

export type { Card } from '../../shared';

export interface GameState {
  completed: number;
  stock: Card[];
  tableau: Card[][];
  won: boolean;
}

// --- Board layout ---

export { CARD_H, CARD_W };

export const CANVAS_W = 1040;
export const CANVAS_H = 720;

const MARGIN_X = 28;
const TOP_Y = 20;
const TABLEAU_Y = TOP_Y + CARD_H + 24;
const COL_PITCH = 96;
const FAN_FACE_UP = 24;
const FAN_FACE_DOWN = 10;
const COLUMNS = 10;

export { COLUMNS };

// --- Layout helpers ---

/** Position and size of the stock deck visual. */
export function stockSlotPosition(): { x: number; y: number } {
  return { x: MARGIN_X, y: TOP_Y };
}

export const STOCK_DECK_W = 60;
export const STOCK_DECK_H = 84;

function columnX(col: number): number {
  return MARGIN_X + col * COL_PITCH;
}

/** Top-left of a tableau column's base slot. */
export function columnSlotPosition(col: number): { x: number; y: number } {
  return { x: columnX(col), y: TABLEAU_Y };
}

/** Top-left of the card at `index` within tableau column `col`. */
export function cardPosition(
  state: GameState,
  col: number,
  index: number,
): { x: number; y: number } {
  const base = columnSlotPosition(col);
  const column = state.tableau[col]!;
  let y = base.y;
  for (let i = 0; i < index; i++)
    y += column[i]!.faceUp ? FAN_FACE_UP : FAN_FACE_DOWN;
  return { x: base.x, y };
}

// --- Deck construction + deal ---

/** Create a 1-suit Spider deck: 8 copies of each rank (A→K), all Spades. */
function makeSpiderDeck(createEntity: () => EntityId): Card[] {
  const deck: Card[] = [];
  for (let copy = 0; copy < 8; copy++) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: createEntity(), faceUp: false, rank, suit: 'Spades' });
    }
  }
  return deck;
}

export function dealNewGame(createEntity: () => EntityId): GameState {
  const deck = makeSpiderDeck(createEntity);
  shuffleDeck(deck);

  const tableau: Card[][] = Array.from({ length: COLUMNS }, () => []);

  // Cols 0-3: 6 cards, cols 4-9: 5 cards
  for (let col = 0; col < COLUMNS; col++) {
    const count = col < 4 ? 6 : 5;
    for (let row = 0; row < count; row++) {
      const card = deck.pop()!;
      card.faceUp = row === count - 1;
      tableau[col]!.push(card);
    }
  }

  return {
    completed: 0,
    stock: deck,
    tableau,
    won: false,
  };
}

// --- Move rules ---

/**
 * Check whether the face-up cards starting at `index` in `column`
 * form a valid same-suit descending run that can be dragged.
 * In 1-suit mode this is always true for any face-up cards.
 */
export function canDragRun(column: Card[], index: number): boolean {
  const card = column[index]!;
  if (!card.faceUp)
    return false;
  for (let i = index + 1; i < column.length; i++) {
    const prev = column[i - 1]!;
    const cur = column[i]!;
    if (!cur.faceUp || cur.suit !== prev.suit || cur.rank !== prev.rank - 1)
      return false;
  }
  return true;
}

/** Whether `card` can be placed on `targetColumn`. */
export function canDropOnColumn(card: Card, targetColumn: Card[]): boolean {
  if (targetColumn.length === 0)
    return true;
  const top = targetColumn.at(-1)!;
  return card.rank === top.rank - 1;
}

/**
 * Check for and remove any complete K→A same-suit run at the top of a column.
 * Returns the count of completed runs and the IDs of removed cards so the
 * caller can destroy their ECS entities.
 */
export function removeCompletedRuns(state: GameState): { count: number; removedIds: EntityId[] } {
  let count = 0;
  const removedIds: EntityId[] = [];
  for (let col = 0; col < COLUMNS; col++) {
    const column = state.tableau[col]!;
    if (column.length < 13)
      continue;

    // Check if the last 13 cards form K→A same-suit
    const start = column.length - 13;
    let valid = true;

    // Top card must be Ace (rank 1)
    if (column[start + 12]!.rank !== 1)
      valid = false;

    for (let i = start; valid && i < start + 12; i++) {
      const cur = column[i]!;
      const next = column[i + 1]!;
      if (cur.suit !== next.suit || cur.rank !== next.rank + 1)
        valid = false;
    }

    if (valid) {
      const removed = column.splice(start, 13);
      for (const card of removed)
        removedIds.push(card.id);
      count++;
      // Flip the new top card if any
      const newTop = column.at(-1);
      if (newTop && !newTop.faceUp)
        newTop.faceUp = true;
    }
  }
  return { count, removedIds };
}

/** Deal one card from the stock to each tableau column. Requires all columns non-empty. */
export function dealFromStock(state: GameState): boolean {
  if (state.stock.length < COLUMNS)
    return false;
  for (let col = 0; col < COLUMNS; col++) {
    if (state.tableau[col]!.length === 0)
      return false;
  }
  for (let col = 0; col < COLUMNS; col++) {
    const card = state.stock.pop()!;
    card.faceUp = true;
    state.tableau[col]!.push(card);
  }
  return true;
}

export function isWon(state: GameState): boolean {
  return state.completed >= 8;
}
