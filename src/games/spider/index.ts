/**
 * Spider Solitaire (1-suit) — game entry point with dynamic layout.
 */

import type { EntityId } from '@pierre/ecs';

import type { GameResources } from '../solitaire';
import type { Card, GameState } from './game';
import type { DragOverride } from './render';

import { EcsWorld } from '@pierre/ecs';
import { projectPointer } from '@pierre/ecs/modules/input';
import { RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';

import { BAR_HEIGHT, playCardSfx } from '../../shared';
import {
  canDragRun,
  canDropOnColumn,
  cardPosition,
  COLUMNS,
  columnSlotPosition,
  dealFromStock,
  dealNewGame,
  initLayout,
  isWon,
  removeCompletedRuns,
  STOCK_DECK_H_RATIO,
  STOCK_DECK_W_RATIO,
  stockSlotPosition,
} from './game';
import { renderFrame, syncLayout } from './render';

interface Drag {
  cards: Card[];
  fromCol: number;
  fromIndex: number;
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
    state = dealNewGame((): EntityId => world.createEntity(), layout);
    drag = null;
    hint.textContent = 'Click the stock to deal · drag cards to build descending runs';
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

    const stockPos = stockSlotPosition(state.layout);
    const sdw = Math.round(state.layout.cardW * STOCK_DECK_W_RATIO);
    const sdh = Math.round(state.layout.cardH * STOCK_DECK_H_RATIO);
    if (point.x >= stockPos.x && point.x <= stockPos.x + sdw
      && point.y >= stockPos.y && point.y <= stockPos.y + sdh) {
      if (state.stock.length >= COLUMNS && dealFromStock(state)) {
        playSfx('slide');
        const { count, removedIds } = removeCompletedRuns(state);
        for (const id of removedIds) world.destroyEntity(id);
        state.completed += count;
        finishMove(state);
      }
      return;
    }

    const hit = pickCard(state, point);
    if (!hit)
      return;
    const column = state.tableau[hit.col]!;
    if (!canDragRun(column, hit.index))
      return;

    const cards = column.slice(hit.index);
    const origin = cardPosition(state, hit.col, hit.index);
    drag = {
      cards,
      fromCol: hit.col,
      fromIndex: hit.index,
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
    const { layout: lay } = s;
    const center = {
      x: d.pointerX - d.grabX + lay.cardW / 2,
      y: d.pointerY - d.grabY + lay.cardH / 2,
    };
    const targetCol = findTargetColumn(s, center, d);

    if (targetCol === null || targetCol === d.fromCol) {
      sfx('slide');
      return;
    }

    const source = s.tableau[d.fromCol]!;
    source.splice(d.fromIndex, d.cards.length);
    s.tableau[targetCol]!.push(...d.cards);

    const newTop = source.at(-1);
    if (newTop && !newTop.faceUp)
      newTop.faceUp = true;

    const { count, removedIds } = removeCompletedRuns(s);
    for (const id of removedIds) world.destroyEntity(id);
    s.completed += count;

    sfx('place');

    if (count > 0)
      hint.textContent = `Completed ${s.completed}/8 runs!`;

    finishMove(s);
  }

  // --- Render loop ---

  const loop = (): void => {
    if (disposed)
      return;
    if (state) {
      const dragOverride: DragOverride | null = drag
        ? {
            cards: drag.cards,
            fromCol: drag.fromCol,
            fromIndex: drag.fromIndex,
            grabX: drag.grabX,
            grabY: drag.grabY,
            pointerX: drag.pointerX,
            pointerY: drag.pointerY,
          }
        : null;
      syncLayout(world, state, dragOverride);
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

function inSlot(state: GameState, point: { x: number; y: number }, slot: { x: number; y: number }): boolean {
  const { cardH, cardW } = state.layout;
  return point.x >= slot.x && point.x <= slot.x + cardW
    && point.y >= slot.y && point.y <= slot.y + cardH;
}

function pickCard(
  state: GameState,
  point: { x: number; y: number },
): { col: number; index: number } | null {
  for (let col = COLUMNS - 1; col >= 0; col--) {
    const column = state.tableau[col]!;
    for (let i = column.length - 1; i >= 0; i--) {
      if (inSlot(state, point, cardPosition(state, col, i)))
        return { col, index: i };
    }
  }
  return null;
}

function findTargetColumn(
  state: GameState,
  center: { x: number; y: number },
  drag: Drag,
): number | null {
  const { layout } = state;
  const { cardH, cardW } = layout;
  for (let col = COLUMNS - 1; col >= 0; col--) {
    if (col === drag.fromCol)
      continue;
    const column = state.tableau[col]!;
    const slot = columnSlotPosition(layout, col);
    const bottom = column.length === 0
      ? slot.y + cardH
      : cardPosition(state, col, column.length - 1).y + cardH;

    const inCol = center.x >= slot.x && center.x <= slot.x + cardW
      && center.y >= slot.y && center.y <= bottom + cardH * 0.4;

    if (inCol && canDropOnColumn(drag.cards[0]!, column))
      return col;
  }
  return null;
}
