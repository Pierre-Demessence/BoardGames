# Spider Solitaire (1-suit)

## Overview
Implement Spider Solitaire using the shared card/audio/atlas infrastructure.
First variant: 1-suit (all Spades) for simplicity.

## Rules
- 104 cards: 8 copies of each rank (A→K), all Spades
- 10 tableau columns, no foundations, stock pile (50 cards)
- Initial deal: cols 0-3 get 6 cards, cols 4-9 get 5 cards
- Stock: click to deal 1 face-up card to each column (all 10 must have ≥1 card)
- Move: drag face-up card or same-suit descending run onto column with top card 1 rank higher
- Empty column: any card or sequence allowed
- Complete K→A run (same suit) auto-removes from tableau
- Win: all 8 complete runs removed

## Tasks
- [x] Create `src/games/spider/game.ts` — state, deal, move rules, layout, sequence detection
- [x] Create `src/games/spider/render.ts` — syncLayout + renderFrame for 10 columns + stock + completed counter
- [x] Create `src/games/spider/index.ts` — entry point: input, render loop, win detection
- [x] Register Spider in `src/hub.ts`
- [x] Typecheck + lint + build
