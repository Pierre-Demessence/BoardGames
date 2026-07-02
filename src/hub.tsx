/**
 * Hub — game selector menu (Preact component).
 *
 * Presents available games as a styled list. When a game is selected,
 * the `onSelectGame` callback is invoked with the game id.
 */

import type { GameResources } from './shared';

import styles from './hub.module.css';

interface GameDef {
  id: string;
  name: string;
  description: string;
}

const GAMES: GameDef[] = [
  {
    id: 'solitaire',
    name: 'Solitaire',
    description: 'Klondike (draw-1) — the classic patience game',
  },
  {
    id: 'spider',
    name: 'Spider',
    description: '1-suit — build 8 complete runs from King to Ace',
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    description: 'Classic 21 — beat the dealer without busting',
  },
];

export interface HubProps {
  resources: GameResources;
  onSelectGame: (gameId: string) => void;
}

export function Hub({ onSelectGame, resources: _resources }: HubProps) {
  return (
    <div class={styles.root}>
      <h1 class={styles.title}>🎴 Board Games</h1>
      <p class={styles.subtitle}>Choose a game to play</p>
      <div class={styles.list}>
        {GAMES.map(game => (
          <button
            key={game.id}
            class={styles.card}
            onClick={() => onSelectGame(game.id)}
          >
            <div class={styles.cardName}>{game.name}</div>
            <div class={styles.cardDesc}>{game.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
