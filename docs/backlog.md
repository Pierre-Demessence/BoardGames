# Backlog

Everything not done, one line each. Delete a line in the commit that delivers it.

Next ID: B29

## Bugs

- B23 Cards stay blurry after the window moves to a monitor with a different display scaling until it is resized; `useCanvasGame` in `src/core/use-canvas-game.ts` reads `devicePixelRatio` only on resize.
- B24 In a short window Blackjack's result banner can cover the bottom of the dealer's cards; `drawBanner` placement in `blackjackLayout` / `drawTable` in `src/games/blackjack/view.ts`.

## Tech debt

- B25 Solitaire's drag `accepts` check calls `solitaireRules.apply` with `Date.now()` instead of the session clock; `src/games/solitaire/index.tsx`.
- B26 A canvas collapsed to about 20 px or less can produce invalid card positions; `computeTableLayout` and `fanColumn` in `src/kits/cards/layout.ts`.
- B27 The "← Games" button on the "Failed to load" screen has no styling; `GameScreen` in `src/core/app.tsx`.
- B28 Solitaire imports `core/game-frame.module.css` directly instead of going through `src/core/index.ts`; `src/games/solitaire/index.tsx`.
- B4 Enable `noUncheckedIndexedAccess` in `tsconfig.json`: the engine now compiles with it, and the flag adds no errors here.

## Features

- B6 Keyboard shortcuts: H hit and S stand in Blackjack; N new deal and Backspace back to the menu in every game.
- B7 Spider 2-suit and 4-suit variants; `setup` in `src/games/spider/rules.ts` deals 1-suit only.
- B8 Blackjack betting with chips; the round in `src/games/blackjack/rules.ts` has no betting phase.
- B20 First dice game (Yahtzee), which creates `src/kits/dice/` (die model, roll and hold with the seeded RNG, the Kenney dice sprites in `assets/kenney_boardgame-pack`).
- B21 Animate card moves with the engine's `tween` module; cards jump to their new place today.
- B22 Resume an unfinished game after a reload with the engine's `save` module (persisted user data: ask before building).
