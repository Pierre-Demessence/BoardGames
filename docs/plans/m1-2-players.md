# M1.2 Players in core

Status: implemented and reviewed, uncommitted. Left: the user's AC10 play-through, then commit and delete this plan in the final commit (path in the message).

## Goal

Before a game of Yahtzee, the player picks 1 to 4 seats, each a human or the
computer; turns then pass from seat to seat on one screen, and computer seats
play by themselves at a pace a person can follow. The seat and turn machinery
lives in `src/core/` so later multi-seat games (Connect Four, Checkers, B33) reuse it.

## Acceptance criteria

- AC1 WHEN a Yahtzee game is set up with seats `[human, computer, human]`, its state holds three empty scorecards, seat 0 to play, and survives a JSON round trip. Check: `rules.test.ts`.
- AC2 WHEN a seat scores a box, the turn passes to the next seat with five fresh, unheld dice and no rolls used; after the last seat's 13th box the game is over and `leaders(state)` names the highest total (several on a tie). Check: `rules.test.ts`.
- AC3 WHEN setup gets 0 or more than 4 seats, it throws. Check: `rules.test.ts`.
- AC4 WHEN a move hands the turn to another seat, `canUndo` becomes false; with one seat, scoring stays undoable as today. Check: `session.test.ts` and `rules.test.ts` ("undo through a session").
- AC5 WHILE a computer seat is to play, `session.apply` rejects every move and `canUndo` is false; `session.playComputer()` applies the computer's move and returns it, and returns `null` on a human's turn or once the game is over. Check: `session.test.ts`.
- AC6 WHEN `createComputerTurns` is scheduled on a computer's turn, it applies one move per `delayMs` until a human is to play or the game ends; `cancel()` stops it, and scheduling twice never doubles the pace. Check: `computer-turns.test.ts` with Vitest fake timers.
- AC7 WHEN two computer seats play a whole Yahtzee game from a fixed seed through `playComputer()` alone, it reaches the end with every box filled. Check: `computer.test.ts`.
- AC8 WHEN the seat picker is shown, it lists the seats with a Human/Computer choice each, adds seats up to the maximum and removes them down to the minimum, and Start reports the chosen kinds. Check: `seat-picker.test.tsx`.
- AC9 WHEN the scorecard has several seats, it shows one column per seat, marks the seat to play with an arrow and bold header (not color alone), and offers score buttons only in that seat's column on a human's turn. Check: `scorecard.test.tsx`.
- AC10 WHEN two humans and one computer play Yahtzee in a 1280×600 viewport, the game plays to its end with the scorecard, dice and bar visible without scrolling. Check: manual (user).
- AC11 `npm run lint`, `npm run build` and `npm test` pass with no new warnings.

## Design

- **Seats in core** (`src/core/seats.ts`): `SeatKind = 'computer' | 'human'`; `Seats { kinds: SeatKind[]; turn: TurnOrder<number> }`, where the order's seats are seat indexes `0..n-1`. Helpers: `makeSeats(kinds)`, `seatToPlay(seats)`, `isComputerTurn(seats)`, `passTurn(seats)` (copies, then `advanceTurn`; rules never mutate) and `seatName(kinds, seat)` ("Player 2", "Computer 3"). Seats sit in the game state, not the session, so a saved game (M4.3) knows who plays.
- **Rules contract**: `GameRules` gains an optional `seats?: (state: S) => Seats`, absent for one-player games. Solitaire, Spider and Blackjack are untouched.
- **Session** (`src/core/session.ts`): `SessionConfig` gains `computer?: (state: S) => M`. Reading `rules.seats`, the session clears the history when a move changes the seat to play (Undo never reaches into another seat's turn), rejects `apply` while a computer is to play, and adds `computerToPlay: boolean` and `playComputer(): M | null`; an illegal computer move throws, since it is a bug in the computer player. `newGame(seed?, options?)` takes new options, which the picker needs. The session stays synchronous and timer-free.
- **Pacing** (`src/core/computer-turns.ts`): `createComputerTurns(session, { delayMs, onMove })` returns `{ schedule, cancel }`: Blackjack's `scheduleDealer` generalized. The component calls `schedule()` after every move and new game, `cancel()` on new game and unmount; `onMove(move)` lets the game play its sound and tumble. Blackjack keeps its own dealer timer: the dealer is the house, not a seat.
- **Seat picker** (`src/core/seat-picker.tsx` + CSS module): a form with one row per seat (Human/Computer toggle buttons with `aria-pressed` and a filled style, a Remove button), Add seat, Start, and Cancel when a game is running. `GameFrame` gains an optional `overlay` shown centered over the body, so the canvas stays mounted. It opens when the game is entered and on New game, prefilled with the last seats (kept in memory only, nothing saved); the first default is one human, today's solo game.
- **Yahtzee state**: `{ dice, rngState, rollsUsed, seats, sheets: ScoreSheet[] }` with `ScoreSheet { boxes, yahtzeeBonuses }`, one per seat; dice are shared. Options become `{ seats: SeatKind[] }`. `scoreFor` and `canScore` read the sheet of the seat to play; `totals` takes a sheet; the game ends when `turn.rounds` reaches 13. `status` stays `'won'` for "finished" (`GameStatus` has no "over" value; it reads as finished in a multi-seat game), and `leaders(state)` gives the winners.
- **Yahtzee computer** (`src/games/yahtzee/computer.ts`): a stand-in until M1.3: roll once, then score the open legal box worth the most (first in scorecard order on a tie). Deterministic from the state.
- **Yahtzee UI**: one scorecard column per seat; the side panel widens to fit four. The bar shows "Player 2 · Turn 5 / 13", "Computer 3 is playing · Turn 5 / 13", or at the end "Player 1 wins with 245" / "Tie: …" (solo: "Game over · 245"). Roll and Undo are disabled on a computer's turn. Computer actions every `COMPUTER_DELAY = 800` ms, longer than the 500 ms tumble.
- **Engine**: nothing is expected to be missing from `TurnOrder`. Any gap found (simultaneous turns, phases, friction with pure rules) goes in the final report as a change for the engine; the engine is not edited from here.

## Checklist

### M1.2 Players in core

- [x] Seats: `src/core/seats.ts` with `seats.test.ts`; `seats?` on `GameRules`; export from `src/core/index.ts`. Verify: tests for `passTurn` not mutating, wrap to seat 0, `seatName`.
- [x] Session: `computer`, `computerToPlay`, `playComputer`, history cleared on seat change, `newGame(seed?, options?)`; tests for AC4 and AC5 with a small two-seat test game in `session.test.ts`.
- [x] Pacing: `src/core/computer-turns.ts` with `computer-turns.test.ts` (AC6).
- [x] Yahtzee rules: sheets, seats, options, `leaders`, end by rounds; update `rules.test.ts`, `view.test.ts` and `scorecard.test.tsx` fixtures for the new state; tests for AC1 to AC4.
- [x] Yahtzee computer: `computer.ts` with `computer.test.ts` (AC7).
- [x] Seat picker and `GameFrame` overlay: `seat-picker.tsx`, its CSS module and `seat-picker.test.tsx` (AC8).
- [x] Yahtzee UI: multi-column `scorecard.tsx` (AC9), `index.tsx` wiring (picker, pacing, bar text, disabled buttons), `registry.ts` description ("1 to 4 players, humans or computer").
- [x] Docs: `AGENTS.md` layout (seats, computer turns, seat picker, Yahtzee `computer.ts`), the decisions below into `docs/decisions.md`, delete M1.2 from `docs/roadmap.md`, delete this plan (kept until the AC10 manual test, since the plan was never committed).
- [x] Verify AC11; review the whole diff against these criteria.

Decisions for `docs/decisions.md` on finishing: "Undo stays within one seat's turn" and "Seats live in the game state".

Visible after: entering Yahtzee shows a seat picker; with several seats the scorecard has a column per seat, turns rotate, and computer seats roll and score by themselves (simply, until M1.3).
Needs you: play a game with two humans and a computer in a 1280×600 window (AC10) (at the end).
