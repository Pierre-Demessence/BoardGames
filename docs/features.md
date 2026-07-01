# Features

## Games

| Feature | Game | Criticality | Description |
|---------|------|------------|-------------|
| Klondike Solitaire | Solitaire | Core | Draw-1, standard 52-card deck, 7 tableau columns |
| Spider Solitaire | Spider | Core | 1-suit (Spades), 104-card deck, 10 tableau columns |
| Blackjack | Blackjack | Core | Classic 21, player vs dealer, hit/stand |
| Scoring | Solitaire | Core | Windows-style: move bonuses, flip bonuses, time bonus/penalty |
| Auto-win animation | Solitaire | Enhancement | Cards auto-move to foundations when all tableau cards are face-up |
| Victory animation | Solitaire | Enhancement | Cards scatter across screen on win |
| Run completion detection | Spider | Core | Auto-detect and remove K→A runs, flip next card |
| Stock dealing | Spider | Core | Deal one card to each column from remaining stock |
| Dealer AI | Blackjack | Core | Dealer hits on <17, stands on ≥17 |
| Natural blackjack detection | Blackjack | Core | Instant win on 2-card 21 |

## Shared Infrastructure

| Feature | Criticality | Description |
|---------|------------|-------------|
| Dynamic card layout | Core | Card sizing computed from viewport dimensions |
| Texture atlas loading | Core | Kenney spritesheet (TexturePacker XML) loading via @pierre/ecs |
| Card SFX | Enhancement | Place + slide sounds with random variation |
| Game hub / selector | Core | Menu screen listing all games, back navigation |
| Shared asset cache | Core | Atlases and audio loaded once, reused across games |
| ECS Canvas2D rendering | Core | Card entities rendered via @pierre/ecs render-canvas2d module |
