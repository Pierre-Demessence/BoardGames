# 🎴 Board Games

A collection of card and dice games for the browser, built with Preact on the
`@pierre/ecs` engine.

## Games

- **Solitaire** — Klondike, draw-1, with Windows-style scoring and timer. Once
  the stock is empty and every card is face up, the remaining cards finish on
  their own, followed by a bouncing-cards victory animation.
- **Spider** — 1-suit (all Spades), 104 cards in 10 columns. Completed
  King-to-Ace runs clear themselves; the stock deals one card to each column.
- **Blackjack** — classic 21 against a dealer who draws to 17. Hit or stand; a
  natural blackjack ends the round at once.
- **Yahtzee** — five dice and 13 turns for 1 to 4 players, each a person or the
  computer: roll up to three times, hold the dice you want and fill the scorecard
  by the official rules, bonuses and joker rule included. The computer plays
  simply for now.

A menu lists the games, every game has Back and New deal (New game in Yahtzee)
buttons, and card and dice sounds play when audio is available.

## Setup

The engine must be checked out next to this repository as
`../Entity-Cornponent-System-Engine`; it is installed from there as a local
dependency.

```bash
npm install
npm run dev      # http://localhost:5184
npm run build    # typecheck + production build
npm test
npm run lint
```

Layout and conventions for contributors are in [AGENTS.md](AGENTS.md); open
work is in [docs/backlog.md](docs/backlog.md).

## Credits

Card art and sounds come from [Kenney](https://kenney.nl/) asset packs (CC0).

## License

Private — not licensed for redistribution.
