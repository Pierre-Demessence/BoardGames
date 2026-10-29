# B19 Shared game core and card kit

Status: B19.2 committed; next open item is B19.3 (canvas hook and Solitaire).

## Goal

Every game runs on one shared base: rules that take a move and return the next state, one canvas hook for sizing, input and drawing, and a card kit. A new card or dice game then only writes its rules and its drawing, and the known Solitaire, Spider and Blackjack bugs are fixed along the way with tests.

Delivers B19 and, on the way, B2, B3, B5, B9, B10–B18.

## Acceptance criteria

1. WHEN a run of two or more cards is dropped on a foundation, Solitaire refuses the move (unit test on Solitaire `apply`). (B10)
2. WHEN 35 s pass after the deal, Solitaire's displayed score includes exactly −6 for time; WHEN the game is won, the clock and the penalty stop (unit tests with injected `now`). (B11, B12)
3. WHEN the dealer's first two cards are a blackjack, the round ends right after the deal: a push if the player also has one, a loss otherwise (unit test). (B13)
4. WHEN Blackjack is the first game opened after a page load, Hit and Stand play their sounds (manual). (B14)
5. WHEN a column holds up to 40 cards (5 face-down), `fanColumn` keeps every card's bottom edge inside the canvas, at any canvas height from 400 px (unit test). (B15)
6. WHEN the window is resized, the table re-lays out to the new size without a reload; at 150 % display scaling the cards are sharp (manual). (B16)
7. WHEN Spider's top 13 cards form K–A but one of them is face-down, the run stays (unit test). (B17)
8. WHEN Spider's stock is empty, it draws no "↻"; WHEN a deal is refused because a column is empty, the hint text says why (unit test on `apply` returning `null`, manual for the text). (B18)
9. WHEN two games are set up with the same seed, they deal the same cards; every game state survives `JSON.parse(JSON.stringify(state))` unchanged (unit test per game).
10. WHEN Undo is clicked in Solitaire or Spider, the last move is reverted, score included; Undo is disabled with no history and absent in Blackjack (unit tests on the session, manual for the button).
11. WHEN `npm run build` runs, each game is a separate JS chunk, loaded only when opened (build output). (B5)
12. WHEN the audio context or a sound fails to load, every game still starts, silent (unit test on the resource loader). (B9)
13. WHEN `start()`'s dispose function runs, the `AudioContext` is closed (unit test). (B2)
14. WHEN nothing moves (no drag, no animation, no timer text change), no frame is drawn (unit test on the hook with a fake `requestAnimationFrame`).
15. Each game plays as before apart from the changes above (manual playthrough of each); `npm run lint`, `npm test` and `npm run build` pass.

## Design

- **Folders.** `src/core/` holds what any game uses: app shell and registry, resources, rules contract, session, canvas hook, draw helpers, audio. `src/kits/cards/` holds what card games use. `src/kits/dice/` comes with the first dice game (B20). `src/shared/` stays until the last game moves off it, then is deleted. No cross-kit or cross-game imports; each folder has an `index.ts` barrel.
- **Registry.** `src/core/registry.ts` exports `GAMES: GameDef[]`, with `{ id, name, description, load: () => import('../games/<id>') }`. The hub and `App` both read it; `App` shows the loading state while `load()` resolves.
- **Rules contract** (`src/core/rules.ts`):
  - `GameRules<S, M, O>` = `{ setup(seed, options, now): S; apply(state, move, now): S | null; status(state): 'playing' | 'won' | 'lost' | 'draw' }`.
  - `apply` never mutates its input (clone, then change the copy) and returns `null` for an illegal move.
  - State is plain JSON: no entity ids, functions, class instances or `Date`. Time and randomness enter only through `now` and `seed`; rules never call `Date.now()` or `Math.random()`.
  - Per-game helpers sit next to the rules: Solitaire's `foundationTarget` (for double-click) and `nextAutoFinishMove`.
- **Session** (`src/core/session.ts`): wraps a `GameRules` and holds the current state, a history of states for undo (`undoable` flag per game; Blackjack off), `apply`, `undo`, `canUndo` and `newGame(seed?)`. It is plain TypeScript; the game component keeps it in a `useRef`.
- **Moves.**
  - Solitaire: `draw` (draw or recycle) and `move { from: PileRef, index, to: PileRef }`.
  - Spider: `deal` and `move { from, index, to }`; `apply` also clears completed runs into `state.completed`.
  - Blackjack: `hit`, `stand`, `dealerStep`. The component sends `dealerStep` every `DEALER_DELAY` while the dealer plays.
- **Solitaire scoring.** `state.score` holds move points only. The displayed score is `max(0, score + timePenalty(elapsed))`, with `elapsed = (endedAt ?? now) − startedAt`. The time bonus is added once at the win. Nothing accumulates per tick.
- **Card kit** (`src/kits/cards/`):
  - Card model: `{ id: number; suit; rank; faceUp }`, where the id is the index in the deal.
  - `makeDeck({ decks, suits }, rand)`: Spider uses 2 decks with 1 suit, and leaves room for B7.
  - Layout: `computeTableLayout(width, height, columns)` sizes cards by width and the top row only. `fanColumn(cards, top, maxBottom, cardH)` uses the shared fan ratios and compresses a column evenly when it would pass `maxBottom`. `rowPositions` lays out Blackjack hands.
  - `syncCardSprites(world, entityOf, placements)` writes `PositionDef` / `RenderableDef` / `RenderOrderDef` and removes the renderable of cards not placed.
  - Atlas and frame names move here from `src/shared/`.
- **Entities live in the view.** Each game's view creates one entity per card id on `newGame` (`entityOf[id]`); the rules never see them.
- **Canvas hook** (`src/core/use-canvas-game.ts`):
  - Sizing: a `ResizeObserver` on the area under the control bar. The canvas backing store is CSS size × `devicePixelRatio`, with the context scaled to match, so games work in CSS pixels.
  - Pointer handlers get CSS-pixel points.
  - Drawing: `invalidate()` requests one frame, and the hook keeps drawing while the game's `animating()` returns true.
  - Cleanup runs on unmount.
  - Check early: if the engine's `Canvas2DRenderer` resets the context transform, draw with an explicit scale instead and report the engine change it needs (never edit the engine).
- **Drag.** Use the engine's `DragDrop` (`@pierre/ecs/modules/drag-drop`), with `accepts` calling `rules.apply(...) !== null` and a small `threshold`, so a click or double-click is not a drag.
- **Draw helpers** (`src/core/draw.ts`): `roundRect`, `drawSlot`, `drawBanner`, plus a second cue next to color for any state (Blackjack's bust label keeps its "Bust" text).
- **Audio.**
  - The resource loader loads the atlases (required) and the audio (optional, `null` on failure).
  - `App` resumes the `AudioContext` on the first pointer press anywhere.
  - `start()`'s dispose closes it.
- **Engine `pile` module not used:** it keeps piles in the ECS world, which would break plain-JSON state (saves, undo snapshots, multiplayer sync later).
- **Out of scope:** card animation (B21), resuming after reload (B22), keyboard (B6), Spider suits (B7), betting (B8), networking.

## Checklist

- [x] B19.1 App core. Create `src/core/` with `app.tsx` (`AppLoader`, `App`), `registry.ts`, and `resources.ts` (optional audio, closes on dispose, resume on first press). `src/main.tsx` keeps only `start()`. `src/hub.tsx` reads `GAMES`. Remove the per-game `audioCtx.resume()` calls and the `BAR_HEIGHT` re-export. Tests for criteria 12 and 13; criterion 11 via build output. Update `AGENTS.md` (layout, "Adding a game"); delete B2, B5, B9 and B14 from the backlog.
  Visible after: Blackjack has sound when opened first; opening a game may flash "Loading…".
  Needs you: open Blackjack first after a reload and check the sound (at the end).
  Decided during the run: `GameDef.load()` returns the game's component (`import('../games/<id>/index.tsx').then(m => m.XGame)`), not the module, because games keep their named exports; alternative: default-export each game and return the module. Change by editing the entries in `src/core/registry.ts`.
  Decided during the run: `GameResources.audio` and `audioCtx` are `null` when the context or any clip fails (the context is then closed), so games run silent; atlas failures still show "Failed to load". Alternative: keep the context and only null `audio`. Change in `loadResources` in `src/core/resources.ts`.
  Decided during the run: the first-press resume listens to `pointerdown` and `pointerup` (capture, on `window`) and stops once the context is running, because a mouse `pointerdown` can precede the browser's user activation. Alternative: `pointerdown` only. Change in `resumeOnFirstPress`.
  Decided during the run: the loading/error styles moved from `src/shared/shell.module.css` to `src/core/app.module.css`, and `Hub` reads `GAMES` itself (it no longer takes `resources`, which it never used).
- [x] B19.2 Rules contract and card kit. Add `src/core/rules.ts`, `src/core/session.ts` and `src/kits/cards/` as designed, with unit tests (session undo and history; `makeDeck` determinism; `fanColumn` for criterion 5; `rowPositions`). The games still use `src/shared/`. Update `AGENTS.md` (layout, the "game logic is pure" convention restated as the rules contract). Create `docs/decisions.md` with two entries: plain-JSON state outside ECS instead of the engine `pile` module, and card ids separate from entity ids.
  Visible after: nothing (groundwork, no game uses it yet).
  Needs you: nothing.
  Decided during the run: the card atlas, frame names, suits/ranks and the card layout constants moved now from `src/shared/` into `src/kits/cards/` (not copied), and `src/shared/index.ts` forwards the card-kit names the games still import, until B19.5 deletes it; alternative: leave them in `shared` and duplicate them in the kit. The unused `CARD_W` and `CARD_H` were deleted with the move. Change by editing the re-export block in `src/shared/index.ts`.
  Decided during the run: `createSession(rules, { options, undoable, clock?, newSeed?, seed? })` takes the clock and seed source as injectable functions (defaults `Date.now` and a random 32-bit integer), so `session.apply(move)` and `newGame(seed?)` need no `now`; alternative: pass `now` on each call. Change in `src/core/session.ts`.
  Decided during the run: `makeDeck({ decks, suits }, rand)` reads `suits` as the number of distinct suits (1, 2 or 4) spread over each 52-card deck (order Spades, Hearts, Clubs, Diamonds), and assigns card ids after the shuffle; `syncCardSprites` takes a fourth argument `{ cardW, cardH }` for the sprite size; `computeTableLayout` also returns `tableauTop` and `tableauBottom` for `fanColumn`. Alternative: other readings of `suits`, or sizing in each placement. Change in `src/kits/cards/`.
- [ ] B19.3 Canvas hook and Solitaire. Add `src/core/use-canvas-game.ts` (criterion 14 test) and `src/core/draw.ts`. Rewrite Solitaire as `rules.ts` (with tests for criteria 1, 2 and 9, and the existing move rules), `view.ts` and a thin `index.tsx` with `DragDrop`, double-click, auto-finish, the victory animation and Undo. Delete `game.ts` and `render.ts`. Delete B10, B11 and B12 from the backlog, and Solitaire from B3's line.
  Visible after: runs can no longer go onto a foundation; the score loses 2 points per 10 s and freezes at the win; the table follows window resizes and is sharp; long columns squeeze to fit; Undo button.
  Needs you: play one Solitaire game to the end, with a resize and an Undo (at the end).
- [ ] B19.4 Spider. Same split, with tests for criteria 7, 8 and 9 and an Undo button. Delete B15 (now covered for both tableau games), B17 and B18 from the backlog, and Spider from B3's line.
  Visible after: no "↻" on the empty stock; a refused deal explains itself; deep columns fit; Undo button.
  Needs you: play Spider until at least one run completes, with an Undo and a refused deal (at the end).
- [ ] B19.5 Blackjack and cleanup. Same split, with tests for criteria 3 and 9 (no Undo). Delete `src/shared/`. Final `AGENTS.md` pass. Delete B3, B13, B16 and B19 from the backlog. Re-check every criterion as a whole.
  Visible after: a dealer blackjack ends the round at once.
  Needs you: play a few Blackjack rounds, including a dealer blackjack if one comes up (at the end).
