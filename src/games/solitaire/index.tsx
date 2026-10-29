/**
 * Solitaire (Klondike, draw-1) — Preact game component.
 *
 * The rules live in `rules.ts`, the geometry and drawing in `view.ts`. This
 * component wires them to the session, the canvas hook, the engine's
 * `DragDrop`, the automatic finish and the victory animation.
 */

import type { DragSession } from '@pierre/ecs/modules/drag-drop';

import type { GameProps, Point, Session, Size } from '../../core';
import type { Card, TableLayout } from '../../kits/cards';
import type { PileRef, SolitaireMove, SolitaireState } from './rules';
import type { DropZone, VictoryCard } from './view';

import { DragDrop } from '@pierre/ecs/modules/drag-drop';
import { useEffect, useRef, useState } from 'preact/hooks';

import { createSession, GameFrame, useCanvasGame } from '../../core';
import frameStyles from '../../core/game-frame.module.css';
import { createCardWorld, syncCardSprites } from '../../kits/cards';
import { playCardSfx } from '../../shared';
import {
  displayScore,
  elapsedMs,
  foundationTarget,
  nextAutoFinishMove,
  pileOf,
  solitaireRules,
} from './rules';
import {
  cardPoint,
  dragProbe,
  drawTable,
  dropZones,
  isOverStock,
  pickCard,
  placements,
  rectContains,
  solitaireLayout,
  startVictory,
  stepVictory,
  victoryMoving,
  victoryPlacements,
} from './view';

const CARD_COUNT = 52;
/** Delay between the cards of the automatic finish (ms). */
const AUTO_FINISH_DELAY = 50;
/** How often the score and clock text are refreshed (ms). */
const HUD_INTERVAL = 250;
/** Pointer travel (CSS px) before a press becomes a drag, so a click or double-click is not one. */
const DRAG_THRESHOLD = 4;

interface DragPayload {
  cards: Card[];
  from: PileRef;
  index: number;
}

/** Everything the handlers share; mutable, so it never triggers a render. */
interface Runtime {
  autoFinish: number | null;
  board: ReturnType<typeof createCardWorld>;
  drag: DragDrop<DragPayload, DropZone>;
  layout: TableLayout | null;
  session: Session<SolitaireState, SolitaireMove>;
  size: Size | null;
  victory: VictoryCard[];
}

function createRuntime(): Runtime {
  const session = createSession(solitaireRules, { options: undefined, undoable: true });
  const runtime: Runtime = {
    autoFinish: null,
    board: createCardWorld(CARD_COUNT),
    layout: null,
    session,
    size: null,
    victory: [],
    drag: new DragDrop<DragPayload, DropZone>({
      threshold: DRAG_THRESHOLD,
      contains: (zone, point) => rectContains(zone.rect, point),
      targets: () => (runtime.layout ? dropZones(runtime.session.state, runtime.layout) : []),
      accepts: (zone, payload) => solitaireRules.apply(
        runtime.session.state,
        { from: payload.from, index: payload.index, to: zone.pile, type: 'move' },
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

function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function setText(element: HTMLElement | null, text: string): void {
  if (element && element.textContent !== text)
    element.textContent = text;
}

export function SolitaireGame({ onBack, resources }: GameProps) {
  const { atlases, audio } = resources;
  const runtimeRef = useRef<Runtime | null>(null);
  runtimeRef.current ??= createRuntime();
  const rt = runtimeRef.current;

  const scoreRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const [, setRevision] = useState(0);
  const refresh = (): void => setRevision(r => r + 1);

  const { areaRef, canvasRef, invalidate } = useCanvasGame({
    onDoubleClick: point => onDoubleClick(point),
    onPointerDown: point => onPointerDown(point),
    onPointerUp: point => onPointerUp(point),
    animating: () => rt.layout !== null && rt.size !== null
      && rt.victory.length > 0 && victoryMoving(rt.victory, rt.size, rt.layout),
    draw(ctx, size) {
      const layout = rt.layout;
      if (!layout)
        return;
      const state = rt.session.state;
      let cards;
      if (rt.victory.length > 0) {
        stepVictory(rt.victory, size, layout);
        cards = victoryPlacements(rt.victory);
      }
      else {
        const dragging = rt.drag.session;
        cards = placements(
          state,
          layout,
          dragging?.started
            ? { cards: dragging.payload.cards, position: dragging.position }
            : null,
        );
      }
      syncCardSprites(rt.board.world, rt.board.entityOf, cards, layout);
      drawTable(ctx, size, layout, state, rt.board.world, atlases, rt.session.status === 'won');
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
    onResize(size) {
      rt.size = size;
      rt.layout = solitaireLayout(size);
    },
  });

  // ---- shared steps ----

  function updateHud(): void {
    const state = rt.session.state;
    const now = Date.now();
    setText(scoreRef.current, `Score: ${displayScore(state, now)}`);
    setText(timeRef.current, formatClock(elapsedMs(state, now)));
  }

  /** No input while the game is won or the automatic finish is running. */
  function inputBlocked(): boolean {
    return rt.session.status !== 'playing' || rt.autoFinish !== null;
  }

  /** What follows every applied move: score text, the win, the automatic finish, the buttons. */
  function afterMove(): void {
    updateHud();
    if (rt.session.status === 'won') {
      if (rt.layout)
        rt.victory = startVictory(rt.session.state, rt.layout);
    }
    else {
      scheduleAutoFinish();
    }
    refresh();
    invalidate();
  }

  function scheduleAutoFinish(): void {
    if (rt.autoFinish !== null || nextAutoFinishMove(rt.session.state) === null)
      return;
    rt.autoFinish = window.setTimeout(stepAutoFinish, AUTO_FINISH_DELAY);
  }

  function stepAutoFinish(): void {
    rt.autoFinish = null;
    const move = nextAutoFinishMove(rt.session.state);
    if (move && rt.session.apply(move)) {
      playCardSfx(audio, 'place');
      afterMove();
    }
    else {
      refresh();
    }
  }

  function cancelAutoFinish(): void {
    if (rt.autoFinish !== null)
      window.clearTimeout(rt.autoFinish);
    rt.autoFinish = null;
  }

  // ---- buttons ----

  function newDeal(): void {
    cancelAutoFinish();
    rt.session.newGame();
    rt.board = createCardWorld(CARD_COUNT);
    rt.victory = [];
    rt.drag.cancel();
    updateHud();
    refresh();
    invalidate();
  }

  function undoAllowed(): boolean {
    return rt.session.canUndo && !inputBlocked();
  }

  function undo(): void {
    if (!undoAllowed() || !rt.session.undo())
      return;
    rt.drag.cancel();
    playCardSfx(audio, 'slide');
    updateHud();
    refresh();
    invalidate();
  }

  // ---- pointer ----

  function onPointerDown(point: Point): void {
    const layout = rt.layout;
    if (!layout || inputBlocked())
      return;
    const state = rt.session.state;
    if (isOverStock(layout, point)) {
      if (rt.session.apply({ type: 'draw' })) {
        playCardSfx(audio, 'slide');
        afterMove();
      }
      return;
    }
    const hit = pickCard(state, layout, point);
    const pile = hit ? pileOf(state, hit.pile) : undefined;
    if (!hit || !pile || !pile[hit.index]!.faceUp)
      return;
    const origin = cardPoint(state, layout, hit.pile, hit.index);
    rt.drag.begin({ cards: pile.slice(hit.index), from: hit.pile, index: hit.index }, point, origin);
  }

  function onPointerUp(point: Point): void {
    const drop = rt.drag.end(point);
    if (!drop)
      return;
    const applied = drop.target !== null && rt.session.apply({
      from: drop.payload.from,
      index: drop.payload.index,
      to: drop.target.pile,
      type: 'move',
    });
    if (applied) {
      playCardSfx(audio, 'place');
      afterMove();
    }
    else {
      playCardSfx(audio, 'slide');
      invalidate();
    }
  }

  function onDoubleClick(point: Point): void {
    const layout = rt.layout;
    if (!layout || inputBlocked())
      return;
    const state = rt.session.state;
    const hit = pickCard(state, layout, point);
    if (!hit || hit.pile.kind === 'foundation')
      return;
    const pile = pileOf(state, hit.pile);
    const card = pile?.[hit.index];
    if (!pile || !card?.faceUp || hit.index !== pile.length - 1)
      return;
    const target = foundationTarget(state, card);
    if (target === null)
      return;
    const move: SolitaireMove = {
      from: hit.pile,
      index: hit.index,
      to: { index: target, kind: 'foundation' },
      type: 'move',
    };
    if (rt.session.apply(move)) {
      playCardSfx(audio, 'place');
      afterMove();
    }
  }

  useEffect(() => {
    updateHud();
    const id = window.setInterval(updateHud, HUD_INTERVAL);
    return () => {
      window.clearInterval(id);
      cancelAutoFinish();
    };
  }, []);

  return (
    <GameFrame
      areaRef={areaRef}
      canvasRef={canvasRef}
      onBack={onBack}
      onNewDeal={newDeal}
      onUndo={undo}
      undoDisabled={!undoAllowed()}
    >
      <span ref={scoreRef} class={frameStyles.score}>Score: 0</span>
      <span ref={timeRef} class={frameStyles.timer}>0:00</span>
    </GameFrame>
  );
}
