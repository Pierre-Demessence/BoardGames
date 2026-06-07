/**
 * Blackjack (21) — game state, deck, hand values, and dealer rules.
 */

import type { Card } from '../../shared';
import type { CardLayout } from '../../shared/layout';

import { makeDeck, shuffleDeck } from '../../shared';

export type { Card } from '../../shared';

export type GameStatus = 'betting' | 'playerTurn' | 'dealerTurn' | 'roundOver';
export type RoundResult = 'win' | 'lose' | 'push' | 'blackjack';

export interface GameState {
  dealerHand: Card[];
  deck: Card[];
  layout: CardLayout;
  message: string;
  playerHand: Card[];
  result: RoundResult | null;
  status: GameStatus;
}

// --- Card values ---

function cardValue(card: Card): number {
  if (card.rank >= 10)
    return 10;
  return card.rank; // Ace = 1 here, handled in handValue
}

/** Best hand value (Ace = 1 or 11, whichever gives highest valid total ≤ 21). */
export function handValue(hand: Card[]): number {
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
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isBust(hand: Card[]): boolean {
  return handValue(hand) > 21;
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

// --- Deck & deal ---

export function dealNewGame(createEntity: () => number, layout: CardLayout): GameState {
  const deck = makeDeck(createEntity);
  shuffleDeck(deck);

  const playerHand: Card[] = [deck.pop()!, deck.pop()!];
  const dealerHand: Card[] = [deck.pop()!, deck.pop()!];

  // Flip player cards face-up, dealer's first card face-down
  playerHand[0]!.faceUp = true;
  playerHand[1]!.faceUp = true;
  dealerHand[0]!.faceUp = false;
  dealerHand[1]!.faceUp = true;

  return {
    dealerHand,
    deck,
    layout,
    message: 'Hit or Stand',
    playerHand,
    result: null,
    status: 'playerTurn',
  };
}

export function hit(state: GameState): void {
  const card = state.deck.pop()!;
  card.faceUp = true;
  state.playerHand.push(card);

  if (isBust(state.playerHand)) {
    state.status = 'roundOver';
    state.result = 'lose';
    state.message = `Bust! ${handValue(state.playerHand)} — You lose`;
    revealDealer(state);
  }
  else if (handValue(state.playerHand) === 21) {
    stand(state);
  }
}

export function stand(state: GameState): void {
  if (state.status !== 'playerTurn')
    return;

  state.status = 'dealerTurn';
  revealDealer(state);
}

/** Deal one card to the dealer. Returns true if the dealer should continue. */
export function dealerHit(state: GameState): boolean {
  if (state.status !== 'dealerTurn')
    return false;

  if (handValue(state.dealerHand) >= 17) {
    resolveRound(state);
    return false;
  }

  const card = state.deck.pop()!;
  card.faceUp = true;
  state.dealerHand.push(card);

  if (handValue(state.dealerHand) >= 17 || isBust(state.dealerHand)) {
    resolveRound(state);
    return false;
  }

  return true;
}

function revealDealer(state: GameState): void {
  state.dealerHand[0]!.faceUp = true;
}

function resolveRound(state: GameState): void {
  state.status = 'roundOver';
  const player = handValue(state.playerHand);
  const dealer = handValue(state.dealerHand);

  if (isBust(state.dealerHand)) {
    state.result = 'win';
    state.message = `Dealer busts! ${dealer} — You win!`;
  }
  else if (player > dealer) {
    state.result = 'win';
    state.message = `${player} vs ${dealer} — You win!`;
  }
  else if (dealer > player) {
    state.result = 'lose';
    state.message = `${player} vs ${dealer} — Dealer wins`;
  }
  else {
    state.result = 'push';
    state.message = `${player} vs ${dealer} — Push`;
  }
}

/** Check for natural blackjack at the start of a round. */
export function checkNaturalBlackjack(state: GameState): boolean {
  if (isBlackjack(state.playerHand)) {
    revealDealer(state);
    if (isBlackjack(state.dealerHand)) {
      state.status = 'roundOver';
      state.result = 'push';
      state.message = 'Both have Blackjack — Push';
    }
    else {
      state.status = 'roundOver';
      state.result = 'blackjack';
      state.message = 'Blackjack! You win!';
    }
    return true;
  }
  return false;
}
