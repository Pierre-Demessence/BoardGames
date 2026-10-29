import { describe, expect, it } from 'vitest';

import { isComputerTurn, makeSeats, passTurn, seatName, seatToPlay } from './seats';

describe('makeSeats', () => {
  it('starts with seat 0 to play and survives a JSON round trip', () => {
    const seats = makeSeats(['human', 'computer', 'human']);
    expect(seats.kinds).toEqual(['human', 'computer', 'human']);
    expect(seats.turn.seats).toEqual([0, 1, 2]);
    expect(seatToPlay(seats)).toBe(0);
    expect(JSON.parse(JSON.stringify(seats))).toEqual(seats);
  });

  it('throws with no seat', () => {
    expect(() => makeSeats([])).toThrow();
  });

  it('copies the kinds it is given', () => {
    const kinds: ('computer' | 'human')[] = ['human'];
    const seats = makeSeats(kinds);
    kinds.push('computer');
    expect(seats.kinds).toEqual(['human']);
  });
});

describe('passTurn', () => {
  it('hands the turn to the next seat without touching the original', () => {
    const seats = makeSeats(['human', 'computer']);
    const before = structuredClone(seats);
    const next = passTurn(seats);
    expect(seatToPlay(next)).toBe(1);
    expect(seats).toEqual(before);
  });

  it('wraps to seat 0 and counts a round', () => {
    const last = passTurn(makeSeats(['human', 'human']));
    const wrapped = passTurn(last);
    expect(seatToPlay(wrapped)).toBe(0);
    expect(wrapped.turn.rounds).toBe(1);
    expect(last.turn.rounds).toBe(0);
  });

  it('keeps the only seat to play in a solo game', () => {
    const solo = passTurn(makeSeats(['human']));
    expect(seatToPlay(solo)).toBe(0);
    expect(solo.turn.rounds).toBe(1);
  });
});

describe('isComputerTurn', () => {
  it('follows the kind of the seat to play', () => {
    const seats = makeSeats(['human', 'computer']);
    expect(isComputerTurn(seats)).toBe(false);
    expect(isComputerTurn(passTurn(seats))).toBe(true);
  });
});

describe('seatName', () => {
  it('numbers seats from 1 and names the kind', () => {
    const kinds = ['human', 'computer', 'human'] as const;
    expect(seatName(kinds, 0)).toBe('Player 1');
    expect(seatName(kinds, 1)).toBe('Computer 2');
    expect(seatName(kinds, 2)).toBe('Player 3');
  });
});
