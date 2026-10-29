/**
 * Blackjack (21) rules as pure functions over plain JSON state: the deal, the
 * player's hit and stand, and the dealer's fixed play (draws to 17).
 */

import type { GameRules, GameStatus } from '../../core';
import type { Card } from '../../kits/cards';

import { makeSeededRng } from '@pierre/ecs/modules/rng';

import { makeDeck } from '../../kits/cards';

export type { Card } from '../../kits/cards';

/** Whose turn it is; `over` once the round has a result. */
export type Phase = 'dealer' | 'over' | 'player';
export type RoundResult = 'blackjack' | 'lose' | 'push' | 'win';

export interface BlackjackState {
  /** The dealer's first card is the hole card: face-down until the dealer plays. */
  dealer: Card[];
  deck: Card[];
  phase: Phase;
  player: Card[];
  result: RoundResult | null;
}

export type BlackjackMove
  = | { type: 'dealerStep' }
    | { type: 'hit' }
    | { type: 'stand' };

/** The dealer stands on this total or more. */
const DEALER_STANDS_ON = 17;
const BLACKJACK = 21;

function cardValue(card: Card): number {
  return Math.min(card.rank, 10);
}

/** Best hand value: each Ace counts 11 unless that would bust the hand, then 1. */
export function handValue(hand: readonly Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 1) {
      aces++;
      total += 11;
    }
    else {
      total += cardValue(card);
    }
  }
  while (total > BLACKJACK && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isBust(hand: readonly Card[]): boolean {
  return handValue(hand) > BLACKJACK;
}

export function isBlackjack(hand: readonly Card[]): boolean {
  return hand.length === 2 && handValue(hand) === BLACKJACK;
}

/**
 * Deals a round from `deck` (taking cards from its end): two to the player,
 * then two to the dealer. A blackjack on either side ends the round at once.
 */
export function dealRound(deck: Card[]): BlackjackState {
  const player = [deck.pop()!, deck.pop()!];
  const dealer = [deck.pop()!, deck.pop()!];
  for (const card of player)
    card.faceUp = true;
  dealer[0]!.faceUp = false;
  dealer[1]!.faceUp = true;

  const state: BlackjackState = { dealer, deck, phase: 'player', player, result: null };
  if (isBlackjack(dealer)) {
    finish(state, isBlackjack(player) ? 'push' : 'lose');
  }
  else if (isBlackjack(player)) {
    finish(state, 'blackjack');
  }
  return state;
}

function setup(seed: number): BlackjackState {
  return dealRound(makeDeck({ decks: 1, suits: 4 }, makeSeededRng(seed)));
}

function status(state: BlackjackState): GameStatus {
  switch (state.result) {
    case 'blackjack':
    case 'win':
      return 'won';
    case 'lose':
      return 'lost';
    case 'push':
      return 'draw';
    default:
      return 'playing';
  }
}

function apply(state: BlackjackState, move: BlackjackMove): BlackjackState | null {
  const next = cloneState(state);
  switch (move.type) {
    case 'dealerStep':
      return dealerStep(next) ? next : null;
    case 'hit':
      return hit(next) ? next : null;
    case 'stand':
      return stand(next) ? next : null;
  }
}

export const blackjackRules: GameRules<BlackjackState, BlackjackMove> = {
  apply,
  setup,
  status,
};

function finish(state: BlackjackState, result: RoundResult): void {
  state.phase = 'over';
  state.result = result;
  state.dealer[0]!.faceUp = true;
}

function hit(state: BlackjackState): boolean {
  if (state.phase !== 'player')
    return false;
  const card = state.deck.pop()!;
  card.faceUp = true;
  state.player.push(card);

  if (isBust(state.player))
    finish(state, 'lose');
  else if (handValue(state.player) === BLACKJACK)
    stand(state);
  return true;
}

function stand(state: BlackjackState): boolean {
  if (state.phase !== 'player')
    return false;
  state.phase = 'dealer';
  state.dealer[0]!.faceUp = true;
  return true;
}

/** One dealer action: stand on 17 or more and settle the round, otherwise draw a card. */
function dealerStep(state: BlackjackState): boolean {
  if (state.phase !== 'dealer')
    return false;
  if (handValue(state.dealer) < DEALER_STANDS_ON) {
    const card = state.deck.pop()!;
    card.faceUp = true;
    state.dealer.push(card);
  }
  if (handValue(state.dealer) >= DEALER_STANDS_ON)
    settle(state);
  return true;
}

function settle(state: BlackjackState): void {
  const player = handValue(state.player);
  const dealer = handValue(state.dealer);
  if (isBust(state.dealer) || player > dealer)
    finish(state, 'win');
  else
    finish(state, dealer > player ? 'lose' : 'push');
}

/** The line shown when the round is over, or `null` while it is being played. */
export function roundMessage(state: BlackjackState): string | null {
  if (state.result === null)
    return null;
  const player = handValue(state.player);
  const dealer = handValue(state.dealer);
  if (isBust(state.player))
    return `Bust! ${player} — You lose`;
  if (isBlackjack(state.dealer))
    return isBlackjack(state.player) ? 'Both have Blackjack — Push' : 'Dealer has Blackjack — You lose';
  switch (state.result) {
    case 'blackjack':
      return 'Blackjack! You win!';
    case 'push':
      return `${player} vs ${dealer} — Push`;
    case 'lose':
      return `${player} vs ${dealer} — Dealer wins`;
    default:
      return isBust(state.dealer) ? `Dealer busts! ${dealer} — You win!` : `${player} vs ${dealer} — You win!`;
  }
}

export function cloneState(state: BlackjackState): BlackjackState {
  const clonePile = (pile: Card[]): Card[] => pile.map(card => ({ ...card }));
  return {
    dealer: clonePile(state.dealer),
    deck: clonePile(state.deck),
    phase: state.phase,
    player: clonePile(state.player),
    result: state.result,
  };
}
