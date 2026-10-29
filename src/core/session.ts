/**
 * A running game: the current state, the history for undo and the clock and
 * seed sources. Plain TypeScript; a game component keeps it in a `useRef`.
 */

import type { GameRules, GameStatus } from './rules';

import { isComputerTurn, seatToPlay } from './seats';

export interface Session<S, M, O = undefined> {
  readonly canUndo: boolean;
  /** Whether a computer seat is to play in a running game: human moves are rejected. */
  readonly computerToPlay: boolean;
  readonly seed: number;
  readonly state: S;
  readonly status: GameStatus;
  /**
   * Applies a move; returns `false` (state and history untouched) when it is illegal or a
   * computer is to play. A move that hands the turn to another seat clears the history.
   */
  apply: (move: M) => boolean;
  /** Whether `apply(move)` would succeed now; nothing changes. */
  canApply: (move: M) => boolean;
  /**
   * Starts a new game with `seed`, or a fresh random one, and clears the history. `options`
   * replace the session's options for this game and the later ones.
   */
  newGame: (seed?: number, options?: O) => void;
  /**
   * Applies the computer's move and returns it; `null` on a human's turn or once the game
   * is over. Throws when the computer picks an illegal move, which is a bug in the player.
   */
  playComputer: () => M | null;
  /** Restores the state before the last applied move; returns `false` with no history. */
  undo: () => boolean;
}

export interface SessionConfig<O, M = never, S = never> {
  options: O;
  /** Seed of the first game, instead of one from `newSeed`. */
  seed?: number;
  /** Whether `undo` is available; false for games that cannot take a move back. */
  undoable: boolean;
  /** Milliseconds, handed to the rules. Defaults to `Date.now`. */
  clock?: () => number;
  /** Picks the move for a computer seat; needed by games whose rules have `seats`. */
  computer?: (state: S) => M;
  /**
   * Whether `move` can never be taken back and hides what came before it: after it the
   * history is cleared. For a move that reveals hidden information, such as a dice roll.
   */
  isIrreversible?: (move: M) => boolean;
  /** Source of seeds for `newGame()` without an argument. Defaults to a random 32-bit integer. */
  newSeed?: () => number;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export function createSession<S, M, O>(
  rules: GameRules<S, M, O>,
  config: SessionConfig<O, M, S>,
): Session<S, M, O> {
  const clock = config.clock ?? Date.now;
  const newSeed = config.newSeed ?? randomSeed;
  let history: S[] = [];
  let options = config.options;
  let seed = config.seed ?? newSeed();
  let state = rules.setup(seed, options, clock());

  const computerToPlay = (): boolean => {
    const seats = rules.seats?.(state);
    return seats !== undefined && rules.status(state) === 'playing' && isComputerTurn(seats);
  };

  /** The seat to play, or `null` for a one-player game. */
  const seatNow = (): number | null => {
    const seats = rules.seats?.(state);
    return seats === undefined ? null : seatToPlay(seats);
  };

  function commit(move: M): boolean {
    const next = rules.apply(state, move, clock());
    if (next === null)
      return false;
    const seatBefore = seatNow();
    const previous = state;
    state = next;
    if (config.isIrreversible?.(move) === true || seatNow() !== seatBefore)
      history = [];
    else if (config.undoable)
      history.push(previous);
    return true;
  }

  return {
    apply(move) {
      return !computerToPlay() && commit(move);
    },
    canApply(move) {
      return !computerToPlay() && rules.apply(state, move, clock()) !== null;
    },
    get canUndo() {
      return history.length > 0 && !computerToPlay();
    },
    get computerToPlay() {
      return computerToPlay();
    },
    newGame(nextSeed, nextOptions) {
      seed = nextSeed ?? newSeed();
      options = nextOptions ?? options;
      state = rules.setup(seed, options, clock());
      history = [];
    },
    playComputer() {
      if (!computerToPlay())
        return null;
      if (config.computer === undefined)
        throw new Error('A computer seat is to play but the session has no computer player.');
      const move = config.computer(state);
      if (!commit(move))
        throw new Error('The computer player chose an illegal move.');
      return move;
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
      if (computerToPlay())
        return false;
      const previous = history.pop();
      if (previous === undefined)
        return false;
      state = previous;
      return true;
    },
  };
}
