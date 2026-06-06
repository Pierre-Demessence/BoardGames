/**
 * Solitaire (Klondike, draw-1) — game entry point.
 *
 * Receives pre-loaded shared resources (atlases, audio) from the hub so
 * all card games share the same card sprites and SFX.
 *
 * Input:
 * - click the stock to deal to the waste (empty stock recycles the waste),
 * - drag a face-up card (and the run beneath it) between tableau columns,
 * - drag a single card to a foundation, or double-click to auto-send it.
 */

import type { EntityId } from '@pierre/ecs';
import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { CardAudio } from '../../shared';
import type { Card, GameState, PileRef } from './game';

import { EcsWorld } from '@pierre/ecs';
import { projectPointer } from '@pierre/ecs/modules/input';
import { RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';

import { playCardSfx } from '../../shared';
import {
  canDropOnFoundation,
  canDropOnTableau,
  CANVAS_H,
  CANVAS_W,
  CARD_H,
  CARD_W,
  cardPosition,
  dealNewGame,
  findFoundationFor,
  isWon,
  pileArray,
  slotPosition,
} from './game';
import { renderFrame, syncLayout } from './render';

export interface GameResources {
  atlases: TextureAtlasRegistry;
  audio: CardAudio;
  audioCtx: AudioContext;
}

interface Drag {
  cards: Card[];
  from: PileRef;
  grabX: number;
  grabY: number;
  pointerX: number;
  pointerY: number;
}

function makeWorld(): EcsWorld {
  const world = new EcsWorld();
  world.registerComponent(PositionDef);
  world.registerComponent(RenderableDef);
  world.registerComponent(RenderOrderDef);
  return world;
}

export function start(container: HTMLElement, resources: GameResources, onBack: () => void): () => void {
  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.style.cssText = `display:block;width:${CANVAS_W}px;height:${CANVAS_H}px;`
    + 'margin:0 auto;border-radius:10px;touch-action:none;cursor:pointer';
  const ctx2d = canvas.getContext('2d')!;

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:12px;align-items:center;justify-content:center;'
    + 'padding:10px;font:13px system-ui;color:#cde';

  const backBtn = document.createElement('button');
  backBtn.textContent = '← Games';
  backBtn.style.cssText = 'padding:6px 14px;font:inherit;font-weight:600;color:#cde;'
    + 'background:#2a5a4a;border:1px solid #3fbf8f;border-radius:6px;cursor:pointer';

  const newDealBtn = document.createElement('button');
  newDealBtn.textContent = 'New deal';
  newDealBtn.style.cssText = 'padding:6px 14px;font:inherit;font-weight:600;color:#fff;'
    + 'background:#1f6b4f;border:1px solid #3fbf8f;border-radius:6px;cursor:pointer';

  const hint = document.createElement('span');
  hint.textContent = '';

  bar.append(backBtn, newDealBtn, hint);
  container.append(bar, canvas);

  const { atlases, audio, audioCtx } = resources;
  const abort = new AbortController();

  let disposed = false;
  let world = makeWorld();
  let state: GameState | null = null;
  let drag: Drag | null = null;
  let rafId = 0;

  const newDeal = (): void => {
    world = makeWorld();
    state = dealNewGame((): EntityId => world.createEntity());
    drag = null;
    hint.textContent = 'Click the stock to deal · drag to move · double-click to send to a foundation';
  };

  const playSfx = (kind: 'place' | 'slide'): void => {
    playCardSfx(audio, kind);
  };

  // --- Input ---

  const toWorld = (event: PointerEvent | MouseEvent): { x: number; y: number } =>
    projectPointer(event, canvas);

  const onPointerDown = (event: PointerEvent): void => {
    if (!state || state.won)
      return;
    void audioCtx.resume();
    const point = toWorld(event);

    if (inSlot(point, slotPosition({ index: 0, kind: 'stock' }))) {
      dealFromStock(state, playSfx);
      return;
    }

    const hit = pickCard(state, point);
    if (!hit)
      return;
    const pile = pileArray(state, hit.pile);
    const card = pile[hit.index]!;
    if (!card.faceUp)
      return;
    if (hit.pile.kind === 'tableau' ? false : hit.index !== pile.length - 1)
      return;

    const cards = hit.pile.kind === 'tableau' ? pile.slice(hit.index) : [card];
    const origin = cardPosition(state, hit.pile, hit.index);
    drag = {
      cards,
      from: hit.pile,
      grabX: point.x - origin.x,
      grabY: point.y - origin.y,
      pointerX: point.x,
      pointerY: point.y,
    };
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!drag)
      return;
    const point = toWorld(event);
    drag.pointerX = point.x;
    drag.pointerY = point.y;
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!drag || !state)
      return;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    resolveDrop(state, drag, playSfx);
    drag = null;
  };

  const onDoubleClick = (event: MouseEvent): void => {
    if (!state || state.won)
      return;
    const hit = pickCard(state, toWorld(event));
    if (!hit || hit.pile.kind === 'foundation' || hit.pile.kind === 'stock')
      return;
    const pile = pileArray(state, hit.pile);
    const card = pile[hit.index]!;
    if (!card.faceUp || hit.index !== pile.length - 1)
      return;
    const target = findFoundationFor(state, card);
    if (target === -1)
      return;
    pile.pop();
    state.foundations[target]!.push(card);
    flipExposed(hit.pile, state);
    playSfx('place');
    finishMove(state);
  };

  // Back button returns to hub
  const onBackClick = (): void => {
    disposed = true;
    abort.abort();
    cancelAnimationFrame(rafId);
    container.innerHTML = '';
    onBack();
  };

  canvas.addEventListener('pointerdown', onPointerDown, { signal: abort.signal });
  canvas.addEventListener('pointermove', onPointerMove, { signal: abort.signal });
  canvas.addEventListener('pointerup', onPointerUp, { signal: abort.signal });
  canvas.addEventListener('pointercancel', onPointerUp, { signal: abort.signal });
  canvas.addEventListener('dblclick', onDoubleClick, { signal: abort.signal });
  newDealBtn.addEventListener('click', newDeal, { signal: abort.signal });
  backBtn.addEventListener('click', onBackClick, { signal: abort.signal });

  function finishMove(s: GameState): void {
    if (isWon(s)) {
      s.won = true;
      hint.textContent = 'You win! Press "New deal" to play again.';
    }
  }

  function resolveDrop(
    s: GameState,
    d: Drag,
    sfx: (kind: 'place' | 'slide') => void,
  ): void {
    const center = {
      x: d.pointerX - d.grabX + CARD_W / 2,
      y: d.pointerY - d.grabY + CARD_H / 2,
    };
    const target = dropTarget(s, center, d);
    if (!target) {
      sfx('slide');
      return;
    }

    const source = pileArray(s, d.from);
    source.splice(source.length - d.cards.length, d.cards.length);
    pileArray(s, target).push(...d.cards);
    flipExposed(d.from, s);
    sfx('place');
    finishMove(s);
  }

  function dealFromStock(s: GameState, sfx: (kind: 'place' | 'slide') => void): void {
    if (s.stock.length > 0) {
      const card = s.stock.pop()!;
      card.faceUp = true;
      s.waste.push(card);
    }
    else {
      while (s.waste.length > 0) {
        const card = s.waste.pop()!;
        card.faceUp = false;
        s.stock.push(card);
      }
    }
    sfx('slide');
  }

  // --- Render loop ---

  const loop = (): void => {
    if (disposed)
      return;
    if (state) {
      syncLayout(world, state, drag);
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

function inSlot(point: { x: number; y: number }, slot: { x: number; y: number }): boolean {
  return point.x >= slot.x && point.x <= slot.x + CARD_W
    && point.y >= slot.y && point.y <= slot.y + CARD_H;
}

function pickCard(
  state: GameState,
  point: { x: number; y: number },
): { index: number; pile: PileRef } | null {
  for (let t = 0; t < 7; t++) {
    const column = state.tableau[t]!;
    for (let i = column.length - 1; i >= 0; i--) {
      if (inSlot(point, cardPosition(state, { index: t, kind: 'tableau' }, i)))
        return { index: i, pile: { index: t, kind: 'tableau' } };
    }
  }
  if (state.waste.length > 0
    && inSlot(point, slotPosition({ index: 0, kind: 'waste' }))) {
    return { index: state.waste.length - 1, pile: { index: 0, kind: 'waste' } };
  }
  for (let f = 0; f < 4; f++) {
    const pile = state.foundations[f]!;
    if (pile.length > 0 && inSlot(point, slotPosition({ index: f, kind: 'foundation' })))
      return { index: pile.length - 1, pile: { index: f, kind: 'foundation' } };
  }
  return null;
}

function dropTarget(
  state: GameState,
  center: { x: number; y: number },
  drag: Drag,
): PileRef | null {
  if (drag.cards.length === 1) {
    for (let f = 0; f < 4; f++) {
      const pileRef: PileRef = { index: f, kind: 'foundation' };
      if (inSlot(center, slotPosition(pileRef))
        && canDropOnFoundation(drag.cards[0]!, state.foundations[f]!)) {
        return pileRef;
      }
    }
  }
  for (let t = 0; t < 7; t++) {
    if (t === drag.from.index && drag.from.kind === 'tableau')
      continue;
    const slot = slotPosition({ index: t, kind: 'tableau' });
    const column = state.tableau[t]!;
    const bottom = column.length === 0
      ? slot.y + CARD_H
      : cardPosition(state, { index: t, kind: 'tableau' }, column.length - 1).y + CARD_H;
    const inColumn = center.x >= slot.x && center.x <= slot.x + CARD_W
      && center.y >= slot.y && center.y <= bottom + 40;
    if (inColumn && canDropOnTableau(drag.cards[0]!, column))
      return { index: t, kind: 'tableau' };
  }
  return null;
}

function flipExposed(from: PileRef, state: GameState): void {
  if (from.kind !== 'tableau')
    return;
  const top = state.tableau[from.index]!.at(-1);
  if (top && !top.faceUp)
    top.faceUp = true;
}
