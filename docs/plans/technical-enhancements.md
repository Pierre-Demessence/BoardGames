# Technical Enhancement Opportunities — BoardGames

> Audit date: 2026-07-01 | Scope: technical debt, tooling, architecture, quality — no new features, no new games.

---

## 🔴 Critical Gaps

### 1. Zero Tests

**Status:** Vitest configured (`vitest.config.ts`, `jsdom` environment, v8 coverage) but **zero `.test.ts` files exist**.

Testable pure functions (no DOM, no canvas — data in, data out):

| Module | Functions |
|--------|-----------|
| `src/shared/cards.ts` | `suitColor`, `cardFrame`, rank-label mapping |
| `src/shared/deck.ts` | `makeDeck`, `shuffleDeck` |
| `src/shared/layout.ts` | `computeLayout` (viewport → card sizing) |
| `src/games/blackjack/game.ts` | `handValue`, `isBust`, `isBlackjack`, `checkNaturalBlackjack`, `hit`, `stand`, `dealerHit`, round resolution |
| `src/games/solitaire/game.ts` | `canDropOnFoundation`, `canDropOnTableau`, `canDragRun`, `canDropOnColumn`, `findFoundationFor`, `isWon`, `awardPoints`, `movePoints`, `computeTimePenalty`, `computeTimeBonus`, `finalScore`, `initLayout`, `dealNewGame` |
| `src/games/spider/game.ts` | `canDragRun`, `canDropOnColumn`, `removeCompletedRuns`, `dealFromStock`, `isWon`, `dealNewGame` |

**Tasks:**

- [x] Write unit tests for `src/shared/cards.ts` (5 tests)
- [x] Write unit tests for `src/shared/deck.ts` (10 tests)
- [x] Write unit tests for `src/shared/layout.ts` (12 tests)
- [ ] Write unit tests for `src/games/blackjack/game.ts`
- [ ] Write unit tests for `src/games/solitaire/game.ts`
- [ ] Write unit tests for `src/games/spider/game.ts`

---

### 2. Missing Mandatory Documentation

Per the project workflow rules (`pierre-workflow.instructions.md`), these are required:

| Required Doc | Exists? |
|-------------|---------|
| `README.md` | ❌ |
| `/docs/INDEX.md` | ❌ |
| `/docs/tech-stack.md` | ❌ |
| `/docs/codebase.md` | ❌ |
| `/docs/features.md` | ❌ |
| `/docs/agent/README.md` | ❌ |

**Tasks:**

- [x] Create `README.md` — one-page: description, badges, one-line install + run, link to `/docs/INDEX.md`
- [x] Create `/docs/INDEX.md` — table of contents for all docs
- [x] Create `/docs/tech-stack.md` — TypeScript 5.9, Vite 8, @pierre/ecs, Vitest 4, ESLint (antfu), jsdom, Kenney assets
- [x] Create `/docs/codebase.md` — directory map, naming conventions, where to add new games/modules
- [x] Create `/docs/features.md` — 3 games listed with descriptions, shared infrastructure
- [x] Create `/docs/agent/README.md` — concise agent ops: scripts, paths, invariants, `last-updated` frontmatter

---

## 🟡 Architecture & Code Quality

### 3. Significant Boilerplate Duplication

Each game's `index.ts` (~80–120 lines) repeats the same pattern almost verbatim:

- Canvas + 2D context creation with identical CSS
- Control bar (`div`) creation with identical CSS
- `← Games` back button (identical styling)
- `New deal` button (identical styling)
- `makeWorld()` — copy-pasted 3× with identical `registerComponent` calls
- `disposed` flag + `AbortController` + `cancelAnimationFrame` cleanup
- `container.innerHTML = ''` on dispose

The `render.ts` files also duplicate:

- `roundRect()` helper (solitaire & spider — blackjack doesn't need it)
- `drawSlot()` (solitaire & spider)
- `drawBanner()` (all 3 — solitaire/spider identical, blackjack similar)
- `DRAG_ORDER_BUMP = 100_000` constant (solitaire & spider)

**Recommendation:** Extract a `GameShell` in `src/shared/`:

```ts
// Concept sketch
interface GameShellConfig {
  container: HTMLElement;
  layout: CardLayout;
  controls?: GameControl[];
  render: (ctx2d: CanvasRenderingContext2D) => void;
  update?: (dt: number) => void;
  onBack: () => void;
}

function createGameShell(config: GameShellConfig): () => void;
```

**Tasks:**

- [x] Create `src/shared/shell.ts` — `createGameShell()` factory + `makeWorld()`
- [x] Migrate blackjack `index.ts` to use GameShell
- [x] Migrate solitaire `index.ts` to use GameShell
- [x] Migrate spider `index.ts` to use GameShell
- [x] Remove duplicated `makeWorld()`, canvas setup, bar creation, rAF loop, dispose

---

### 4. Hub Depends on Specific Game (Solitaire)

`src/hub.ts` imports `GameResources` from `../games/solitaire/index`. Spider also imports from `../solitaire`. This means:

- The hub and spider both import the Solitaire game module
- `GameResources` is a shared concept but lives in a game-specific file

**Recommendation:** Move `GameResources` to `src/shared/index.ts` (or a new `src/shared/resources.ts`) and re-export from solitaire for backward compat, then update hub + spider to import from `../../shared`.

**Tasks:**

- [x] Define `GameResources` in `src/shared/index.ts`
- [x] Update `src/hub.ts` import (solitaire → shared)
- [x] Update `src/games/spider/index.ts` import (solitaire → shared)
- [x] Update `src/games/blackjack/index.ts` import (solitaire → shared)

---

### 5. Magic Numbers & Inconsistent Constants

Constants duplicated or hardcoded across files:

| Constant | Value | Defined In |
|----------|-------|-----------|
| `BAR_HEIGHT` | `44` | blackjack/index, solitaire/index, spider/index |
| `FAN_FACE_UP_RATIO` | `0.3` | solitaire/game, spider/game |
| `FAN_FACE_DOWN_RATIO` | `0.125` | solitaire/game, spider/game |
| `TABLEAU_Y_GAP` | `0.3` | solitaire/game, spider/game |
| `DRAG_FAN_RATIO` | `0.3` | solitaire/render, spider/render |
| `DRAG_ORDER_BUMP` | `100_000` | solitaire/render, spider/render |
| `CARD_OVERLAP` | `0.35` | blackjack/render |
| Off-screen deck offset | `-200` | blackjack/render, spider/render |
| SFX volume | `0.6` | shared/audio |
| `DEALER_DELAY` | `600` | blackjack/index |
| `AUTO_WIN_DELAY` | `50` | solitaire/index |

**Recommendation:** Consolidate into `src/shared/constants.ts` (or extend `src/shared/layout.ts` / `src/shared/cards.ts`):

- Layout constants: fan ratios, gap ratios, overlap
- Rendering constants: drag order bump, off-screen offset
- Audio constants: volume levels
- UI constants: bar height, dealer delay

**Tasks:**

- [x] Create `src/shared/constants.ts` with all shared magic numbers
- [x] Update all game files to import from shared constants
- [x] Remove local duplicate definitions

---

### 6. `noUncheckedIndexedAccess` Is Off

`tsconfig.json` has `strict: true` but omits `noUncheckedIndexedAccess`.

The codebase uses many non-null assertions (`!`) on array accesses that this flag would catch:

```ts
// Examples of ! assertions that should be narrowed instead:
state.tableau[col]!           // Could be undefined if col out of range
state.foundations[fi]!        // Could be undefined
column[i]!                    // Loop variable, but index could be out of bounds
state.dealerHand[0]!          // Assumes non-empty, but what about edge cases?
state.playerHand[0]!          // Same
deck.pop()!                   // Assumes non-empty deck
```

**Tasks:**

- [ ] Add `"noUncheckedIndexedAccess": true` to `tsconfig.json`
- [ ] Fix resulting type errors with proper narrowing (not `!`)
- [ ] Where narrowing is impossible, use explicit `throw new Error(...)` for invariant violations

---

### 7. No Code Splitting

All 3 games + shared code are in one bundle. With the hub as a menu:

**Recommendation:** Lazy-load each game via dynamic `import()`:

```ts
// hub.ts
const GAMES: GameDef[] = [
  {
    id: 'solitaire',
    name: 'Solitaire',
    description: '...',
    load: () => import('./games/solitaire/index'),
  },
  // ...
];
```

Benefits:

- Hub loads instantly (~5 KB)
- Games load on demand
- Per-game error isolation (one game crash doesn't break the hub)
- Enables future code-splitting of shared code if games diverge

**Tasks:**

- [ ] Convert `GameDef.start` to a lazy `load()` pattern
- [ ] Update `startHub` to `await game.load()` on selection
- [ ] Show loading state while dynamically importing

---

## 🟢 Smaller Improvements

### 8. Silent Error Swallowing in Audio

`src/shared/audio.ts` `playCardSfx()`:

```ts
catch {
  // A clip can fail if decoding was skipped; SFX is non-essential.
}
```

Add at minimum `console.warn` so failures are discoverable during development.

**Tasks:**

- [ ] Add `console.warn('board-games: SFX play failed:', error)` in the catch block

---

### 9. No Keyboard / Accessibility Support

- All buttons lack `aria-label` attributes
- Canvas-only rendering has zero screen-reader support
- No keyboard shortcuts for any game action

**Tasks:**

- [ ] Add `aria-label` to all buttons
- [ ] Add keyboard shortcuts: `H` = Hit, `S` = Stand (Blackjack); `N` = New deal (all games); `Backspace` = Back to hub

---

### 10. `index.html` Missing Viewport Meta

Missing `<meta name="viewport" content="width=device-width, initial-scale=1.0">` — prevents proper scaling on mobile browsers.

Also missing common `<meta>` tags:

- `<meta name="description">`
- `<meta name="theme-color" content="#0b3d2e">`

**Tasks:**

- [ ] Add viewport meta tag
- [ ] Add description and theme-color meta tags

---

### 11. `.gitignore` Gaps

Current:

```
node_modules/
dist/
.vite/
*.local
.eslintcache
```

Missing:

```
coverage/
test-results/
*.tsbuildinfo
```

**Tasks:**

- [ ] Add `coverage/`, `test-results/`, `*.tsbuildinfo` to `.gitignore`

---

### 12. Inline CSS via String Concatenation

All styling uses `.style.cssText = '...'` with manual string concatenation. This is verbose, untyped, and hard to maintain consistently.

**Recommendation:** Even a minimal improvement — a `css` tagged template literal or a shared styles object:

```ts
const BUTTON_PRIMARY = 'padding:4px 12px;font:inherit;font-weight:600;color:#fff;'
  + 'background:#1f6b4f;border:1px solid #3fbf8f;border-radius:6px;cursor:pointer';
const BUTTON_SECONDARY = 'padding:4px 12px;font:inherit;font-weight:600;color:#cde;'
  + 'background:#2a5a4a;border:1px solid #3fbf8f;border-radius:6px;cursor:pointer';
```

**Tasks:**

- [ ] Create `src/shared/styles.ts` with shared CSS constants
- [ ] Update all game files to use shared style constants

---

### 13. AudioContext Never Closed

The `AudioContext` created in `src/main.ts` is never `.close()`d. The `start()` return value (dispose function) should close it.

**Tasks:**

- [ ] Close `audioCtx` in the `start()` dispose callback
- [ ] Guard with `audioCtx.state !== 'closed'` check

---

### 14. Unused `spider.ts` Import Triggering Module Side Effects

`hub.ts` eagerly imports all 3 game modules at the top. This means all game code (including their ECS world registrations) runs before any game is selected. Combined with code-splitting (item 7), this would be eliminated.

**Tasks:**

- [ ] (Covered by item 7 — code splitting)

---

## Summary by Effort/Impact

| # | Enhancement | Impact | Effort |
|---|------------|--------|--------|
| 2 | Mandatory docs (README, INDEX, etc.) | 🔴 High | Small |
| 1 | Unit tests for pure game logic | 🔴 High | Medium |
| 3 | Extract `GameShell` abstraction | 🟡 Medium | Medium |
| 5 | Consolidate shared constants | 🟡 Medium | Small |
| 6 | Enable `noUncheckedIndexedAccess` | 🟡 Medium | Small–Medium |
| 4 | Move `GameResources` to `shared/` | 🟡 Medium | Small |
| 7 | Code-split games via dynamic `import()` | 🟢 Low-Med | Small |
| 12 | Extract inline CSS to constants | 🟢 Low | Small |
| 10 | Add viewport meta + HTML meta tags | 🟢 Low | Tiny |
| 11 | Fill `.gitignore` gaps | 🟢 Low | Tiny |
| 8 | `catch {}` → `console.warn` in audio | 🟢 Low | Tiny |
| 13 | Close AudioContext on dispose | 🟢 Low | Tiny |
| 9 | Keyboard shortcuts + ARIA labels | 🟢 Low | Small |

---

## Dependency Order (Recommended)

1. Docs (item 2) — no dependencies, establishes context
2. Constants consolidation (item 5) — foundation for later refactors
3. Move `GameResources` (item 4) — fixes import architecture
4. Unit tests (item 1) — safety net before refactoring
5. `noUncheckedIndexedAccess` (item 6) — catches bugs before GameShell
6. GameShell abstraction (item 3) — biggest payoff, needs tests first
7. Code splitting (item 7) — builds on GameShell
8. All 🟢 items — anytime, low risk
