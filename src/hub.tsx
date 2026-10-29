/**
 * Hub — game selector menu (Preact component).
 *
 * Lists the registered games as a styled list. When a game is selected,
 * the `onSelectGame` callback is invoked with the game id.
 */

import { GAMES } from './core';
import styles from './hub.module.css';

export interface HubProps {
  onSelectGame: (gameId: string) => void;
}

export function Hub({ onSelectGame }: HubProps) {
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
