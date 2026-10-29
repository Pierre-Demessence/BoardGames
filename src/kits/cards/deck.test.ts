import { makeSeededRng } from '@pierre/ecs/modules/rng';
import { describe, expect, it } from 'vitest';

import { makeDeck } from './deck';

describe('makeDeck', () => {
  it('builds one standard 52-card deck', () => {
    const deck = makeDeck({ decks: 1, suits: 4 }, makeSeededRng(1));
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(c => `${c.suit}|${c.rank}`)).size).toBe(52);
    expect(deck.every(c => !c.faceUp)).toBe(true);
  });

  it('numbers the cards 0..n-1 in deal order', () => {
    const deck = makeDeck({ decks: 1, suits: 4 }, makeSeededRng(1));
    expect(deck.map(c => c.id)).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });

  it('deals the same order for the same seed and another for another seed', () => {
    const order = (seed: number): string[] =>
      makeDeck({ decks: 1, suits: 4 }, makeSeededRng(seed)).map(c => `${c.suit}${c.rank}`);
    expect(order(5)).toEqual(order(5));
    expect(order(5)).not.toEqual(order(6));
  });

  it('shuffles the deck', () => {
    const deck = makeDeck({ decks: 1, suits: 4 }, makeSeededRng(3));
    const unshuffled = [...deck].sort((a, b) => a.suit.localeCompare(b.suit) || a.rank - b.rank);
    expect(deck.map(c => c.id)).not.toEqual(unshuffled.map(c => c.id));
  });

  it('builds 2 decks of a single suit like 1-suit Spider', () => {
    const deck = makeDeck({ decks: 2, suits: 1 }, makeSeededRng(1));
    expect(deck).toHaveLength(104);
    expect(new Set(deck.map(c => c.suit))).toEqual(new Set(['Spades']));
    for (let rank = 1; rank <= 13; rank++)
      expect(deck.filter(c => c.rank === rank)).toHaveLength(8);
  });

  it('splits 2 decks evenly between two suits', () => {
    const deck = makeDeck({ decks: 2, suits: 2 }, makeSeededRng(1));
    expect(deck).toHaveLength(104);
    expect(deck.filter(c => c.suit === 'Spades')).toHaveLength(52);
    expect(deck.filter(c => c.suit === 'Hearts')).toHaveLength(52);
  });

  it('is plain JSON', () => {
    const deck = makeDeck({ decks: 1, suits: 4 }, makeSeededRng(1));
    expect(JSON.parse(JSON.stringify(deck))).toEqual(deck);
  });
});
