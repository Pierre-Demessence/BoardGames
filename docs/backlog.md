# Backlog

Everything not done, one line each. Delete a line in the commit that delivers it.

Next ID: B37

## Bugs

- B29 Check every game in a 1280×600 browser viewport (a 1280×720 or 1366×768 screen minus browser chrome) and fix what does not fit; `computeTableLayout` in `src/kits/cards/layout.ts` sizes the cards.

## Tech debt

- B34 `useCanvasGame` in `src/core/use-canvas-game.ts` registers its own pointer listeners; read the pointer through the engine's `input` module (`PointerProvider`, `projectPointer`) instead.
- B35 `useCanvasGame` schedules its own frames with `requestAnimationFrame`; drive them with the engine's tick sources (`ManualTickSource`, `AnimationFrameTickSource`), and report to the engine what is missing if drawing only on demand does not fit.
- B36 Solitaire and Spider move card runs by hand (`slice`, `splice`, `push` in `src/games/solitaire/rules.ts` and `src/games/spider/rules.ts`); use the engine's plain pile helpers (`moveTop`, `moveAll`) once engine plan `docs/plans/plain-data-logic-modules.md` lands, and drop the `pile` sentence from the first entry of `docs/decisions.md`.

## Features

- B6 (M4.2) Keyboard shortcuts: H hit and S stand in Blackjack; N new deal and Backspace back to the menu in every game, read through the engine's `input` module (`KeyboardProvider`).
- B7 Spider 2-suit and 4-suit variants; `setup` in `src/games/spider/rules.ts` deals 1-suit only.
- B8 Blackjack betting with chips; the round in `src/games/blackjack/rules.ts` has no betting phase.
- B21 (M4.1) Animate card moves with the engine's `tween` module; cards jump to their new place today.
- B22 (M4.3) Resume an unfinished game after a reload with the engine's `save` module (persisted user data: ask before building).
- B30 Phones and touch screens: layouts for portrait and small screens, touch-sized targets. Far future.
- B31 Online multiplayer. Far future and open: a real server, one player hosting, or peer-to-peer; the architecture prepares for none of them.
- B32 Put the collection online once it is good enough (the deploy skill: K3s and Argo CD).
- B33 A card game against computer players (Crazy Eights or Hearts), on the players and computer turns from M1.2.
