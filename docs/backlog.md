# Backlog

Everything not done, one line each. Delete a line in the commit that delivers it.

Next ID: B10

## Bugs

- B1 Build fails since the engine branded `EntityId`: `dealNewGame` in `src/games/blackjack/game.ts` and the id factories in `src/shared/deck.test.ts` pass `() => number` (11 type errors).
- B2 `AudioContext` is never closed: the `AppLoader` effect cleanup in `src/main.tsx` aborts loading but leaves `audioCtx` open.
- B9 An audio failure blocks every game: `AppLoader` in `src/main.tsx` loads the SFX together with the atlases, so a failed `AudioContext` or decode shows "Failed to load" instead of starting without sound.

## Tech debt

- B3 Unit tests for the pure game logic in `src/games/blackjack/game.ts`, `src/games/solitaire/game.ts` and `src/games/spider/game.ts`; only `src/shared/` is tested.
- B4 Enable `noUncheckedIndexedAccess` in `tsconfig.json`: the engine now compiles with it, and the flag adds no errors here beyond B1's.
- B5 Lazy-load each game with a dynamic `import()` and a loading state, so opening the menu doesn't load all three games (`App` in `src/main.tsx`).

## Features

- B6 Keyboard shortcuts: H hit and S stand in Blackjack; N new deal and Backspace back to the menu in every game.
- B7 Spider 2-suit and 4-suit variants; `dealNewGame` in `src/games/spider/game.ts` deals 1-suit only.
- B8 Blackjack betting with chips; `GameStatus` in `src/games/blackjack/game.ts` declares an unused `'betting'` state.
