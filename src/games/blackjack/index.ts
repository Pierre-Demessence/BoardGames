/**
 * Blackjack (21) — game entry point.
 *
 * Turn-based: player hits or stands via buttons, dealer follows fixed rules.
 * No drag-and-drop — just button clicks.
 */

import type { EntityId } from '@pierre/ecs';

import type { GameResources } from '../solitaire';
import type { GameState } from './game';

import { EcsWorld } from '@pierre/ecs';
import { RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';

import { playCardSfx } from '../../shared';
import { computeLayout } from '../../shared/layout';
import {
  checkNaturalBlackjack,
  dealerHit,
  dealNewGame,
  hit,
  stand,
} from './game';
import { renderFrame, syncLayout } from './render';

const BAR_HEIGHT = 44;
const BLACKJACK_SLOTS = 12; // enough for many cards in a hand

function makeWorld(): EcsWorld {
  const world = new EcsWorld();
  world.registerComponent(PositionDef);
  world.registerComponent(RenderableDef);
  world.registerComponent(RenderOrderDef);
  return world;
}

export function start(container: HTMLElement, resources: GameResources, onBack: () => void): () => void {
  const containerRect = container.getBoundingClientRect();
  const layout = computeLayout(containerRect.width, containerRect.height - BAR_HEIGHT, BLACKJACK_SLOTS);

  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.width = layout.canvasW;
  canvas.height = layout.canvasH;
  canvas.style.cssText = `display:block;width:${layout.canvasW}px;height:${layout.canvasH}px;`
    + 'margin:0 auto;border-radius:10px;touch-action:none;cursor:default';
  const ctx2d = canvas.getContext('2d')!;

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:12px;align-items:center;justify-content:center;'
    + `padding:8px 10px;font:13px system-ui;color:#cde;flex-shrink:0;height:${BAR_HEIGHT}px;box-sizing:border-box`;

  const backBtn = document.createElement('button');
  backBtn.textContent = '← Games';
  backBtn.style.cssText = 'padding:4px 12px;font:inherit;font-weight:600;color:#cde;'
    + 'background:#2a5a4a;border:1px solid #3fbf8f;border-radius:6px;cursor:pointer';

  const hitBtn = document.createElement('button');
  hitBtn.textContent = 'Hit';
  hitBtn.style.cssText = 'padding:4px 16px;font:inherit;font-weight:600;color:#fff;'
    + 'background:#1f6b4f;border:1px solid #3fbf8f;border-radius:6px;cursor:pointer';

  const standBtn = document.createElement('button');
  standBtn.textContent = 'Stand';
  standBtn.style.cssText = 'padding:4px 16px;font:inherit;font-weight:600;color:#fff;'
    + 'background:#1f6b4f;border:1px solid #3fbf8f;border-radius:6px;cursor:pointer';

  const newDealBtn = document.createElement('button');
  newDealBtn.textContent = 'New deal';
  newDealBtn.style.cssText = 'padding:4px 12px;font:inherit;font-weight:600;color:#cde;'
    + 'background:#2a5a4a;border:1px solid #3fbf8f;border-radius:6px;cursor:pointer';

  bar.append(backBtn, hitBtn, standBtn, newDealBtn);
  container.append(bar, canvas);

  const { atlases, audio } = resources;
  const abort = new AbortController();

  let disposed = false;
  let world = makeWorld();
  let state: GameState | null = null;
  let rafId = 0;
  let nextDealerHitTime = 0;
  const DEALER_DELAY = 600; // ms between dealer card reveals

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

    if (checkNaturalBlackjack(state)) {
      updateButtons();
    }
  };

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

  const onBackClick = (): void => {
    disposed = true;
    abort.abort();
    cancelAnimationFrame(rafId);
    container.innerHTML = '';
    onBack();
  };

  hitBtn.addEventListener('click', onHit, { signal: abort.signal });
  standBtn.addEventListener('click', onStand, { signal: abort.signal });
  newDealBtn.addEventListener('click', newDeal, { signal: abort.signal });
  backBtn.addEventListener('click', onBackClick, { signal: abort.signal });

  const loop = (): void => {
    if (disposed)
      return;
    if (state) {
      // Animate dealer hits one card at a time
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
    }
    rafId = requestAnimationFrame(loop);
  };

  newDeal();
  loop();

  return () => {
    disposed = true;
    abort.abort();
    cancelAnimationFrame(rafId);
    container.innerHTML = '';
  };
}
