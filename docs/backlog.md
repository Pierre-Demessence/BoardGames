# Backlog

Everything not done, one line each. Delete a line in the commit that delivers it.

Next ID: B23

## Bugs

## Tech debt

- B4 Enable `noUncheckedIndexedAccess` in `tsconfig.json`: the engine now compiles with it, and the flag adds no errors here.

## Features

- B6 Keyboard shortcuts: H hit and S stand in Blackjack; N new deal and Backspace back to the menu in every game.
- B7 Spider 2-suit and 4-suit variants; `setup` in `src/games/spider/rules.ts` deals 1-suit only.
- B8 Blackjack betting with chips; the round in `src/games/blackjack/rules.ts` has no betting phase.
- B20 First dice game (Yahtzee), which creates `src/kits/dice/` (die model, roll and hold with the seeded RNG, the Kenney dice sprites in `assets/kenney_boardgame-pack`).
- B21 Animate card moves with the engine's `tween` module; cards jump to their new place today.
- B22 Resume an unfinished game after a reload with the engine's `save` module (persisted user data: ask before building).
