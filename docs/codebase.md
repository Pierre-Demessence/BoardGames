# Codebase Map

## Directory Structure

```
BoardGames/
├── index.html                  # Entry HTML — mounts #root, loads src/main.ts
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript config (strict, ESNext, bundler)
├── vite.config.ts              # Vite dev server (port 5184)
├── vitest.config.ts            # Vitest (jsdom, v8 coverage)
├── eslint.config.ts            # ESLint flat config (antfu + perfectionist)
├── assets/                     # Kenney asset packs (static, not processed)
│   ├── kenney_boardgame-pack/  # Playing cards, backs, SFX
│   ├── kenney_board-game-info/ # UI icons
│   └── ...
├── docs/
│   ├── INDEX.md                # Documentation TOC
│   ├── tech-stack.md           # Toolchain reference
│   ├── codebase.md             # ← this file
│   ├── features.md             # Feature inventory
│   ├── agent/README.md         # Agent operational reference
│   └── plans/                  # Feature plans (active + done)
└── src/
    ├── main.ts                 # Entry point — loads assets, boots hub
    ├── hub.ts                  # Game selector menu
    ├── vite-env.d.ts           # Vite client type reference
    ├── shared/                 # Shared infrastructure (all games)
    │   ├── index.ts            # Barrel — re-exports all shared symbols
    │   ├── cards.ts            # Suit, rank, color, card-frame mapping
    │   ├── deck.ts             # Card model, makeDeck, shuffleDeck
    │   ├── atlas.ts            # Kenney spritesheet loading (TexturePacker)
    │   ├── audio.ts            # Card SFX loading & playback
    │   └── layout.ts           # Dynamic card/canvas sizing from viewport
    └── games/
        ├── blackjack/
        │   ├── index.ts        # Game entry — DOM setup, loop, input
        │   ├── game.ts         # State, deck, hand values, dealer AI
        │   └── render.ts       # Canvas2D card rendering
        ├── solitaire/
        │   ├── index.ts        # Game entry — DOM, drag-drop, auto-win
        │   ├── game.ts         # State, layout, move rules, scoring
        │   └── render.ts       # Canvas2D card + slot rendering
        └── spider/
            ├── index.ts        # Game entry — DOM, drag-drop, stock deal
            ├── game.ts         # State, layout, move rules, run detection
            └── render.ts       # Canvas2D card + stock-deck rendering
```

## Conventions

### File Organization
- Each game is a self-contained folder with `index.ts` (entry), `game.ts` (logic), `render.ts` (drawing)
- Shared code lives in `src/shared/` — no cross-game imports except `GameResources` (see [tech debt](./plans/technical-enhancements.md#4-hub-depends-on-specific-game-solitaire))
- Barrel exports via `src/shared/index.ts`

### Naming
- **Files:** kebab-case (`game-state.ts`, not `GameState.ts`)
- **Types/Interfaces:** PascalCase (`GameState`, `CardLayout`)
- **Functions:** camelCase (`handValue`, `computeLayout`)
- **Constants:** SCREAMING_SNAKE for module-level (`SUITS`, `RANKS`), camelCase for local (`cardW`)
- **Components (ECS):** PascalCase + `Def` suffix (`PositionDef`, `RenderableDef`)

### Patterns
- **Pure game logic:** `game.ts` files contain no DOM, no Canvas, no ECS — just data transforms
- **ECS rendering:** Card entities get `PositionDef`, `RenderableDef`, `RenderOrderDef` computed each frame by `syncLayout()`
- **Dispose:** Every game's `start()` returns a cleanup function that aborts listeners + cancels rAF + clears DOM
- **Audio:** Lazy — `playCardSfx()` silently no-ops if audio is null/fails; SFX is non-essential

### Adding a New Game
1. Create `src/games/<name>/` with `index.ts`, `game.ts`, `render.ts`
2. Export a `start(container, resources, onBack): () => void` function
3. Register it in `src/hub.ts` — add a `GameDef` to the `GAMES` array
4. If it needs new shared code, add to `src/shared/` and re-export from `index.ts`

### Adding a New Shared Module
1. Create `src/shared/<name>.ts`
2. Re-export public symbols from `src/shared/index.ts`
3. If it's a pure utility, prefer no ECS dependency
