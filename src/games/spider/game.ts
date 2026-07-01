/**
 * Spider Solitaire (1-suit) — game state, layout, and move rules.
 *
 * Dynamic layout: call {@link initLayout} once before dealing.
 */

import type { EntityId } from '@pierre/ecs';

import type { Card } from '../../shared';
import type { CardLayout } from '../../shared/layout';

import { FAN_FACE_DOWN_RATIO, FAN_FACE_UP_RATIO, shuffleDeck, TABLEAU_Y_GAP } from '../../shared';
import { computeLayout } from '../../shared/layout';

export type { Card } from '../../shared';

export interface GameState {
  completed: number;
  layout: CardLayout;
  stock: Card[];
  tableau: Card[][];
  won: boolean;
}

const SPIDER_SLOTS = 10;

export function initLayout(containerW: number, containerH: number): CardLayout {
  return computeLayout(containerW, containerH, SPIDER_SLOTS);
}

// --- Board layout ---

export { SPIDER_SLOTS as COLUMNS };

function tableauY(layout: CardLayout): number {
  return layout.topY + layout.cardH + Math.round(layout.cardH * TABLEAU_Y_GAP);
}

function columnX(layout: CardLayout, col: number): number {
  return layout.marginX + col * layout.colPitch;
}

export function stockSlotPosition(layout: CardLayout): { x: number; y: number } {
  return { x: layout.marginX, y: layout.topY };
}

export const STOCK_DECK_W_RATIO = 0.75; // deck width relative to card width
export const STOCK_DECK_H_RATIO = 1.05; // deck height relative to card height (taller to show stack)

export function columnSlotPosition(layout: CardLayout, col: number): { x: number; y: number } {
  return { x: columnX(layout, col), y: tableauY(layout) };
}

export function cardPosition(
  state: GameState,
  col: number,
  index: number,
): { x: number; y: number } {
  const { layout } = state;
  const base = columnSlotPosition(layout, col);
  const column = state.tableau[col]!;
  let y = base.y;
  for (let i = 0; i < index; i++) {
    y += column[i]!.faceUp
      ? Math.round(layout.cardH * FAN_FACE_UP_RATIO)
      : Math.round(layout.cardH * FAN_FACE_DOWN_RATIO);
  }
  return { x: base.x, y };
}

// --- Deck ---

function makeSpiderDeck(createEntity: () => EntityId): Card[] {
  const deck: Card[] = [];
  for (let copy = 0; copy < 8; copy++) {
    for (let rank = 1; rank <= 13; rank++)
      deck.push({ id: createEntity(), faceUp: false, rank, suit: 'Spades' });
  }
  return deck;
}

export function dealNewGame(createEntity: () => EntityId, layout: CardLayout): GameState {
  const deck = makeSpiderDeck(createEntity);
  shuffleDeck(deck);

  const tableau: Card[][] = Array.from({ length: SPIDER_SLOTS }, () => []);

  for (let col = 0; col < SPIDER_SLOTS; col++) {
    const count = col < 4 ? 6 : 5;
    for (let row = 0; row < count; row++) {
      const card = deck.pop()!;
      card.faceUp = row === count - 1;
      tableau[col]!.push(card);
    }
  }

  return {
    completed: 0,
    layout,
    stock: deck,
    tableau,
    won: false,
  };
}

// --- Move rules ---

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

export function canDropOnColumn(card: Card, targetColumn: Card[]): boolean {
  if (targetColumn.length === 0)
    return true;
  const top = targetColumn.at(-1)!;
  return card.rank === top.rank - 1;
}

/** Returns count of completed runs + IDs of removed cards for entity cleanup. */
export function removeCompletedRuns(state: GameState): { count: number; removedIds: EntityId[] } {
  let count = 0;
  const removedIds: EntityId[] = [];
  for (let col = 0; col < SPIDER_SLOTS; col++) {
    const column = state.tableau[col]!;
    if (column.length < 13)
      continue;

    const start = column.length - 13;
    let valid = true;

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
      const newTop = column.at(-1);
      if (newTop && !newTop.faceUp)
        newTop.faceUp = true;
    }
  }
  return { count, removedIds };
}

export function dealFromStock(state: GameState): boolean {
  if (state.stock.length < SPIDER_SLOTS)
    return false;
  for (let col = 0; col < SPIDER_SLOTS; col++) {
    if (state.tableau[col]!.length === 0)
      return false;
  }
  for (let col = 0; col < SPIDER_SLOTS; col++) {
    const card = state.stock.pop()!;
    card.faceUp = true;
    state.tableau[col]!.push(card);
  }
  return true;
}

export function isWon(state: GameState): boolean {
  return state.completed >= 8;
}
