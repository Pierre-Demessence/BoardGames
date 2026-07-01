/**
 * Solitaire (Klondike, draw-1) — Windows-style with scoring, auto-win, victory animation.
 */

import type { EntityId } from '@pierre/ecs';
import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { CardAudio } from '../../shared';
import type { Card, GameState, PileRef } from './game';

import { EcsWorld } from '@pierre/ecs';
import { projectPointer } from '@pierre/ecs/modules/input';
import { RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';

import { BAR_HEIGHT, playCardSfx } from '../../shared';
import {
  awardPoints,
  canDropOnFoundation,
  canDropOnTableau,
  cardPosition,
  computeTimePenalty,
  dealNewGame,
  finalScore,
  findFoundationFor,
  FLIP_POINTS,
  initLayout,
  isWon,
  movePoints,
  pileArray,
  RECYCLE_PENALTY,
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

interface VictoryCard {
  card: Card;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

function makeWorld(): EcsWorld {
  const world = new EcsWorld();
  world.registerComponent(PositionDef);
  world.registerComponent(RenderableDef);
  world.registerComponent(RenderOrderDef);
  return world;
}

export function start(container: HTMLElement, resources: GameResources, onBack: () => void): () => void {
  const containerRect = container.getBoundingClientRect();
  const layout = initLayout(containerRect.width, containerRect.height - BAR_HEIGHT);

  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.width = layout.canvasW;
  canvas.height = layout.canvasH;
  canvas.style.cssText = `display:block;width:${layout.canvasW}px;height:${layout.canvasH}px;`
    + 'margin:0 auto;border-radius:10px;touch-action:none;cursor:pointer';
  const ctx2d = canvas.getContext('2d')!;

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:12px;align-items:center;justify-content:center;'
    + `padding:8px 10px;font:13px system-ui;color:#cde;flex-shrink:0;height:${BAR_HEIGHT}px;box-sizing:border-box`;

  const backBtn = document.createElement('button');
  backBtn.textContent = '← Games';
  backBtn.style.cssText = 'padding:4px 12px;font:inherit;font-weight:600;color:#cde;'
    + 'background:#2a5a4a;border:1px solid #3fbf8f;border-radius:6px;cursor:pointer';

  const newDealBtn = document.createElement('button');
  newDealBtn.textContent = 'New deal';
  newDealBtn.style.cssText = 'padding:4px 12px;font:inherit;font-weight:600;color:#fff;'
    + 'background:#1f6b4f;border:1px solid #3fbf8f;border-radius:6px;cursor:pointer';

  const scoreEl = document.createElement('span');
  scoreEl.style.cssText = 'font:700 14px system-ui;color:#ffe14d;min-width:80px;text-align:center';

  const timeEl = document.createElement('span');
  timeEl.style.cssText = 'font:13px system-ui;color:#aac;min-width:60px;text-align:center';

  bar.append(backBtn, newDealBtn, scoreEl, timeEl);
  container.append(bar, canvas);

  const { atlases, audio, audioCtx } = resources;
  const abort = new AbortController();

  let disposed = false;
  let world = makeWorld();
  let state: GameState | null = null;
  let drag: Drag | null = null;
  let rafId = 0;
  let lastTimeUpdate = 0;
  let autoWinQueue: { card: Card; target: number }[] = [];
  let autoWinNextTime = 0;
  let victoryCards: VictoryCard[] = [];

  const updateScoreDisplay = (): void => {
    if (!state)
      return;
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    timeEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    scoreEl.textContent = `Score: ${state.score}`;
  };

  const newDeal = (): void => {
    world = makeWorld();
    state = dealNewGame((): EntityId => world.createEntity(), layout);
    drag = null;
    autoWinQueue = [];
    victoryCards = [];
    lastTimeUpdate = Date.now();
    updateScoreDisplay();
  };

  const playSfx = (kind: 'place' | 'slide'): void => {
    playCardSfx(audio, kind);
  };

  // --- Auto-win ---

  const AUTO_WIN_DELAY = 50;

  /** Returns true if auto-win animation was started. */
  function tryAutoWin(s: GameState): boolean {
    // Only auto-win when stock is empty and all tableau cards are face-up
    if (s.stock.length > 0)
      return false;

    let allFaceUp = true;
    for (let t = 0; t < 7; t++) {
      for (const card of s.tableau[t]!) {
        if (!card.faceUp) {
          allFaceUp = false;
          break;
        }
      }
      if (!allFaceUp)
        break;
    }
    if (!allFaceUp)
      return false;

    // Build the queue by simulating on a clone
    autoWinQueue = [];
    const sim = cloneState(s);

    let changed = true;
    while (changed) {
      changed = false;
      // Try waste → foundation
      const wTop = sim.waste.at(-1);
      if (wTop) {
        const fi = findFoundationFor(sim, wTop);
        if (fi !== -1) {
          autoWinQueue.push({ card: wTop, target: fi });
          sim.waste.pop();
          sim.foundations[fi]!.push(wTop);
          changed = true;
          continue;
        }
      }
      // Try tableau → foundation
      for (let t = 0; t < 7; t++) {
        const col = sim.tableau[t]!;
        const top = col.at(-1);
        if (top) {
          const fi = findFoundationFor(sim, top);
          if (fi !== -1) {
            autoWinQueue.push({ card: top, target: fi });
            col.pop();
            sim.foundations[fi]!.push(top);
            changed = true;
            break;
          }
        }
      }
    }

    if (autoWinQueue.length === 0)
      return false;

    autoWinNextTime = performance.now() + AUTO_WIN_DELAY;
    return true;
  }

  // --- Input ---

  const toWorld = (event: PointerEvent | MouseEvent): { x: number; y: number } =>
    projectPointer(event, canvas);

  const onPointerDown = (event: PointerEvent): void => {
    if (!state || state.won || autoWinQueue.length > 0)
      return;
    void audioCtx.resume();
    const point = toWorld(event);

    if (inSlot(state, point, slotPosition(state.layout, { index: 0, kind: 'stock' }))) {
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
    if (!state || state.won || autoWinQueue.length > 0)
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
    const from: PileRef = hit.pile;
    pile.pop();
    state.foundations[target]!.push(card);
    const flipped = flipExposed(hit.pile, state);
    awardPoints(state, movePoints(from, { index: target, kind: 'foundation' }));
    if (flipped)
      awardPoints(state, FLIP_POINTS);
    playSfx('place');
    updateScoreDisplay();
    afterMove(state);
  };

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

  function afterMove(s: GameState): void {
    if (isWon(s)) {
      s.won = true;
      const bonus = finalScore(s);
      s.score = bonus;
      updateScoreDisplay();
      startVictoryAnimation();
      return;
    }
    // Try auto-win
    if (autoWinQueue.length === 0)
      tryAutoWin(s);
  }

  function startVictoryAnimation(): void {
    const s = state;
    if (!s)
      return;
    victoryCards = [];
    const { layout: lay } = s;
    for (let f = 0; f < 4; f++) {
      const pile = s.foundations[f]!;
      pile.forEach((card, i) => {
        const pos = cardPosition(s, { index: f, kind: 'foundation' }, i);
        victoryCards.push({
          card,
          vx: (Math.random() - 0.5) * lay.cardW * 0.3,
          vy: -lay.cardH * (0.2 + Math.random() * 0.3),
          x: pos.x,
          y: pos.y,
        });
      });
    }
  }

  function resolveDrop(
    s: GameState,
    d: Drag,
    sfx: (kind: 'place' | 'slide') => void,
  ): void {
    const { layout: lay } = s;
    const center = {
      x: d.pointerX - d.grabX + lay.cardW / 2,
      y: d.pointerY - d.grabY + lay.cardH / 2,
    };
    const target = dropTarget(s, center, d);
    if (!target) {
      sfx('slide');
      return;
    }

    const source = pileArray(s, d.from);
    source.splice(source.length - d.cards.length, d.cards.length);
    pileArray(s, target).push(...d.cards);
    const flipped = flipExposed(d.from, s);

    awardPoints(s, movePoints(d.from, target));
    if (flipped)
      awardPoints(s, FLIP_POINTS);
    sfx('place');
    updateScoreDisplay();
    afterMove(s);
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
      awardPoints(s, RECYCLE_PENALTY);
      updateScoreDisplay();
    }
    sfx('slide');
  }

  // --- Render loop ---

  const loop = (): void => {
    if (disposed)
      return;
    if (state) {
      const now = performance.now();

      // Update timer display every frame
      updateScoreDisplay();

      // Time penalty every 10 seconds
      if (now - lastTimeUpdate > 10000) {
        const penalty = computeTimePenalty(state);
        if (penalty < 0)
          awardPoints(state, penalty);
        lastTimeUpdate = now;
        updateScoreDisplay();
      }

      // Auto-win animation
      if (autoWinQueue.length > 0 && now >= autoWinNextTime && !state.won) {
        const { card, target } = autoWinQueue.shift()!;
        // Actually move the card in the real state
        removeCardFromPiles(state, card);
        state.foundations[target]!.push(card);
        awardPoints(state, movePoints(
          { index: 0, kind: 'waste' },
          { index: target, kind: 'foundation' },
        ));
        playSfx('place');
        updateScoreDisplay();
        if (autoWinQueue.length > 0) {
          autoWinNextTime = now + AUTO_WIN_DELAY;
        }
        else if (isWon(state)) {
          state.won = true;
          const bonus = finalScore(state);
          state.score = bonus;
          updateScoreDisplay();
          startVictoryAnimation();
        }
      }

      // Victory animation
      if (victoryCards.length > 0 && state) {
        const positions = world.getStore(PositionDef);
        const { layout: lay } = state;

        for (const vc of victoryCards) {
          vc.vy += lay.cardH * 0.015; // gravity
          vc.x += vc.vx;
          vc.y += vc.vy;

          // Bounce off bottom
          if (vc.y > lay.canvasH - lay.cardH) {
            vc.y = lay.canvasH - lay.cardH;
            vc.vy *= -0.5;
            if (Math.abs(vc.vy) < 1)
              vc.vy = 0;
          }
          // Bounce off sides
          if (vc.x < 0) {
            vc.x = 0;
            vc.vx *= -0.5;
          }
          if (vc.x > lay.canvasW - lay.cardW) {
            vc.x = lay.canvasW - lay.cardW;
            vc.vx *= -0.5;
          }

          positions.set(vc.card.id, { x: vc.x, y: vc.y });
        }

        // Bump render order for victory cards
        const orders = world.getStore(RenderOrderDef);
        victoryCards.forEach((vc, i) => {
          orders.set(vc.card.id, { value: 200000 + i });
        });
      }

      // Skip normal layout during victory animation
      if (victoryCards.length === 0)
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

function cloneState(s: GameState): GameState {
  return {
    foundations: s.foundations.map(p => [...p]),
    layout: s.layout,
    score: s.score,
    startTime: s.startTime,
    stock: [...s.stock],
    tableau: s.tableau.map(p => [...p]),
    waste: [...s.waste],
    won: s.won,
  };
}

function removeCardFromPiles(state: GameState, card: Card): void {
  // Check waste
  const wIdx = state.waste.findIndex(c => c.id === card.id);
  if (wIdx !== -1) {
    state.waste.splice(wIdx, 1);
    return;
  }
  // Check tableau
  for (let t = 0; t < 7; t++) {
    const col = state.tableau[t]!;
    const idx = col.findIndex(c => c.id === card.id);
    if (idx !== -1) {
      col.splice(idx, 1);
      // Flip exposed
      const newTop = col.at(-1);
      if (newTop && !newTop.faceUp)
        newTop.faceUp = true;
      return;
    }
  }
}

function inSlot(state: GameState, point: { x: number; y: number }, slot: { x: number; y: number }): boolean {
  const { cardH, cardW } = state.layout;
  return point.x >= slot.x && point.x <= slot.x + cardW
    && point.y >= slot.y && point.y <= slot.y + cardH;
}

function pickCard(
  state: GameState,
  point: { x: number; y: number },
): { index: number; pile: PileRef } | null {
  for (let t = 0; t < 7; t++) {
    const column = state.tableau[t]!;
    for (let i = column.length - 1; i >= 0; i--) {
      if (inSlot(state, point, cardPosition(state, { index: t, kind: 'tableau' }, i)))
        return { index: i, pile: { index: t, kind: 'tableau' } };
    }
  }
  if (state.waste.length > 0
    && inSlot(state, point, slotPosition(state.layout, { index: 0, kind: 'waste' }))) {
    return { index: state.waste.length - 1, pile: { index: 0, kind: 'waste' } };
  }
  for (let f = 0; f < 4; f++) {
    const pile = state.foundations[f]!;
    if (pile.length > 0 && inSlot(state, point, slotPosition(state.layout, { index: f, kind: 'foundation' })))
      return { index: pile.length - 1, pile: { index: f, kind: 'foundation' } };
  }
  return null;
}

function dropTarget(
  state: GameState,
  center: { x: number; y: number },
  drag: Drag,
): PileRef | null {
  const { layout } = state;
  const { cardH, cardW } = layout;
  if (drag.cards.length === 1) {
    for (let f = 0; f < 4; f++) {
      const pileRef: PileRef = { index: f, kind: 'foundation' };
      if (inSlot(state, center, slotPosition(layout, pileRef))
        && canDropOnFoundation(drag.cards[0]!, state.foundations[f]!)) {
        return pileRef;
      }
    }
  }
  for (let t = 0; t < 7; t++) {
    if (t === drag.from.index && drag.from.kind === 'tableau')
      continue;
    const slot = slotPosition(layout, { index: t, kind: 'tableau' });
    const column = state.tableau[t]!;
    const bottom = column.length === 0
      ? slot.y + cardH
      : cardPosition(state, { index: t, kind: 'tableau' }, column.length - 1).y + cardH;
    const inColumn = center.x >= slot.x && center.x <= slot.x + cardW
      && center.y >= slot.y && center.y <= bottom + cardH * 0.4;
    if (inColumn && canDropOnTableau(drag.cards[0]!, column))
      return { index: t, kind: 'tableau' };
  }
  return null;
}

/** Flip exposed top card of a tableau pile. Returns true if a card was flipped. */
function flipExposed(from: PileRef, state: GameState): boolean {
  if (from.kind !== 'tableau')
    return false;
  const top = state.tableau[from.index]!.at(-1);
  if (top && !top.faceUp) {
    top.faceUp = true;
    return true;
  }
  return false;
}
