/**
 * Game registry — the hub lists these and `App` loads the chosen one on demand,
 * so each game is its own chunk.
 */

import type { ComponentType } from 'preact';

import type { GameResources } from './resources';

export interface GameProps {
  resources: GameResources;
  onBack: () => void;
}

export interface GameDef {
  id: string;
  name: string;
  description: string;
  load: () => Promise<ComponentType<GameProps>>;
}

export const GAMES: GameDef[] = [
  {
    id: 'solitaire',
    name: 'Solitaire',
    description: 'Klondike (draw-1) — the classic patience game',
    load: () => import('../games/solitaire/index.tsx').then(m => m.SolitaireGame),
  },
  {
    id: 'spider',
    name: 'Spider',
    description: '1-suit — build 8 complete runs from King to Ace',
    load: () => import('../games/spider/index.tsx').then(m => m.SpiderGame),
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    description: 'Classic 21 — beat the dealer without busting',
    load: () => import('../games/blackjack/index.tsx').then(m => m.BlackjackGame),
  },
  {
    id: 'yahtzee',
    name: 'Yahtzee',
    description: 'Five dice, 13 turns, 1 to 4 players, humans or computer',
    load: () => import('../games/yahtzee/index.tsx').then(m => m.YahtzeeGame),
  },
];
