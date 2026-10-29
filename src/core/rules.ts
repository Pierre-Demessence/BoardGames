/**
 * The contract every game's rules implement. Rules are pure: they hold no DOM,
 * canvas or ECS access, so they can be unit tested, undone by keeping old
 * states, and later saved or synced.
 */

export type GameStatus = 'draw' | 'lost' | 'playing' | 'won';

/**
 * - `S` is the state: plain JSON (no entity ids, functions, class instances or
 *   `Date`), so `JSON.parse(JSON.stringify(state))` returns an equal value.
 * - `M` is a move.
 * - `O` is the options passed to `setup`.
 *
 * Time and randomness enter only through `now` (milliseconds) and `seed`; rules
 * never call `Date.now()` or `Math.random()`.
 */
export interface GameRules<S, M, O = void> {
  /**
   * Returns the next state, or `null` for an illegal move. Never mutates
   * `state`: it clones, then changes the copy.
   */
  apply: (state: S, move: M, now: number) => S | null;
  /** Deals a new game; the same seed and options give the same state. */
  setup: (seed: number, options: O, now: number) => S;
  status: (state: S) => GameStatus;
}
