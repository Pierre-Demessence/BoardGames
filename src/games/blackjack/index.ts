/**
 * Blackjack (21) — game entry point.
 *
 * Turn-based: player hits or stands via buttons, dealer follows fixed rules.
 * No drag-and-drop — just button clicks.
 */

import type { EntityId } from '@pierre/ecs';

import type { GameResources } from '../../shared';
import type { GameState } from './game';

import { BAR_HEIGHT, createGameShell, makeWorld, playCardSfx } from '../../shared';
import { computeLayout } from '../../shared/layout';
import {
  checkNaturalBlackjack,
  dealerHit,
  dealNewGame,
  hit,
  stand,
} from './game';
import { renderFrame, syncLayout } from './render';

const BLACKJACK_SLOTS = 12;
const DEALER_DELAY = 600;

export function start(container: HTMLElement, resources: GameResources, onBack: () => void): () => void {
  const containerRect = container.getBoundingClientRect();
  const layout = computeLayout(containerRect.width, containerRect.height - BAR_HEIGHT, BLACKJACK_SLOTS);

  const { atlases, audio } = resources;

  let world = makeWorld();
  let state: GameState | null = null;
  let nextDealerHitTime = 0;

  const updateButtons = (): void => {
    if (!state) {
      hitBtn.disabled = true;
      standBtn.disabled = true;
      return;
    }
    const playing = state.status === 'playerTurn';
    hitBtn.disabled = !playing;
    standBtn.disabled = !playing;
  };

  const newDeal = (): void => {
    world = makeWorld();
    state = dealNewGame((): EntityId => world.createEntity(), layout);
    nextDealerHitTime = 0;
    updateButtons();
    if (checkNaturalBlackjack(state))
      updateButtons();
  };

  const shell = createGameShell(container, layout.canvasW, layout.canvasH, onBack, newDeal, 'default');

  const hitBtn = shell.addButton('Hit', true);
  const standBtn = shell.addButton('Stand', true);

  const onHit = (): void => {
    if (!state || state.status !== 'playerTurn')
      return;
    playCardSfx(audio, 'slide');
    hit(state);
    updateButtons();
  };

  const onStand = (): void => {
    if (!state || state.status !== 'playerTurn')
      return;
    playCardSfx(audio, 'place');
    stand(state);
    nextDealerHitTime = performance.now() + DEALER_DELAY;
    updateButtons();
  };

  hitBtn.addEventListener('click', onHit, { signal: shell.signal });
  standBtn.addEventListener('click', onStand, { signal: shell.signal });

  const { ctx2d } = shell;

  shell.startLoop(() => {
    if (!state)
      return;
    if (state.status === 'dealerTurn') {
      if (nextDealerHitTime === 0) {
        nextDealerHitTime = performance.now() + DEALER_DELAY;
      }
      else if (performance.now() >= nextDealerHitTime) {
        playCardSfx(audio, 'slide');
        const keepGoing = dealerHit(state);
        if (keepGoing)
          nextDealerHitTime = performance.now() + DEALER_DELAY;
        updateButtons();
      }
    }
    syncLayout(world, state);
    renderFrame(ctx2d, world, atlases, state);
  });

  newDeal();

  return () => shell.dispose();
}
