# Solitaire Enhancements — Windows-Style

## Overview
Add scoring, auto-win, timed game, and victory animation to Solitaire.

## Scoring (Windows Klondike rules)
| Move | Points |
|------|--------|
| Waste → Tableau | +5 |
| Waste → Foundation | +10 |
| Tableau → Foundation | +10 |
| Turn over tableau card | +5 |
| Foundation → Tableau | -15 |
| Recycle waste (draw-1) | -100 (min 0) |
| Time deduction | -2 every 10s |
| Time bonus | 700000 ÷ seconds (≥30s) |

## Tasks
- [x] Add score, timer, move tracking to GameState
- [x] Implement point calculations for each move type
- [x] Add score + timer display to render
- [x] Auto-win detection + animated card movement to foundations
- [x] Victory screen with cards falling + bouncing
- [x] Typecheck + lint + build
