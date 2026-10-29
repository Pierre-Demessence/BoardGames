/**
 * Who plays a multi-seat game: one seat per player, human or computer, and whose
 * turn it is. Plain JSON, so it sits in a game's state and a saved game knows who
 * plays. The turn order's seats are the seat indexes `0..n-1`.
 */

import type { TurnOrder } from '@pierre/ecs/modules/turn-based';

import { advanceTurn, currentSeat, makeTurnOrder } from '@pierre/ecs/modules/turn-based';

export type SeatKind = 'computer' | 'human';

export interface Seats {
  kinds: SeatKind[];
  turn: TurnOrder<number>;
}

/** Seats of the given kinds with seat 0 to play. Throws with no seat. */
export function makeSeats(kinds: readonly SeatKind[]): Seats {
  if (kinds.length === 0)
    throw new Error('A game needs at least one seat.');
  return { kinds: [...kinds], turn: makeTurnOrder(kinds.map((_, seat) => seat)) };
}

/** The index of the seat holding the turn. */
export function seatToPlay(seats: Seats): number {
  return currentSeat(seats.turn)!;
}

export function isComputerTurn(seats: Seats): boolean {
  return seats.kinds[seatToPlay(seats)] === 'computer';
}

/** A copy with the turn handed to the next seat; `seats` is left untouched. */
export function passTurn(seats: Seats): Seats {
  const next: Seats = { kinds: [...seats.kinds], turn: { ...seats.turn, seats: [...seats.turn.seats] } };
  advanceTurn(next.turn);
  return next;
}

/** A label for a seat: "Player 2", "Computer 3". */
export function seatName(kinds: readonly SeatKind[], seat: number): string {
  return `${kinds[seat] === 'computer' ? 'Computer' : 'Player'} ${seat + 1}`;
}
