import type { GameRules } from './rules';

import { describe, expect, it } from 'vitest';

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
