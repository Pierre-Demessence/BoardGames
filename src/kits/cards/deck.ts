import type { RandomFn } from '@pierre/ecs/modules/rng';

import type { Suit } from './cards';

import { shuffle } from '@pierre/ecs/modules/rng';

import { RANKS } from './cards';

/**
 * Plain-JSON card. `id` is the card's index in the deal, unique within a game;
 * it is never an entity id (the view keeps the id-to-entity mapping).
 */
export interface Card {
  id: number;
  faceUp: boolean;
  rank: number;
  suit: Suit;
}

export interface DeckSpec {
  /** Number of 52-card decks. */
  decks: number;
  /** Distinct suits in play; each suit is repeated so every deck still has 52 cards. */
  suits: 1 | 2 | 4;
}

/** Suits in the order a reduced deck uses them (1-suit Spider is all Spades). */
const SUIT_ORDER: readonly Suit[] = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];

/**
 * Builds a shuffled, face-down deck. The shuffle uses `rand`, so the same
 * seeded generator always gives the same order; ids are assigned after it.
 */
export function makeDeck({ decks, suits }: DeckSpec, rand: RandomFn): Card[] {
  const used = SUIT_ORDER.slice(0, suits);
  const cards: Omit<Card, 'id'>[] = [];
  for (let deck = 0; deck < decks; deck++) {
    for (let set = 0; set < SUIT_ORDER.length; set++) {
      const suit = used[set % suits]!;
      for (const rank of RANKS)
        cards.push({ faceUp: false, rank, suit });
    }
  }
  shuffle(cards, rand);
  return cards.map((card, id) => ({ ...card, id }));
}
