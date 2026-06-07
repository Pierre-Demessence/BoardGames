/**
 * Klondike Solitaire game state, layout, and move rules.
 *
 * Uses dynamic layout via {@link initLayout} — call once before dealing.
 * All position functions read layout from the game state.
 */

import type { EntityId } from '@pierre/ecs';

import type { Card } from '../../shared';
import type { CardLayout } from '../../shared/layout';

import { makeDeck, shuffleDeck, suitColor } from '../../shared';
import { computeLayout } from '../../shared/layout';

export type { Card } from '../../shared';

export type PileKind = 'foundation' | 'stock' | 'tableau' | 'waste';

export interface PileRef {
  index: number;
  kind: PileKind;
}

export interface GameState {
  foundations: Card[][];
  layout: CardLayout;
  score: number;
  startTime: number;
  stock: Card[];
  tableau: Card[][];
  waste: Card[];
  won: boolean;
}

const SOLITAIRE_SLOTS = 7;

/** Compute the layout for the current viewport. Call before dealing. */
export function initLayout(containerW: number, containerH: number): CardLayout {
  return computeLayout(containerW, containerH, SOLITAIRE_SLOTS);
}

// --- Board layout ---

const FAN_FACE_UP_RATIO = 0.3;
const FAN_FACE_DOWN_RATIO = 0.125;
const TABLEAU_Y_GAP = 0.3; // fraction of card height between top row and tableau

function tableauY(layout: CardLayout): number {
  return layout.topY + layout.cardH + Math.round(layout.cardH * TABLEAU_Y_GAP);
}

const FOUNDATION_COL = [3, 4, 5, 6];

function columnX(layout: CardLayout, col: number): number {
  return layout.marginX + col * layout.colPitch;
}

export function slotPosition(layout: CardLayout, pile: PileRef): { x: number; y: number } {
  switch (pile.kind) {
    case 'foundation':
      return { x: columnX(layout, FOUNDATION_COL[pile.index]!), y: layout.topY };
    case 'stock':
      return { x: columnX(layout, 0), y: layout.topY };
    case 'tableau':
      return { x: columnX(layout, pile.index), y: tableauY(layout) };
    case 'waste':
      return { x: columnX(layout, 1), y: layout.topY };
  }
}

export function cardPosition(
  state: GameState,
  pile: PileRef,
  indexInPile: number,
): { x: number; y: number } {
  const { layout } = state;
  const base = slotPosition(layout, pile);
  if (pile.kind !== 'tableau')
    return base;

  const column = state.tableau[pile.index]!;
  let y = base.y;
  for (let i = 0; i < indexInPile; i++) {
    y += column[i]!.faceUp
      ? Math.round(layout.cardH * FAN_FACE_UP_RATIO)
      : Math.round(layout.cardH * FAN_FACE_DOWN_RATIO);
  }
  return { x: base.x, y };
}

export function pileArray(state: GameState, pile: PileRef): Card[] {
  switch (pile.kind) {
    case 'foundation':
      return state.foundations[pile.index]!;
    case 'stock':
      return state.stock;
    case 'tableau':
      return state.tableau[pile.index]!;
    case 'waste':
      return state.waste;
  }
}

// --- Deck construction + deal ---

export function dealNewGame(createEntity: () => EntityId, layout: CardLayout): GameState {
  const deck = makeDeck(createEntity);
  shuffleDeck(deck);

  const tableau: Card[][] = [[], [], [], [], [], [], []];
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop()!;
      card.faceUp = row === col;
      tableau[col]!.push(card);
    }
  }

  return {
    foundations: [[], [], [], []],
    layout,
    score: 0,
    startTime: Date.now(),
    stock: deck,
    tableau,
    waste: [],
    won: false,
  };
}

// --- Move rules ---

export function canDropOnFoundation(card: Card, foundation: Card[]): boolean {
  const top = foundation.at(-1);
  if (top === undefined)
    return card.rank === 1;
  return top.suit === card.suit && card.rank === top.rank + 1;
}

export function canDropOnTableau(movingFirst: Card, column: Card[]): boolean {
  const top = column.at(-1);
  if (top === undefined)
    return movingFirst.rank === 13;
  return suitColor(top.suit) !== suitColor(movingFirst.suit)
    && movingFirst.rank === top.rank - 1;
}

export function findFoundationFor(state: GameState, card: Card): number {
  for (let i = 0; i < state.foundations.length; i++) {
    if (canDropOnFoundation(card, state.foundations[i]!))
      return i;
  }
  return -1;
}

export function isWon(state: GameState): boolean {
  return state.foundations.every(f => f.length === 13);
}

// --- Scoring (Windows Klondike rules) ---

export function awardPoints(state: GameState, points: number): void {
  state.score = Math.max(0, state.score + points);
}

/** Points for moving a card between piles. */
export function movePoints(from: PileRef, to: PileRef): number {
  if (to.kind === 'foundation') {
    if (from.kind === 'waste')
      return 10;
    if (from.kind === 'tableau')
      return 10;
  }
  if (to.kind === 'tableau' && from.kind === 'waste')
    return 5;
  if (to.kind === 'tableau' && from.kind === 'foundation')
    return -15;
  return 0;
}

/** Points for flipping a face-down tableau card. */
export const FLIP_POINTS = 5;

/** Points for recycling the waste pile. */
export const RECYCLE_PENALTY = -100;

/** Time penalty: -2 points per 10 seconds elapsed. */
export function computeTimePenalty(state: GameState): number {
  const elapsed = (Date.now() - state.startTime) / 1000;
  return -Math.floor(elapsed / 10) * 2;
}

/** Time bonus: 700000 ÷ seconds, if game took ≥ 30 seconds. */
export function computeTimeBonus(state: GameState): number {
  const elapsed = (Date.now() - state.startTime) / 1000;
  if (elapsed < 30)
    return 0;
  return Math.floor(700000 / elapsed);
}

/** Final score including time bonus. Call when the game is won. */
export function finalScore(state: GameState): number {
  return Math.max(0, state.score + computeTimeBonus(state));
}
