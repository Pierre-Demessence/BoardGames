import type { Card } from './deck';

import { describe, expect, it } from 'vitest';

import { makeDeck, shuffleDeck } from './deck';

function entityCounter(): () => number {
  let id = 0;
  return () => ++id;
}

describe('makeDeck', () => {
  it('creates exactly 52 cards', () => {
    const deck = makeDeck(entityCounter());
    expect(deck).toHaveLength(52);
  });

  it('assigns a unique entity ID to each card', () => {
    const deck = makeDeck(entityCounter());
    const ids = deck.map(c => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(52);
  });

  it('sets all cards face-down', () => {
    const deck = makeDeck(entityCounter());
    expect(deck.every(c => !c.faceUp)).toBe(true);
  });

  it('contains exactly one of each suit × rank combination', () => {
    const deck = makeDeck(entityCounter());
    const keys = deck.map(c => `${c.suit}|${c.rank}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(52);
  });

  it('contains all 4 suits', () => {
    const deck = makeDeck(entityCounter());
    const suits = new Set(deck.map(c => c.suit));
    expect(suits.size).toBe(4);
    expect(suits.has('Clubs')).toBe(true);
    expect(suits.has('Diamonds')).toBe(true);
    expect(suits.has('Hearts')).toBe(true);
    expect(suits.has('Spades')).toBe(true);
  });

  it('contains ranks 1 through 13 for each suit', () => {
    const deck = makeDeck(entityCounter());
    for (const suit of ['Clubs', 'Diamonds', 'Hearts', 'Spades'] as const) {
      const ranks = deck.filter(c => c.suit === suit).map(c => c.rank).sort((a, b) => a - b);
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    }
  });

  it('uses the provided createEntity function', () => {
    const ids: number[] = [];
    const deck = makeDeck(() => {
      const id = Math.random();
      ids.push(id);
      return id;
    });
    expect(ids).toHaveLength(52);
    expect(deck.map(c => c.id)).toEqual(ids);
  });
});

describe('shuffleDeck', () => {
  it('preserves all cards after shuffling', () => {
    const deck = makeDeck(entityCounter());
    const originalIds = new Set(deck.map(c => c.id));
    shuffleDeck(deck);
    const shuffledIds = new Set(deck.map(c => c.id));
    expect(shuffledIds).toEqual(originalIds);
    expect(deck).toHaveLength(52);
  });

  it('handles an empty deck', () => {
    const deck: Card[] = [];
    expect(() => shuffleDeck(deck)).not.toThrow();
    expect(deck).toHaveLength(0);
  });

  it('handles a single-card deck', () => {
    const deck: Card[] = [{ id: 1, faceUp: false, rank: 5, suit: 'Hearts' }];
    shuffleDeck(deck);
    expect(deck).toHaveLength(1);
    expect(deck[0]!.id).toBe(1);
  });

  it('produces a different ordering from a sorted deck (probabilistic)', () => {
    // With 52! permutations, the chance of getting the same order back is effectively zero.
    const deck = makeDeck(entityCounter());
    const originalOrder = deck.map(c => c.id).join(',');
    shuffleDeck(deck);
    const newOrder = deck.map(c => c.id).join(',');
    expect(newOrder).not.toBe(originalOrder);
  });
});
