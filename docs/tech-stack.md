# Tech Stack

## Languages & Runtime

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | ^5.9.3 |
| Target | ES2023 | — |
| Module system | ESM (`"type": "module"`) | — |
| Runtime | Browser (DOM + Canvas2D) | — |
| Package manager | npm | — |

## Build & Dev

| Tool | Version | Purpose |
|------|---------|---------|
| [Vite](https://vitejs.dev/) | ^8.0.3 | Dev server, production bundler |
| [Vitest](https://vitest.dev/) | ^4.1.2 | Unit test runner |
| [jsdom](https://github.com/jsdom/jsdom) | ^29.0.1 | DOM environment for tests |

## Linting

| Tool | Version | Config |
|------|---------|--------|
| [ESLint](https://eslint.org/) | ^10.2.0 | `eslint.config.ts` |
| [@antfu/eslint-config](https://github.com/antfu/eslint-config) | ^8.0.0 | Flat config, stylistic + perfectionist rules |
| [eslint-plugin-import-x](https://github.com/un-ts/eslint-plugin-import-x) | ^4.16.2 | Import resolution validation |
| [eslint-import-resolver-typescript](https://github.com/import-js/eslint-import-resolver-typescript) | ^4.4.4 | TS-aware import resolution |
| [jiti](https://github.com/unjs/jiti) | ^2.7.0 | TS loader for ESLint flat config |

## Engine

| Dependency | Version | Purpose |
|-----------|---------|---------|
| [@pierre/ecs](https://github.com/pierre/ecs) | local (`file:../Entity-Cornponent-System-Engine`) | ECS framework, Canvas2D renderer, asset loader, audio, RNG |

## Assets

All card artwork and SFX from [Kenney](https://kenney.nl/) boardgame packs (public domain / CC0):

- `kenney_boardgame-pack` — playing cards, card backs, chips, dice
- `kenney_board-game-info` — board game UI icons
- `kenney_ui-pack` — UI sounds
- `kenney_cursor-pack` — cursor graphics
- `kenney_input-prompts_1.5` — input prompt icons
- `kenney_kenney-fonts` — display fonts

## Minimum Supported Versions

| Dependency | Min Version |
|-----------|-------------|
| Node.js | 20.x (LTS) |
| npm | 10.x |
| Browser | Any modern evergreen (Chrome, Firefox, Safari, Edge) |
