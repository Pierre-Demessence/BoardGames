# Roadmap

Milestones in order. Each one adds new games and exercises engine modules no
earlier game used; polish of the existing games comes after. Opponents are local:
computer players and several people sharing one screen, mouse and keyboard.
Online play is out of scope (B31).

Next ID: M5

## M2 Board kit and Connect Four

- M2.1 Board kit and Connect Four for two people: `src/kits/board/` holds the grid
  model, the board and piece sprites from the Kenney board game pack, and cell hit
  testing.
- M2.2 Connect Four computer player with at least two difficulty levels, on the
  engine's `modules/game-search` (planned in the engine backlog with this project as
  its first consumer; tell the engine when M2.2 is planned). The search runs off the
  main thread through the engine's `worker-pool` module when it would freeze the page.

Done when a game against the computer at each level plays to a win or a draw with
no visible freeze, and the computer never misses a one-move win in rules tests.

## M3 Checkers

- M3.1 Checkers for two people on the board kit: drag a piece, forced captures,
  multi-jump moves and crowning.
- M3.2 Checkers computer player on `modules/game-search`, like Connect Four's.

Done when the board kit serves both board games with no game-specific code in it,
and a game against the computer plays to its end.

## M4 Polish

- M4.1 Card moves animate (B21).
- M4.2 Keyboard shortcuts in every game (B6).
- M4.3 An unfinished game resumes after a reload (B22).

Done when every game in the collection has all three.
