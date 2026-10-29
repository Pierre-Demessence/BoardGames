# Decisions

Why the design is the way it is, where the code alone would not say.

## Game state is plain JSON outside the ECS world

Each game's state is plain JSON (cards, piles, score), and rules are functions from state and move to the next state. The engine's `pile` module is not used: it keeps piles as entities and components in the ECS world, which would make undo snapshots, saves and multiplayer sync depend on world serialization instead of a `JSON.stringify` of the state. The ECS world only draws: the view derives sprites from the state each frame.

## Card ids are separate from entity ids

A card's `id` is its index in the deal, a plain number. The view creates one entity per card id when a game starts and keeps the mapping (`entityOf[id]`). The rules never see entities, so the same state can be restored after an undo or a reload without matching ids to a world that no longer holds them, and two games dealt from the same seed have equal states.

## Solitaire's time penalty is derived from timestamps

`state.score` holds move points only. The displayed score is computed from `startedAt`, `endedAt` and the `now` passed in, so no tick move accumulates the penalty. The clock stays injectable, undo restores the right score without replaying time, and the penalty stops at the win by `endedAt` alone.

## Blackjack's dealer plays through `dealerStep` moves

`stand` hands the turn to the dealer, and the component sends `dealerStep` every `DEALER_DELAY` until the round is over. Putting the whole dealer turn inside `stand` would be shorter, but the dealer's cards would appear at once; the pacing belongs to the view while the rules stay free of timers.

## The audio context resumes on `pointerdown` and `pointerup`

Browsers only let an audio context play after a user gesture. A mouse `pointerdown` can arrive before the browser counts it as user activation, so the first-press listener also waits for `pointerup` and stops once the context is running.
