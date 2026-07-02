/**
 * Spider Solitaire (1-suit) — Preact game component.
 *
 * Drag-and-drop + stock dealing on a canvas with ECS rendering.
 * The shell UI (buttons, hint text) is rendered declaratively;
 * high-frequency hint updates use a ref.
 */

import type { EntityId } from '@pierre/ecs';

import type { GameResources } from '../../shared';
import type { CardLayout } from '../../shared/layout';
import type { Card, GameState } from './game';
import type { DragOverride } from './render';

import { projectPointer } from '@pierre/ecs/modules/input';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import {
  BAR_HEIGHT,

  GameShell,
  makeWorld,
  playCardSfx,
} from '../../shared';
import shellStyles from '../../shared/shell.module.css';
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

// ---------- types ----------

interface Drag {
  cards: Card[];
  fromCol: number;
  fromIndex: number;
  grabX: number;
  grabY: number;
  pointerX: number;
  pointerY: number;
}

// ---------- helpers (pure, outside component) ----------

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

// ---------- component ----------

export interface SpiderGameProps {
  resources: GameResources;
  onBack: () => void;
}

export function SpiderGame({ onBack, resources }: SpiderGameProps) {
  const { atlases, audio, audioCtx } = resources;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutable game state
  const worldRef = useRef(makeWorld());
  const stateRef = useRef<GameState | null>(null);
  const dragRef = useRef<Drag | null>(null);

  // Refs for imperative text updates
  const hintElRef = useRef<HTMLSpanElement | null>(null);

  const [layout, setLayout] = useState<CardLayout | null>(null);

  // Measure viewport and compute layout on mount
  useEffect(() => {
    setLayout(initLayout(window.innerWidth, window.innerHeight - BAR_HEIGHT));
  }, []);

  // ---- helpers ----

  const playSfx = useCallback((kind: 'place' | 'slide') => {
    playCardSfx(audio, kind);
  }, [audio]);

  const finishMove = useCallback((s: GameState) => {
    if (isWon(s)) {
      s.won = true;
      if (hintElRef.current)
        hintElRef.current.textContent = 'You win! Press "New deal" to play again.';
    }
  }, []);

  const newDeal = useCallback(() => {
    const world = makeWorld();
    worldRef.current = world;
    const state = dealNewGame((): EntityId => world.createEntity(), layout!);
    stateRef.current = state;
    dragRef.current = null;
    if (hintElRef.current)
      hintElRef.current.textContent = 'Click the stock to deal · drag cards to build descending runs';
  }, [layout]);

  const resolveDrop = useCallback((
    s: GameState,
    d: Drag,
    sfx: (kind: 'place' | 'slide') => void,
  ) => {
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
    for (const id of removedIds) worldRef.current.destroyEntity(id);
    s.completed += count;

    sfx('place');

    if (count > 0 && hintElRef.current)
      hintElRef.current.textContent = `Completed ${s.completed}/8 runs!`;

    finishMove(s);
  }, [finishMove]);

  // ---- pointer events ----

  const toWorld = useCallback((event: PointerEvent | MouseEvent) => {
    return projectPointer(event, canvasRef.current!);
  }, []);

  const onPointerDown = useCallback((event: PointerEvent) => {
    const state = stateRef.current;
    if (!state || state.won)
      return;
    void audioCtx.resume();
    const point = toWorld(event);

    // Stock click
    const stockPos = stockSlotPosition(state.layout);
    const sdw = Math.round(state.layout.cardW * STOCK_DECK_W_RATIO);
    const sdh = Math.round(state.layout.cardH * STOCK_DECK_H_RATIO);
    if (point.x >= stockPos.x && point.x <= stockPos.x + sdw
      && point.y >= stockPos.y && point.y <= stockPos.y + sdh) {
      if (state.stock.length >= COLUMNS && dealFromStock(state)) {
        playSfx('slide');
        const { count, removedIds } = removeCompletedRuns(state);
        for (const id of removedIds) worldRef.current.destroyEntity(id);
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
    dragRef.current = {
      cards,
      fromCol: hit.col,
      fromIndex: hit.index,
      grabX: point.x - origin.x,
      grabY: point.y - origin.y,
      pointerX: point.x,
      pointerY: point.y,
    };
    canvasRef.current!.setPointerCapture(event.pointerId);
  }, [audioCtx, toWorld, playSfx, finishMove]);

  const onPointerMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag)
      return;
    const point = toWorld(event);
    drag.pointerX = point.x;
    drag.pointerY = point.y;
  }, [toWorld]);

  const onPointerUp = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    const state = stateRef.current;
    if (!drag || !state)
      return;
    if (canvasRef.current!.hasPointerCapture(event.pointerId))
      canvasRef.current!.releasePointerCapture(event.pointerId);
    resolveDrop(state, drag, playSfx);
    dragRef.current = null;
  }, [resolveDrop, playSfx]);

  // ---- rAF render loop ----

  useEffect(() => {
    if (!layout || !canvasRef.current)
      return;
    const ctx2d = canvasRef.current.getContext('2d')!;

    let rafId = 0;
    const loop = (): void => {
      const state = stateRef.current;
      if (!state) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      const drag = dragRef.current;
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

      syncLayout(worldRef.current, state, dragOverride);
      renderFrame(ctx2d, worldRef.current, atlases, state);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [layout, atlases]);

  // ---- pointer event binding ----

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas)
      return;
    const ctrl = new AbortController();
    const sig = ctrl.signal;
    canvas.addEventListener('pointerdown', onPointerDown, { signal: sig });
    canvas.addEventListener('pointermove', onPointerMove, { signal: sig });
    canvas.addEventListener('pointerup', onPointerUp, { signal: sig });
    canvas.addEventListener('pointercancel', onPointerUp, { signal: sig });
    return () => ctrl.abort();
  }, [layout, onPointerDown, onPointerMove, onPointerUp]);

  // Initial deal once layout is known
  useEffect(() => {
    if (layout)
      newDeal();
  }, [layout]);

  if (!layout)
    return null;

  return (
    <GameShell
      canvasRef={canvasRef}
      canvasW={layout.canvasW}
      canvasH={layout.canvasH}
      onBack={onBack}
      onNewDeal={newDeal}
    >
      <span ref={hintElRef} class={shellStyles.hint} />
    </GameShell>
  );
}
