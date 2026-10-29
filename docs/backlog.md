# Backlog

Everything not done, one line each. Delete a line in the commit that delivers it.

Next ID: B23

## Bugs

- B13 Blackjack ignores a dealer natural: `checkNaturalBlackjack` in `src/games/blackjack/game.ts` checks only the player's hand, so a 3-card player 21 against a dealer blackjack is a push instead of a loss.
- B16 The canvas ignores window resizes and `devicePixelRatio`: each game measures the viewport once on mount, and the backing store equals the CSS size, so cards are blurry at 125–150 % display scaling.

## Tech debt

- B3 Unit tests for the pure game logic in `src/games/blackjack/game.ts`.
- B4 Enable `noUncheckedIndexedAccess` in `tsconfig.json`: the engine now compiles with it, and the flag adds no errors here.
- B19 Shared game core and card kit: rules as pure `apply(state, move)` over plain JSON state, one canvas hook for every game, and a card kit, so a new game reuses the plumbing each game copies today. Plan: `docs/plans/b19-game-core.md`.

## Features

- B6 Keyboard shortcuts: H hit and S stand in Blackjack; N new deal and Backspace back to the menu in every game.
- B7 Spider 2-suit and 4-suit variants; `dealNewGame` in `src/games/spider/game.ts` deals 1-suit only.
- B8 Blackjack betting with chips; `GameStatus` in `src/games/blackjack/game.ts` declares an unused `'betting'` state.
- B20 First dice game (Yahtzee), which creates `src/kits/dice/` (die model, roll and hold with the seeded RNG, the Kenney dice sprites in `assets/kenney_boardgame-pack`).
- B21 Animate card moves with the engine's `tween` module; cards jump to their new place today.
- B22 Resume an unfinished game after a reload with the engine's `save` module (persisted user data: ask before building).
