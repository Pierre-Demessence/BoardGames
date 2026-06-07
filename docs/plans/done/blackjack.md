# Blackjack

## Overview
Classic casino Blackjack (21). Player vs dealer (deterministic rules, not AI).
Single deck, no betting for now (just win/lose/push).

## Rules
- Standard 52-card deck, shuffled each round
- Card values: 2-10 face value, J/Q/K = 10, Ace = 1 or 11 (whichever is better)
- Player goes first: Hit (draw card) or Stand (end turn)
- Dealer must hit until hand value ≥ 17, then stands
- Bust (>21): immediate loss
- Higher hand wins, tie = push
- Natural blackjack (Ace + 10-value on first two cards) = instant win

## Layout
- Player's hand at bottom, dealer's hand at top
- Dealer's first card face-down during player's turn
- Hand values displayed
- Button bar: Hit, Stand, New Deal

## Tasks
- [x] Create `src/games/blackjack/game.ts` — deck, hand values, game state, dealer AI
- [x] Create `src/games/blackjack/render.ts` — render hands, values, banners
- [x] Create `src/games/blackjack/index.ts` — entry point with buttons + render loop
- [x] Register in `src/hub.ts`
- [x] Typecheck + lint + build
