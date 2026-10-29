/**
 * Paces the computer seats of a session: one move per `delayMs` while a computer is to
 * play, so a person can follow what it does. The session itself stays timer-free.
 */

import type { Session } from './session';

export interface ComputerTurnsOptions<M> {
  /** Milliseconds before each computer move; a function is called once before each move. */
  delayMs: number | (() => number);
  /** Called after each applied move, for the game's sound, animation and redraw. */
  onMove: (move: M) => void;
}

export interface ComputerTurns {
  /** Stops a pending move. */
  cancel: () => void;
  /**
   * Plays computer moves until a human is to play or the game ends. Does nothing on a
   * human's turn; scheduling again restarts the delay instead of adding a second timer.
   */
  schedule: () => void;
}

export function createComputerTurns<S, M, O>(
  session: Session<S, M, O>,
  { delayMs, onMove }: ComputerTurnsOptions<M>,
): ComputerTurns {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancel(): void {
    if (timer !== null)
      clearTimeout(timer);
    timer = null;
  }

  function schedule(): void {
    cancel();
    if (!session.computerToPlay)
      return;
    timer = setTimeout(() => {
      timer = null;
      const move = session.playComputer();
      if (move === null)
        return;
      onMove(move);
      schedule();
    }, typeof delayMs === 'function' ? delayMs() : delayMs);
  }

  return { cancel, schedule };
}
