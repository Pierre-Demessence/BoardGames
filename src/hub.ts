/**
 * Hub — game selector menu.
 *
 * Presents available games as a simple list. Shared resources (atlases,
 * audio) are loaded once and passed to whichever game the user selects.
 * When a game's back button is pressed, the hub re-renders.
 */

import type { GameResources } from './games/solitaire/index';

import { start as startBlackjack } from './games/blackjack/index';
import { start as startSolitaire } from './games/solitaire/index';
import { start as startSpider } from './games/spider/index';

interface GameDef {
  id: string;
  name: string;
  description: string;
  start: (container: HTMLElement, resources: GameResources, onBack: () => void) => () => void;
}

const GAMES: GameDef[] = [
  {
    id: 'solitaire',
    name: 'Solitaire',
    description: 'Klondike (draw-1) — the classic patience game',
    start: startSolitaire,
  },
  {
    id: 'spider',
    name: 'Spider',
    description: '1-suit — build 8 complete runs from King to Ace',
    start: startSpider,
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    description: 'Classic 21 — beat the dealer without busting',
    start: startBlackjack,
  },
];

export function startHub(
  container: HTMLElement,
  resources: GameResources,
): void {
  container.innerHTML = '';

  const root = document.createElement('div');
  root.style.cssText = 'text-align:center;padding:40px 20px;';

  const title = document.createElement('h1');
  title.textContent = '🎴 Board Games';
  title.style.cssText = 'margin:0 0 8px;font:700 32px system-ui;color:#ffe14d;';
  root.append(title);

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Choose a game to play';
  subtitle.style.cssText = 'margin:0 0 32px;font:16px system-ui;color:#cde;';
  root.append(subtitle);

  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:12px;max-width:400px;margin:0 auto;';

  for (const game of GAMES) {
    const card = document.createElement('button');
    card.style.cssText = 'padding:16px 20px;text-align:left;font:inherit;color:#fff;'
      + 'background:#1a4a3a;border:1px solid #3fbf8f;border-radius:10px;cursor:pointer;'
      + 'transition:background 0.15s';
    card.addEventListener('pointerenter', () => {
      card.style.background = '#1f6b4f';
    });
    card.addEventListener('pointerleave', () => {
      card.style.background = '#1a4a3a';
    });

    const name = document.createElement('div');
    name.textContent = game.name;
    name.style.cssText = 'font:700 18px system-ui;';
    card.append(name);

    const desc = document.createElement('div');
    desc.textContent = game.description;
    desc.style.cssText = 'font:13px system-ui;color:#aac;margin-top:4px;';
    card.append(desc);

    card.addEventListener('click', () => {
      game.start(container, resources, () => {
        startHub(container, resources);
      });
    });

    list.append(card);
  }

  root.append(list);
  container.append(root);
}
