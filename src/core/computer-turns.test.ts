import type { GameRules } from './rules';
import type { SeatKind } from './seats';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createComputerTurns } from './computer-turns';
import { makeSeats, passTurn } from './seats';
import { createSession } from './session';

interface State {
  moves: number;
  seats: ReturnType<typeof makeSeats>;
}

/** Every move hands the turn over; the game ends after 6 moves. */
const rules: GameRules<State, 'go', { kinds: SeatKind[] }> = {
  seats: state => state.seats,
  setup: (_seed, options) => ({ moves: 0, seats: makeSeats(options.kinds) }),
  status: state => (state.moves >= 6 ? 'won' : 'playing'),
  apply: (state, _move) =>
    state.moves >= 6 ? null : { moves: state.moves + 1, seats: passTurn(state.seats) },
};

function setup(kinds: SeatKind[], delayMs: number | (() => number) = 800) {
  const session = createSession(rules, { options: { kinds }, undoable: true, computer: (): 'go' => 'go' });
  const onMove = vi.fn();
  const turns = createComputerTurns(session, { delayMs, onMove });
  return { onMove, session, turns };
}

describe('createComputerTurns', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays one move per delay until a human is to play', () => {
    const { onMove, session, turns } = setup(['computer', 'computer', 'human']);
    turns.schedule();
    expect(session.state.moves).toBe(0);
    vi.advanceTimersByTime(799);
    expect(session.state.moves).toBe(0);
    vi.advanceTimersByTime(1);
    expect(session.state.moves).toBe(1);
    vi.advanceTimersByTime(800);
    expect(session.state.moves).toBe(2);
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMove).toHaveBeenCalledWith('go');
    vi.advanceTimersByTime(10_000);
    expect(session.state.moves).toBe(2);
    expect(session.computerToPlay).toBe(false);
  });

  it('plays on until the game ends', () => {
    const { session, turns } = setup(['computer', 'computer']);
    turns.schedule();
    vi.advanceTimersByTime(10_000);
    expect(session.state.moves).toBe(6);
    expect(session.status).toBe('won');
  });

  it('does nothing on a human turn', () => {
    const { onMove, turns } = setup(['human', 'computer']);
    turns.schedule();
    vi.advanceTimersByTime(10_000);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('cancel stops a pending move', () => {
    const { session, turns } = setup(['computer', 'computer']);
    turns.schedule();
    vi.advanceTimersByTime(400);
    turns.cancel();
    vi.advanceTimersByTime(10_000);
    expect(session.state.moves).toBe(0);
  });

  it('scheduling twice never doubles the pace', () => {
    const { session, turns } = setup(['computer', 'computer']);
    turns.schedule();
    turns.schedule();
    vi.advanceTimersByTime(800);
    expect(session.state.moves).toBe(1);
    vi.advanceTimersByTime(800);
    expect(session.state.moves).toBe(2);
  });

  it('asks a delay function once before each move and waits the time it returns', () => {
    const delays = [300, 900];
    const delayMs = vi.fn(() => delays.shift() ?? 0);
    const { session, turns } = setup(['computer', 'computer'], delayMs);
    turns.schedule();
    expect(delayMs).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(299);
    expect(session.state.moves).toBe(0);
    vi.advanceTimersByTime(1);
    expect(session.state.moves).toBe(1);
    expect(delayMs).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(899);
    expect(session.state.moves).toBe(1);
    vi.advanceTimersByTime(1);
    expect(session.state.moves).toBe(2);
  });

  it('does not ask the delay function on a human turn', () => {
    const delayMs = vi.fn(() => 100);
    const { turns } = setup(['human', 'computer'], delayMs);
    turns.schedule();
    expect(delayMs).not.toHaveBeenCalled();
  });
});
