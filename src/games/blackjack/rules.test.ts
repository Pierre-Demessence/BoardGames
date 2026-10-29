import type { BlackjackMove, BlackjackState, Card } from './rules';

import { describe, expect, it } from 'vitest';

import { createSession } from '../../core';
import { blackjackRules, cloneState, dealRound, handValue, isBlackjack, isBust, roundMessage } from './rules';

let nextId = 0;

function card(rank: number, faceUp = false): Card {
  return { id: nextId++, faceUp, rank, suit: 'Spades' };
}

function hand(...ranks: number[]): Card[] {
  return ranks.map(rank => card(rank, true));
}

/**
 * A deck that deals `player` then `dealer` in the order given (cards are taken
 * from the end of the array), followed by the `next` cards, first one first.
 */
function deckFor(player: number[], dealer: number[], next: number[] = []): Card[] {
  const dealt = [...player, ...dealer].map(rank => card(rank));
  return [...next.toReversed().map(rank => card(rank)), ...dealt.toReversed()];
}

function play(state: BlackjackState, ...moves: BlackjackMove[]): BlackjackState {
  let current = state;
  for (const move of moves) {
    const next = blackjackRules.apply(current, move, 0);
    expect(next).not.toBeNull();
    current = next!;
  }
  return current;
}

function finishDealer(state: BlackjackState): BlackjackState {
  let current = state;
  while (current.phase === 'dealer')
    current = play(current, { type: 'dealerStep' });
  return current;
}

describe('hand values', () => {
  it('counts faces as 10 and an Ace as 11 or 1', () => {
    expect(handValue(hand(13, 12))).toBe(20);
    expect(handValue(hand(1, 13))).toBe(21);
    expect(handValue(hand(1, 1, 9))).toBe(21);
    expect(handValue(hand(1, 5, 10))).toBe(16);
  });

  it('detects bust and a two-card 21', () => {
    expect(isBust(hand(10, 6, 9))).toBe(true);
    expect(isBust(hand(10, 6, 5))).toBe(false);
    expect(isBlackjack(hand(1, 10))).toBe(true);
    expect(isBlackjack(hand(7, 7, 7))).toBe(false);
  });
});

describe('dealRound', () => {
  it('deals two cards each, the first dealer card face-down', () => {
    const state = dealRound(deckFor([10, 5], [9, 7]));
    expect(state.player.map(c => c.rank)).toEqual([10, 5]);
    expect(state.dealer.map(c => c.rank)).toEqual([9, 7]);
    expect(state.player.every(c => c.faceUp)).toBe(true);
    expect(state.dealer.map(c => c.faceUp)).toEqual([false, true]);
    expect(state.phase).toBe('player');
    expect(state.result).toBeNull();
    expect(blackjackRules.status(state)).toBe('playing');
  });

  it('ends the round at once with a loss when the dealer has blackjack (B13)', () => {
    const state = dealRound(deckFor([10, 9], [1, 13]));
    expect(state.phase).toBe('over');
    expect(state.result).toBe('lose');
    expect(state.dealer.every(c => c.faceUp)).toBe(true);
    expect(blackjackRules.status(state)).toBe('lost');
    expect(roundMessage(state)).toBe('Dealer has Blackjack — You lose');
  });

  it('is a push when both have blackjack', () => {
    const state = dealRound(deckFor([1, 12], [13, 1]));
    expect(state.phase).toBe('over');
    expect(state.result).toBe('push');
    expect(blackjackRules.status(state)).toBe('draw');
    expect(roundMessage(state)).toBe('Both have Blackjack — Push');
  });

  it('is a win with blackjack for the player alone', () => {
    const state = dealRound(deckFor([1, 13], [9, 7]));
    expect(state.result).toBe('blackjack');
    expect(blackjackRules.status(state)).toBe('won');
    expect(roundMessage(state)).toBe('Blackjack! You win!');
  });

  it('refuses every move once a natural ended the round', () => {
    const state = dealRound(deckFor([10, 9], [1, 13], [2]));
    for (const move of [{ type: 'hit' }, { type: 'stand' }, { type: 'dealerStep' }] as const)
      expect(blackjackRules.apply(state, move, 0)).toBeNull();
  });
});

describe('player turn', () => {
  it('a bust loses and reveals the dealer', () => {
    const state = play(dealRound(deckFor([10, 6], [9, 7], [10])), { type: 'hit' });
    expect(state.player).toHaveLength(3);
    expect(state.phase).toBe('over');
    expect(state.result).toBe('lose');
    expect(state.dealer[0]!.faceUp).toBe(true);
    expect(roundMessage(state)).toBe('Bust! 26 — You lose');
  });

  it('reaching 21 stands automatically', () => {
    const state = play(dealRound(deckFor([10, 5], [9, 7], [6])), { type: 'hit' });
    expect(state.phase).toBe('dealer');
    expect(state.dealer[0]!.faceUp).toBe(true);
  });

  it('stand hands the turn to the dealer and reveals the hole card', () => {
    const state = play(dealRound(deckFor([10, 8], [9, 7])), { type: 'stand' });
    expect(state.phase).toBe('dealer');
    expect(state.dealer[0]!.faceUp).toBe(true);
    expect(blackjackRules.apply(state, { type: 'hit' }, 0)).toBeNull();
    expect(blackjackRules.apply(state, { type: 'stand' }, 0)).toBeNull();
  });

  it('refuses a dealer step during the player turn', () => {
    expect(blackjackRules.apply(dealRound(deckFor([10, 8], [9, 7])), { type: 'dealerStep' }, 0)).toBeNull();
  });
});

describe('dealer turn', () => {
  it('draws until 17 and loses to a higher player hand', () => {
    const state = finishDealer(play(dealRound(deckFor([10, 9], [5, 6], [2, 4])), { type: 'stand' }));
    expect(state.dealer.map(c => c.rank)).toEqual([5, 6, 2, 4]);
    expect(state.result).toBe('win');
    expect(roundMessage(state)).toBe('19 vs 17 — You win!');
  });

  it('stands on 17 without drawing', () => {
    const state = finishDealer(play(dealRound(deckFor([10, 6], [10, 7], [2])), { type: 'stand' }));
    expect(state.dealer).toHaveLength(2);
    expect(state.result).toBe('lose');
    expect(roundMessage(state)).toBe('16 vs 17 — Dealer wins');
  });

  it('pushes on equal totals', () => {
    const state = finishDealer(play(dealRound(deckFor([10, 7], [10, 7])), { type: 'stand' }));
    expect(state.result).toBe('push');
    expect(roundMessage(state)).toBe('17 vs 17 — Push');
  });

  it('a dealer bust is a win for the player', () => {
    const state = finishDealer(play(dealRound(deckFor([10, 2], [10, 6], [10])), { type: 'stand' }));
    expect(isBust(state.dealer)).toBe(true);
    expect(state.result).toBe('win');
    expect(roundMessage(state)).toBe('Dealer busts! 26 — You win!');
  });

  it('plays one action per step', () => {
    const stood = play(dealRound(deckFor([10, 9], [5, 6], [2, 4])), { type: 'stand' });
    const stepped = play(stood, { type: 'dealerStep' });
    expect(stepped.dealer).toHaveLength(3);
    expect(stepped.phase).toBe('dealer');
  });
});

describe('purity and seeds', () => {
  it('never mutates the state it is given', () => {
    const state = dealRound(deckFor([10, 5], [9, 7], [2]));
    const before = JSON.stringify(state);
    blackjackRules.apply(state, { type: 'hit' }, 0);
    blackjackRules.apply(state, { type: 'stand' }, 0);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('deals the same cards for the same seed, and another round for another', () => {
    const a = blackjackRules.setup(7, undefined, 0);
    expect(blackjackRules.setup(7, undefined, 0)).toEqual(a);
    expect(blackjackRules.setup(8, undefined, 0)).not.toEqual(a);
  });

  it('deals 52 distinct cards in total', () => {
    const state = blackjackRules.setup(3, undefined, 0);
    const ids = [...state.player, ...state.dealer, ...state.deck].map(c => c.id);
    expect(new Set(ids).size).toBe(52);
  });

  it('survives a JSON round trip, at the deal and when over', () => {
    const dealt = blackjackRules.setup(21, undefined, 0);
    expect(JSON.parse(JSON.stringify(dealt))).toEqual(dealt);
    const over = finishDealer(play(dealRound(deckFor([10, 7], [10, 7])), { type: 'stand' }));
    expect(JSON.parse(JSON.stringify(over))).toEqual(over);
    expect(cloneState(over)).toEqual(over);
  });
});

describe('session without undo', () => {
  it('keeps no history, so there is nothing to take back', () => {
    const session = createSession(blackjackRules, { options: undefined, undoable: false });
    session.newGame(1);
    while (session.state.phase !== 'player')
      session.newGame(session.seed + 1);
    expect(session.apply({ type: 'stand' })).toBe(true);
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);
    expect(session.state.phase).toBe('dealer');
  });
});
