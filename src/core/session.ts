/**
 * A running game: the current state, the history for undo and the clock and
 * seed sources. Plain TypeScript; a game component keeps it in a `useRef`.
 */

import type { GameRules, GameStatus } from './rules';

export interface Session<S, M> {
  readonly canUndo: boolean;
  readonly seed: number;
  readonly state: S;
  readonly status: GameStatus;
  /** Applies a move; returns `false` (state and history untouched) when it is illegal. */
  apply: (move: M) => boolean;
  /** Starts a new game with `seed`, or a fresh random one, and clears the history. */
  newGame: (seed?: number) => void;
  /** Restores the state before the last applied move; returns `false` with no history. */
  undo: () => boolean;
}

export interface SessionConfig<O> {
  options: O;
  /** Seed of the first game, instead of one from `newSeed`. */
  seed?: number;
  /** Whether `undo` is available; false for games that cannot take a move back. */
  undoable: boolean;
  /** Milliseconds, handed to the rules. Defaults to `Date.now`. */
  clock?: () => number;
  /** Source of seeds for `newGame()` without an argument. Defaults to a random 32-bit integer. */
  newSeed?: () => number;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export function createSession<S, M, O>(
  rules: GameRules<S, M, O>,
  config: SessionConfig<O>,
): Session<S, M> {
  const clock = config.clock ?? Date.now;
  const newSeed = config.newSeed ?? randomSeed;
  let history: S[] = [];
  let seed = config.seed ?? newSeed();
  let state = rules.setup(seed, config.options, clock());

  return {
    apply(move) {
      const next = rules.apply(state, move, clock());
      if (next === null)
        return false;
      if (config.undoable)
        history.push(state);
      state = next;
      return true;
    },
    get canUndo() {
      return history.length > 0;
    },
    newGame(nextSeed) {
      seed = nextSeed ?? newSeed();
      state = rules.setup(seed, config.options, clock());
      history = [];
    },
    get seed() {
      return seed;
    },
    get state() {
      return state;
    },
    get status() {
      return rules.status(state);
    },
    undo() {
      const previous = history.pop();
      if (previous === undefined)
        return false;
      state = previous;
      return true;
    },
  };
}
