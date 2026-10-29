# Backlog

Everything not done, one line each. Delete a line in the commit that delivers it.

Next ID: B23

## Bugs

- B10 Solitaire drops a whole run onto a foundation: `resolveDrop` in `src/games/solitaire/index.tsx` checks only the first dragged card against the foundation, then pushes every dragged card.
- B11 Solitaire's time penalty never applies: the rAF loop in `SolitaireGame` compares `performance.now()` with a `lastTimeUpdateRef` set from `Date.now()` in `newDeal`; once fixed, `computeTimePenalty` returns the total since the start and would be subtracted again every 10 s.
- B12 Solitaire's clock and time penalty keep running after a win: `updateScoreDisplay` in `SolitaireGame` recomputes the elapsed time every frame with no end time.
- B13 Blackjack ignores a dealer natural: `checkNaturalBlackjack` in `src/games/blackjack/game.ts` checks only the player's hand, so a 3-card player 21 against a dealer blackjack is a push instead of a loss.
- B15 Deep columns run off the bottom of the canvas, mostly in Spider: `computeLayout` in `src/shared/layout.ts` sizes cards with its own tight fan ratios (0.05 / 0.18), while the games fan with `FAN_FACE_DOWN_RATIO` / `FAN_FACE_UP_RATIO` (0.125 / 0.3).
- B16 The canvas ignores window resizes and `devicePixelRatio`: each game measures the viewport once on mount, and the backing store equals the CSS size, so cards are blurry at 125–150 % display scaling.
- B17 Spider clears a K–A run that includes face-down cards: `removeCompletedRuns` in `src/games/spider/game.ts` checks ranks and suits but not `faceUp`.
- B18 Spider's stock gives wrong or no feedback: `drawStockDeck` in `src/games/spider/render.ts` shows "↻" on an empty stock though Spider never recycles, and a refused deal (an empty column) is silent.

## Tech debt

- B3 Unit tests for the pure game logic in `src/games/blackjack/game.ts`, `src/games/solitaire/game.ts` and `src/games/spider/game.ts`; only `src/shared/` is tested.
- B4 Enable `noUncheckedIndexedAccess` in `tsconfig.json`: the engine now compiles with it, and the flag adds no errors here.
- B19 Shared game core and card kit: rules as pure `apply(state, move)` over plain JSON state, one canvas hook for every game, and a card kit, so a new game reuses the plumbing each game copies today. Plan: `docs/plans/b19-game-core.md`.

## Features

- B6 Keyboard shortcuts: H hit and S stand in Blackjack; N new deal and Backspace back to the menu in every game.
- B7 Spider 2-suit and 4-suit variants; `dealNewGame` in `src/games/spider/game.ts` deals 1-suit only.
- B8 Blackjack betting with chips; `GameStatus` in `src/games/blackjack/game.ts` declares an unused `'betting'` state.
- B20 First dice game (Yahtzee), which creates `src/kits/dice/` (die model, roll and hold with the seeded RNG, the Kenney dice sprites in `assets/kenney_boardgame-pack`).
- B21 Animate card moves with the engine's `tween` module; cards jump to their new place today.
- B22 Resume an unfinished game after a reload with the engine's `save` module (persisted user data: ask before building).
