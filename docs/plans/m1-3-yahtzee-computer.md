# M1.3 Yahtzee computer player

## Goal

A computer seat in Yahtzee plays like a strong player: after each roll it holds the
dice that give it the best chances, rolls again or stops, and scores the box that is
worth the most for the rest of its game. A person watching can follow each hold.

## Acceptance criteria

- AC1 WHEN a computer seat plays 50 solo games from seeds 1 to 50, its mean grand total is at least 225 (the stand-in scores about 112; a scratch prototype of this design scored 236 on these seeds and 243 over 200 seeds). Check: `computer.test.ts`.
- AC2 WHEN the dice after a roll differ from the dice the computer wants to keep, `computerMove` returns one `toggleHold`, on the leftmost die whose hold differs; once the holds match, it returns `roll`. Check: `computer.test.ts`.
- AC3 WHEN the best choice is to keep all five dice, or no roll is left, `computerMove` returns `score` with its chosen box instead of rolling. Check: `computer.test.ts` (a large straight on the first roll with Large straight open is scored at once).
- AC4 WHEN given fixed dice and sheets, the computer makes these choices: scores a rolled Yahtzee in the Yahtzee box when it is open; holds the three sixes of `[6, 6, 6, 2, 1]` on the first roll with Sixes open; holds a four-long run when both straights are open and nothing better is showing. Check: `computer.test.ts`.
- AC5 WHEN two states differ only in `rngState`, `computerMove` returns the same move: the computer never looks at the dice it is about to roll. Check: `computer.test.ts`, over the states of a seeded game.
- AC6 WHEN two computer seats play a whole game from a fixed seed through `session.playComputer()`, every move is legal and every box is filled (the existing test, unchanged apart from the move count it expects). Check: `computer.test.ts`.
- AC7 WHEN `createComputerTurns` gets `delayMs` as a function, it calls it once before each computer move and waits the returned time; a number keeps today's fixed delay. Check: `computer-turns.test.ts` with fake timers.
- AC8 WHEN `computerDelay(next, elapsedMs)` is asked for the pause before a computer move, it gives 500 ms before a hold (`COMPUTER_HOLD_DELAY`), 800 ms before a roll (`COMPUTER_DELAY`), and before a score the larger of 800 ms and what is left of `COMPUTER_MIN_TURN = 2500` ms since the turn began, so a turn scored on its first roll still lasts 2.5 s. Check: `computer.test.ts`.
- AC9 WHEN two people and a computer play Yahtzee in a 1280×600 viewport, the game plays to its end; each hold is seen die by die, no computer turn ends in under 2.5 s, and a full turn feels neither rushed nor slow (about 5 s). Check: manual (user).
- AC10 `npm run lint`, `npm run build` and `npm test` pass with no new warnings, and `computer.test.ts` runs in under 5 s.

## Design

- **One-turn planning** (`src/games/yahtzee/computer.ts`). At its turn the computer builds a table for its own sheet: for each of the 252 distinct sets of five dice, the value of scoring it now (`V0`); then, for 1 and 2 rolls left, the expected value of each of the 462 possible kept sub-sets, averaging the values of every reroll outcome weighted by its probability. A roll's value with `n` rolls left is the best of its kept sub-sets. The work is about 30 000 additions per turn; built once per turn and reused for its holds and rolls.
- **Box value** (`V0`). Gain in grand total from scoring the box, computed by `yahtzeeRules.apply` on a hypothetical state, so the joker rule, the 100-point Yahtzee bonus and the 35-point upper bonus come from the rules, not a copy; minus `OPEN_BOX_VALUE[box]`, the box's average worth if left open (constants from published optimal-play averages, ones 1.9 to large straight 32.7); plus, for an upper box while the bonus is not reached, `UPPER_PAR_WEIGHT × (score − 3 × face)` to reward staying on pace for 63. The constants are tuned on the AC1 benchmark (prototype: weight 1 on open values, 0.6 on par).
- **Inputs.** The computer reads `dice` (values and holds), `rollsUsed`, `seats` and the seat's sheet, never `rngState` or the other sheets: it plays for its own best total and ignores the opponents' scores. Dice sets are indexed by integer, not string keys, to meet the AC10 time.
- **Cache.** A single-entry module-level cache keyed by the seat's sheet (its boxes and Yahtzee bonuses). `computerMove` stays a pure function of the state from the caller's view.
- **Ties.** Kept sub-sets are compared in a fixed order with a small epsilon, and the dice to hold for a kept set are the leftmost matching ones, so moves are deterministic. Box ties take the first in scorecard order, as today.
- **Pacing** (`src/core/computer-turns.ts`). `delayMs: number | (() => number)`, called in `schedule()` after the `computerToPlay` check. Yahtzee's function peeks at the next move with `computerMove(session.state)` (pure and cached, so the later `playComputer()` gets the same move) and returns `computerDelay(next, performance.now() − turnStartedAt)`; the component sets `turnStartedAt` when the delay is asked with `rollsUsed === 0`. `computerDelay` is a pure export of `computer.ts`. Holds stay one `toggleHold` move per die. The prototype averaged 2.9 rolls and 3.2 holds per turn, so a typical turn takes about 5 s.
- **Not built.** The fully optimal strategy (a table over every reachable scorecard, about 500 000 states) scores about 255 on average, only some 15 more, for seconds of precomputation or a multi-megabyte table. One strength level only, no difficulty choice.
- **Engine.** No `@pierre/ecs` module is used beyond the dice kit's `rng`. `modules/game-search` (alpha-beta, MCTS) does not fit: it has no chance step and plays against a fixed future stored in the state, which here means reading `rngState` and knowing the rolls; its results are win/draw/loss, while a Yahtzee seat maximizes points; and the exact average over all 252 outcomes is cheaper and better than sampled playouts. Nothing is missing from the engine for this item.

## Checklist

### M1.3 Yahtzee computer player

- [x] Pacing: `delayMs` as a number or a function in `src/core/computer-turns.ts`; tests for AC7 in `computer-turns.test.ts`.
- [x] Computer: replace the stand-in in `src/games/yahtzee/computer.ts` with the one-turn planner, keeping `computerMove(state)`; rewrite `computer.test.ts` for AC1 to AC6 (the stand-in's tests that pin its greedy choices go).
- [x] Tune `OPEN_BOX_VALUE` and `UPPER_PAR_WEIGHT` on seeds 1 to 50; set the AC1 threshold at least 5 points below the measured mean and note the mean in the test name or a comment.
- [x] Pacing in Yahtzee: `computerDelay` and its constants in `computer.ts` with tests (AC8); `turnStartedAt` and the delay function in `src/games/yahtzee/index.tsx`.
- [x] Docs: `AGENTS.md` layout line for `computer.ts` ("plans one turn: which dice to hold, which box to score; `computerDelay` paces it"); add "The Yahtzee computer plans one turn at a time" to `docs/decisions.md` (why not the optimal table or `game-search`, why it ignores opponents and never reads `rngState`); on finishing, delete M1 from `docs/roadmap.md` (M1.3 is its last slice), this plan and `docs/plans/m1-2-players.md` (its play-through is done).
- [x] Verify AC10; review the whole diff against these criteria.

Status: M1.3 is implemented and committed; only the manual check AC9 is left. Delete this plan when the user says "finish".

Visible after: computer seats hold dice one by one (half a second apart) between rolls, usually use all three rolls, take at least 2.5 s per turn, and score about twice what they did (around 235 on average instead of 112).
Needs you: play a game with two humans and a computer in a 1280×600 window, watching the computer's pace (AC9) (at the end).
