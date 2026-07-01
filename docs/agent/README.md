---
last-updated: 2026-07-01
applicable:
  - src/**
  - docs/**
  - package.json
  - tsconfig.json
  - vite.config.ts
  - vitest.config.ts
  - eslint.config.ts
owner: pierre
---

# Agent README — BoardGames

## Purpose
Reference for AI coding agents working on this project. Read before making changes.

## Required Scripts

```bash
npm run dev          # Vite dev server → http://localhost:5184
npm run build        # tsc --noEmit + vite build
npm run lint         # ESLint check (flat config with antfu)
npm run lint:fix     # ESLint auto-fix
npm test             # vitest run (jsdom environment)
npm run test:watch   # vitest watch mode
```

## Important Paths

| Path | Purpose |
|------|---------|
| `src/main.ts` | Entry point — asset loading + hub boot |
| `src/hub.ts` | Game selector menu |
| `src/shared/` | Shared modules: cards, deck, atlas, audio, layout |
| `src/games/<name>/` | Per-game: `index.ts` (entry), `game.ts` (logic), `render.ts` (drawing) |
| `docs/plans/` | Active feature plans |
| `docs/plans/done/` | Completed feature plans |

## Invariants

1. **Pure game logic:** `game.ts` files contain no DOM, no canvas, no ECS. They are pure data transforms (ideally testable).
2. **ECS rendering:** Card entities get `PositionDef`, `RenderableDef`, `RenderOrderDef` set each frame by `syncLayout()`.
3. **Dispose pattern:** Every `start()` returns a cleanup function: abort listeners → cancel rAF → clear DOM.
4. **TypeScript strict:** `strict: true`, `erasableSyntaxOnly: true`, `verbatimModuleSyntax: true`, `noUnusedLocals/Parameters: true`.
5. **No parameter properties:** `erasableSyntaxOnly` forbids them — use explicit fields + constructor assignment.
6. **No enums, no namespaces:** Banned by `erasableSyntaxOnly`.
7. **No cross-game imports:** Games don't import from each other (exception: `GameResources` re-exported by solitaire — known tech debt).
8. **SFX is non-essential:** Audio failures are silently swallowed; games work without sound.
9. **Dev server port:** 5184 (set in `vite.config.ts`).
10. **Pierre owns dev server & E2E:** Do not start/stop the dev server or run browser automation without asking.
11. **No commits without explicit permission:** Per-commit authorization required.
12. **No pushes:** Pierre handles all pushes manually.

## Engine Dependency

`@pierre/ecs` is a local sibling dependency: `file:../Entity-Cornponent-System-Engine`. Key modules used:
- `EcsWorld` — world creation, entity management, component stores
- `modules/asset-loader` — `AssetLoader`, `imageAsset`, `textAsset`, `audioBufferAsset`
- `modules/texture-atlas` — `TextureAtlasRegistry`, `parseTexturePackerAtlas`
- `modules/render-canvas2d` — `Canvas2DRenderer`, `RenderableDef`, `RenderOrderDef`
- `modules/transform` — `PositionDef`
- `modules/input` — `projectPointer`
- `modules/audio` — `WebAudioProvider`
- `modules/rng` — `shuffle`, `pick`
