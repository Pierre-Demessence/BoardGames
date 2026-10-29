/**
 * Spider Solitaire (1-suit) — Preact game component.
 *
 * The rules live in `rules.ts`, the geometry and drawing in `view.ts`. This
 * component wires them to the session, the canvas hook and the engine's
 * `DragDrop`, and keeps the hint text in the control bar.
 */

import type { DragSession } from '@pierre/ecs/modules/drag-drop';

import type { GameProps, Point, Session, Size } from '../../core';
import type { Card, TableLayout } from '../../kits/cards';
import type { SpiderMove, SpiderState } from './rules';
import type { DropZone } from './view';

import { DragDrop } from '@pierre/ecs/modules/drag-drop';
import { useEffect, useRef, useState } from 'preact/hooks';

import { createSession, GameFrame, useCanvasGame } from '../../core';
import frameStyles from '../../core/game-frame.module.css';
import { createCardWorld, dragProbe, playCardSfx, rectContains, syncCardSprites } from '../../kits/cards';
import { canDragRun, dealBlock, RUNS_TO_WIN, spiderRules } from './rules';
import { cardPoint, drawTable, dropZones, pickCard, placements, spiderLayout, stockRect } from './view';

const CARD_COUNT = 104;
/** Pointer travel (CSS px) before a press becomes a drag, so a click is not one. */
const DRAG_THRESHOLD = 4;

const HINT_DEFAULT = 'Click the stock to deal · drag cards to build descending runs';
const HINT_WON = 'You win! Press "New deal" to play again.';
const HINT_EMPTY_COLUMN = 'Fill every empty column before dealing from the stock.';
const HINT_EMPTY_STOCK = 'The stock is empty: no cards left to deal.';

interface DragPayload {
  cards: Card[];
  column: number;
  index: number;
}

/** Everything the handlers share; mutable, so it never triggers a render. */
interface Runtime {
  board: ReturnType<typeof createCardWorld>;
  drag: DragDrop<DragPayload, DropZone>;
  layout: TableLayout | null;
  session: Session<SpiderState, SpiderMove>;
}

function createRuntime(): Runtime {
  const session = createSession(spiderRules, { options: undefined, undoable: true });
  const runtime: Runtime = {
    board: createCardWorld(CARD_COUNT),
    layout: null,
    session,
    drag: new DragDrop<DragPayload, DropZone>({
      threshold: DRAG_THRESHOLD,
      contains: (zone, point) => rectContains(zone.rect, point),
      targets: () => (runtime.layout ? dropZones(runtime.session.state, runtime.layout) : []),
      accepts: (zone, payload) => spiderRules.apply(
        runtime.session.state,
        { from: payload.column, index: payload.index, to: zone.column, type: 'move' },
        Date.now(),
      ) !== null,
      probe: (drag: DragSession<DragPayload>) => dragProbe(
        { cards: drag.payload.cards, position: drag.position },
        runtime.layout!,
      ),
    }),
  };
  return runtime;
}

function setText(element: HTMLElement | null, text: string): void {
  if (element && element.textContent !== text)
    element.textContent = text;
}

export function SpiderGame({ onBack, resources }: GameProps) {
  const { atlases, audio } = resources;
  const runtimeRef = useRef<Runtime | null>(null);
  runtimeRef.current ??= createRuntime();
  const rt = runtimeRef.current;

  const hintRef = useRef<HTMLSpanElement>(null);
  const [, setRevision] = useState(0);
  const refresh = (): void => setRevision(r => r + 1);

  const { areaRef, canvasRef, invalidate } = useCanvasGame({
    onPointerDown: point => onPointerDown(point),
    onPointerUp: point => onPointerUp(point),
    draw(ctx, size) {
      const layout = rt.layout;
      if (!layout)
        return;
      const dragging = rt.drag.session;
      const cards = placements(
        rt.session.state,
        layout,
        dragging?.started ? { cards: dragging.payload.cards, position: dragging.position } : null,
      );
      syncCardSprites(rt.board.world, rt.board.entityOf, cards, layout);
      drawTable(ctx, size, layout, rt.session.state, rt.board.world, atlases, rt.session.status === 'won');
    },
    onPointerCancel() {
      rt.drag.cancel();
      invalidate();
    },
    onPointerMove(point) {
      rt.drag.move(point);
      if (rt.drag.session?.started)
        invalidate();
    },
    onResize(size: Size) {
      rt.layout = spiderLayout(size);
    },
  });

  function setHint(text: string): void {
    setText(hintRef.current, text);
  }

  /** What follows every applied move: the hint, the Undo button and a new frame. */
  function afterMove(completedBefore: number): void {
    const { completed } = rt.session.state;
    if (rt.session.status === 'won')
      setHint(HINT_WON);
    else if (completed > completedBefore)
      setHint(`Completed ${completed}/${RUNS_TO_WIN} runs!`);
    else
      setHint(HINT_DEFAULT);
    refresh();
    invalidate();
  }

  function newDeal(): void {
    rt.session.newGame();
    rt.board = createCardWorld(CARD_COUNT);
    rt.drag.cancel();
    setHint(HINT_DEFAULT);
    refresh();
    invalidate();
  }

  function undo(): void {
    if (!rt.session.undo())
      return;
    rt.drag.cancel();
    playCardSfx(audio, 'slide');
    setHint(HINT_DEFAULT);
    refresh();
    invalidate();
  }

  function onPointerDown(point: Point): void {
    const layout = rt.layout;
    if (!layout || rt.session.status !== 'playing')
      return;
    const state = rt.session.state;
    if (rectContains(stockRect(layout), point)) {
      const completedBefore = state.completed;
      if (rt.session.apply({ type: 'deal' })) {
        playCardSfx(audio, 'slide');
        afterMove(completedBefore);
      }
      else {
        setHint(dealBlock(state) === 'empty-column' ? HINT_EMPTY_COLUMN : HINT_EMPTY_STOCK);
      }
      return;
    }
    const hit = pickCard(state, layout, point);
    const column = hit ? state.tableau[hit.column] : undefined;
    if (!hit || !column || !canDragRun(column, hit.index))
      return;
    const origin = cardPoint(state, layout, hit.column, hit.index);
    rt.drag.begin({ cards: column.slice(hit.index), column: hit.column, index: hit.index }, point, origin);
  }

  function onPointerUp(point: Point): void {
    const drop = rt.drag.end(point);
    if (!drop)
      return;
    const completedBefore = rt.session.state.completed;
    const applied = drop.target !== null && rt.session.apply({
      from: drop.payload.column,
      index: drop.payload.index,
      to: drop.target.column,
      type: 'move',
    });
    if (applied) {
      playCardSfx(audio, 'place');
      afterMove(completedBefore);
    }
    else {
      playCardSfx(audio, 'slide');
      invalidate();
    }
  }

  useEffect(() => {
    setHint(HINT_DEFAULT);
  }, []);

  return (
    <GameFrame
      areaRef={areaRef}
      canvasRef={canvasRef}
      onBack={onBack}
      onNewDeal={newDeal}
      onUndo={undo}
      undoDisabled={!rt.session.canUndo}
    >
      <span ref={hintRef} class={frameStyles.hint} />
    </GameFrame>
  );
}
