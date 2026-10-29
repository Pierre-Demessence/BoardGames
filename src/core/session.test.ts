import type { GameRules } from './rules';
import type { SeatKind, Seats } from './seats';

import { describe, expect, it } from 'vitest';

import { makeSeats, passTurn } from './seats';
import { createSession } from './session';

interface CounterState {
  seed: number;
  startedAt: number;
  total: number;
}

/** Add a number to the total; the total may not pass 10, and 10 wins. */
const counter: GameRules<CounterState, number, { start: number }> = {
  setup: (seed, options, now) => ({ seed, startedAt: now, total: options.start }),
  status: state => (state.total === 10 ? 'won' : 'playing'),
  apply(state, move, now) {
    const total = state.total + move;
    if (total > 10)
      return null;
    return { ...state, startedAt: now, total };
  },
};

function makeSession(undoable = true) {
  let time = 100;
  const seeds = [7, 8, 9];
  const session = createSession(counter, {
    options: { start: 1 },
    undoable,
    clock: () => time,
    newSeed: () => seeds.shift()!,
  });
  return {
    session,
    setTime: (t: number) => {
      time = t;
    },
  };
}

describe('createSession', () => {
  it('sets up the first game with a seed, the options and the clock', () => {
    const { session } = makeSession();
    expect(session.state).toEqual({ seed: 7, startedAt: 100, total: 1 });
    expect(session.seed).toBe(7);
    expect(session.status).toBe('playing');
    expect(session.canUndo).toBe(false);
  });

  it('uses the given seed for the first game', () => {
    const session = createSession(counter, { options: { start: 0 }, seed: 42, undoable: true });
    expect(session.seed).toBe(42);
    expect(session.state.seed).toBe(42);
  });

  it('tells whether a move is legal without changing the state or the history', () => {
    const { session } = makeSession();
    expect(session.canApply(4)).toBe(true);
    expect(session.canApply(20)).toBe(false);
    expect(session.state.total).toBe(1);
    expect(session.canUndo).toBe(false);
  });

  it('applies a move with the current time', () => {
    const { session, setTime } = makeSession();
    setTime(500);
    expect(session.apply(4)).toBe(true);
    expect(session.state).toEqual({ seed: 7, startedAt: 500, total: 5 });
    expect(session.canUndo).toBe(true);
  });

  it('keeps state and history when a move is illegal', () => {
    const { session } = makeSession();
    const before = session.state;
    expect(session.apply(50)).toBe(false);
    expect(session.state).toBe(before);
    expect(session.canUndo).toBe(false);
  });

  it('reports the status of the current state', () => {
    const { session } = makeSession();
    session.apply(9);
    expect(session.status).toBe('won');
  });

  it('undoes moves one by one, back to the start', () => {
    const { session } = makeSession();
    session.apply(2);
    session.apply(3);
    expect(session.undo()).toBe(true);
    expect(session.state.total).toBe(3);
    expect(session.undo()).toBe(true);
    expect(session.state.total).toBe(1);
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);
    expect(session.state.total).toBe(1);
  });

  it('keeps no history when the game is not undoable', () => {
    const { session } = makeSession(false);
    session.apply(2);
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);
    expect(session.state.total).toBe(3);
  });

  it('clears the history after an irreversible move, and undo works again for later moves', () => {
    const session = createSession(counter, {
      options: { start: 0 },
      undoable: true,
      isIrreversible: move => move === 5,
    });
    session.apply(1);
    session.apply(5);
    expect(session.state.total).toBe(6);
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);

    session.apply(2);
    expect(session.canUndo).toBe(true);
    expect(session.undo()).toBe(true);
    expect(session.state.total).toBe(6);
    expect(session.canUndo).toBe(false);
  });

  it('keeps the history when an irreversible move is illegal', () => {
    const session = createSession(counter, {
      options: { start: 0 },
      undoable: true,
      isIrreversible: move => move === 50,
    });
    session.apply(1);
    expect(session.apply(50)).toBe(false);
    expect(session.canUndo).toBe(true);
  });

  it('newGame() takes the next seed and clears the history', () => {
    const { session, setTime } = makeSession();
    session.apply(2);
    setTime(900);
    session.newGame();
    expect(session.state).toEqual({ seed: 8, startedAt: 900, total: 1 });
    expect(session.seed).toBe(8);
    expect(session.canUndo).toBe(false);
  });

  it('newGame(seed) deals that seed', () => {
    const { session } = makeSession();
    session.newGame(1234);
    expect(session.seed).toBe(1234);
    expect(session.state.seed).toBe(1234);
  });
});

interface RelayState {
  log: string[];
  seats: Seats;
}

type RelayMove = 'bad' | 'pass' | 'step';

/** Two seats: `step` adds to the log and keeps the turn, `pass` hands the turn over; the game ends at 4 entries; `bad` is always illegal. */
const relay: GameRules<RelayState, RelayMove, { kinds: SeatKind[] }> = {
  seats: state => state.seats,
  setup: (_seed, options) => ({ log: [], seats: makeSeats(options.kinds) }),
  status: state => (state.log.length >= 4 ? 'won' : 'playing'),
  apply(state, move) {
    if (state.log.length >= 4 || move === 'bad')
      return null;
    return {
      log: [...state.log, move],
      seats: move === 'pass' ? passTurn(state.seats) : state.seats,
    };
  },
};

function makeRelay(kinds: SeatKind[], computer?: (state: RelayState) => RelayMove) {
  return createSession(relay, { computer, options: { kinds }, undoable: true });
}

describe('createSession with seats', () => {
  it('keeps undo within one seat turn: a move that hands the turn over clears the history', () => {
    const session = makeRelay(['human', 'human']);
    session.apply('step');
    expect(session.canUndo).toBe(true);
    session.apply('pass');
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);
    session.apply('step');
    expect(session.canUndo).toBe(true);
  });

  it('keeps undo after a move that leaves the turn with a single seat', () => {
    const session = makeRelay(['human']);
    session.apply('pass');
    expect(session.canUndo).toBe(true);
    expect(session.undo()).toBe(true);
  });

  it('rejects human moves and undo while a computer is to play', () => {
    const session = makeRelay(['human', 'computer'], () => 'step');
    session.apply('step');
    session.apply('pass');
    expect(session.computerToPlay).toBe(true);
    expect(session.canApply('step')).toBe(false);
    expect(session.apply('step')).toBe(false);
    expect(session.state.log).toEqual(['step', 'pass']);
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);
  });

  it('plays the computer move and returns it', () => {
    const session = makeRelay(['computer', 'human'], () => 'pass');
    expect(session.computerToPlay).toBe(true);
    expect(session.playComputer()).toBe('pass');
    expect(session.state.log).toEqual(['pass']);
    expect(session.computerToPlay).toBe(false);
  });

  it('returns null from playComputer on a human turn', () => {
    const session = makeRelay(['human', 'computer'], () => 'pass');
    expect(session.playComputer()).toBeNull();
    expect(session.state.log).toEqual([]);
  });

  it('returns null from playComputer once the game is over, even if the next seat is a computer', () => {
    const session = makeRelay(['human', 'computer'], () => 'pass');
    session.apply('step');
    session.apply('step');
    session.apply('step');
    session.apply('pass');
    expect(session.status).toBe('won');
    expect(session.computerToPlay).toBe(false);
    expect(session.playComputer()).toBeNull();
  });

  it('throws when the computer picks an illegal move', () => {
    const session = makeRelay(['computer'], () => 'bad');
    expect(() => session.playComputer()).toThrow();
    expect(session.state.log).toEqual([]);
  });

  it('newGame takes new options for this game and the later ones', () => {
    const session = makeRelay(['human']);
    session.newGame(undefined, { kinds: ['human', 'computer', 'computer'] });
    expect(session.state.seats.kinds).toEqual(['human', 'computer', 'computer']);
    session.newGame();
    expect(session.state.seats.kinds).toEqual(['human', 'computer', 'computer']);
  });
});
