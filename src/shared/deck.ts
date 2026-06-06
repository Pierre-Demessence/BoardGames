import type { EntityId } from '@pierre/ecs';

import type { Suit } from './cards';

import { shuffle } from '@pierre/ecs/modules/rng';

import { RANKS, SUITS } from './cards';

export interface Card {
  id: EntityId;
  faceUp: boolean;
  rank: number;
  suit: Suit;
}

/** Create a standard 52-card deck, each card owning a new entity. */
export function makeDeck(createEntity: () => EntityId): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS)
      deck.push({ id: createEntity(), faceUp: false, rank, suit });
  }
  return deck;
}

/** Shuffle an array of cards in place (Fisher-Yates via engine RNG). */
export function shuffleDeck(deck: Card[]): void {
  shuffle(deck);
}
