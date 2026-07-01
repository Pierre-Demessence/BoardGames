/**
 * Spider Solitaire (1-suit) — game entry point with dynamic layout.
 */

import type { EntityId } from '@pierre/ecs';

import type { GameResources } from '../../shared';
import type { Card, GameState } from './game';
import type { DragOverride } from './render';

import { projectPointer } from '@pierre/ecs/modules/input';

import { BAR_HEIGHT, createGameShell, makeWorld, playCardSfx } from '../../shared';
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

export function start(container: HTMLElement, resources: GameResources, onBack: () => void): () => void {
  const containerRect = container.getBoundingClientRect();
  const layout = initLayout(containerRect.width, containerRect.height - BAR_HEIGHT);

  const { atlases, audio, audioCtx } = resources;

  let world = makeWorld();
  let state: GameState | null = null;
  let drag: Drag | null = null;

  const newDeal = (): void => {
    world = makeWorld();
    state = dealNewGame((): EntityId => world.createEntity(), layout);
    drag = null;
    hint.textContent = 'Click the stock to deal · drag cards to build descending runs';
  };

  const shell = createGameShell(container, layout.canvasW, layout.canvasH, onBack, newDeal);

  const hint = document.createElement('span');
  hint.textContent = '';
  shell.addElement(hint);

  const playSfx = (kind: 'place' | 'slide'): void => {
    playCardSfx(audio, kind);
  };

  // --- Input ---

  const { canvas, ctx2d, signal } = shell;

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

  canvas.addEventListener('pointerdown', onPointerDown, { signal });
  canvas.addEventListener('pointermove', onPointerMove, { signal });
  canvas.addEventListener('pointerup', onPointerUp, { signal });
  canvas.addEventListener('pointercancel', onPointerUp, { signal });

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

  shell.startLoop(() => {
    if (!state)
      return;
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
  });

  newDeal();

  return () => shell.dispose();
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
