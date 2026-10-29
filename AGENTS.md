# AGENTS.md

Project rules for AI coding agents working on BoardGames. They supplement the
global agent instructions.

## What this is

A browser collection of card games: Klondike Solitaire, 1-suit Spider and
Blackjack. Preact renders the menu and each game's control bar; the cards are
drawn on a canvas through the user's `@pierre/ecs` engine. Private and pre-v1.

## Commands

- `npm run dev` — Vite dev server on port 5184.
- `npm run build` — `tsc --noEmit`, then `vite build`.
- `npm run lint` / `npm run lint:fix` — ESLint (antfu flat config with
  perfectionist sorting of imports, exports, objects and interfaces).
- `npm test` / `npm run test:watch` — Vitest in jsdom. Tests sit next to their
  source as `*.test.ts`.

## Layout

- `index.html` — mounts `#root` and calls `start()` from `src/main.tsx`.
- `src/main.tsx` — `start()` mounts `AppLoader` and returns a dispose function that
  unmounts it and closes the `AudioContext`.
- `src/core/` — what any game uses, re-exported by its `index.ts` barrel (types,
  `GAMES`, `createSession`, `useCanvasGame`, `GameFrame` and the draw helpers): `app.tsx` (`AppLoader` loads the resources once,
  `App` switches between the hub and the selected game and resumes the
  `AudioContext` on the first pointer press), `registry.ts` (`GAMES`: id, name,
  description and a lazy `load()` per game), `resources.ts` (`GameResources`:
  atlases, plus audio that is `null` when it fails to load), `rules.ts` (the
  `GameRules` contract) and `session.ts` (`createSession`: current state, undo
  history, `newGame`, injectable clock and seed source), `use-canvas-game.ts` (the
  canvas hook: sizing by `ResizeObserver` at `devicePixelRatio`, pointer events in
  CSS pixels, frames only on `invalidate()` or while `animating()`),
  `game-frame.tsx` (control bar with Back, New deal and an optional Undo, plus the
  area the hook measures) and `draw.ts` (`roundRect`, `drawSlot`, `drawBanner`).
- `src/kits/cards/` — what card games use, re-exported by its `index.ts` barrel: the
  plain-JSON card model and `makeDeck`, atlas and frame names, card SFX
  (`loadCardAudio`, `playCardSfx`), table layout
  (`computeTableLayout`, `fanColumn`, `rowPositions`), layout constants,
  `createCardWorld` and `syncCardSprites`, and the drag geometry (`rectContains`,
  `dragProbe`, `floatDraggedCards`). A kit imports neither another kit nor a game.
- `src/hub.tsx` — the game selector; it lists `GAMES`.
- `src/games/<name>/` — one folder per game: `rules.ts` (the `GameRules` and
  per-game helpers), `view.ts` (geometry, hit testing, sprites, drawing) and
  `index.tsx` (the thin Preact component: session, canvas hook, `DragDrop` or
  buttons, extra controls), with `*.test.ts` beside them.
- `assets/` — Kenney asset packs (CC0), imported with `?url`.
- `docs/` — [`backlog.md`](docs/backlog.md) (all open work),
  [`decisions.md`](docs/decisions.md) (why the design is the way it is) and `plans/`
  (exists only while a plan is in progress).

## Conventions

- **Rules contract.** Every game implements `GameRules<S, M, O>` from
  `src/core/rules.ts`: `setup(seed, options, now)`, `apply(state, move, now)` and
  `status(state)`. The state is plain JSON (no entity ids, functions, class
  instances or `Date`), so rules need no DOM, canvas or ECS access and can be unit
  tested; `apply` never mutates its input and returns `null` for an
  illegal move; time and randomness enter only through `now` and `seed`, never
  `Date.now()` or `Math.random()`. Card ids are indexes in the deal; the view maps
  them to entities.
- **Cards render through ECS.** A game's view creates one entity per card
  id with `createCardWorld()` on each new game; each frame `syncCardSprites()`
  writes `PositionDef`, `RenderableDef` and `RenderOrderDef` from the state, then
  the engine's `Canvas2DRenderer` draws. Solitaire's victory animation places the
  cards itself.
- **Canvas games use `useCanvasGame`.** The hook owns sizing, the pointer
  listeners and the frame loop, and cleans up on unmount; a game draws in CSS
  pixels and calls `invalidate()` after it changes something. Mutable runtime
  (session, drag, timers) sits in a `useRef`.
- **Styles live in CSS modules** (`*.module.css`). Inline `style` is only for
  computed values such as the canvas size.
- **No cross-game or cross-kit imports.** Anything two games need moves to
  `src/core/` (any game) or the kit for their kind of game (`src/kits/cards/`).
- **Shared constants** (card layout ratios, drag and off-screen offsets) live in
  `src/kits/cards/constants.ts`; game-specific ones (dealer delay, auto-win delay)
  stay in their game.
- **SFX playback is non-essential.** `playCardSfx()` no-ops without audio and
  only warns when a clip fails.
- **Naming:** kebab-case files, PascalCase types and components, camelCase
  functions, SCREAMING_SNAKE module-level constants; ECS component definitions
  end in `Def`.
- **`erasableSyntaxOnly` is on:** no enums, namespaces or constructor parameter
  properties; use `as const` objects and explicit fields.

## Adding a game

1. Create `src/games/<name>/` with `rules.ts`, `view.ts` and `index.tsx`.
2. Export a component taking `GameProps` (`{ resources: GameResources, onBack: () => void }`)
   that renders `GameFrame` and uses `createSession` and `useCanvasGame`. `resources.audio` can be `null`: `playCardSfx()` accepts it.
3. Add a `GameDef` to `GAMES` in `src/core/registry.ts`, with a `load()` that
   dynamically imports the game's `index.tsx` and returns its component.

## Engine dependency

`@pierre/ecs` is a `file:` link to the sibling checkout
`../Entity-Cornponent-System-Engine`, not a pinned version, so engine changes
reach this project on the next typecheck.

- Its `EntityId` is branded: get ids from `world.createEntity()`; a plain
  `number` does not type-check.
- Before hand-rolling a helper, check the engine's generated API catalog,
  `../Entity-Cornponent-System-Engine/docs/agent/engine-api.md`.
- Never edit the engine from this repo; report the change it needs.

## Working rules

- The user runs the dev server and does all manual and browser testing. Don't
  start or stop the dev server or run browser automation without asking; verify
  with lint, build and tests, then hand off.
- Commit only on explicit request; never push.
