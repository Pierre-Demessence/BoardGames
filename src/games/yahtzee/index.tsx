/**
 * Yahtzee (solo) — Preact game component.
 *
 * The rules live in `rules.ts`, the dice geometry and drawing in `view.ts` and
 * the scorecard in `scorecard.tsx`. This component wires them to the session and
 * the canvas hook, and plays the roll's tumble, which is view-only: the rules
 * already hold the rolled values while the dice spin.
 */

import type { Tween } from '@pierre/ecs/modules/tween';

import type { GameProps, Session, Size } from '../../core';
import type { DieValue } from '../../kits/dice';
import type { Box, YahtzeeMove, YahtzeeState } from './rules';
import type { DieTumble, YahtzeeLayout } from './view';

import { easeOutCubic } from '@pierre/ecs/modules/easing';
import { makeTween, tickTween, tweenDone } from '@pierre/ecs/modules/tween';
import { useRef, useState } from 'preact/hooks';

import { createSession, frameStyles, GameFrame, useCanvasGame } from '../../core';
import { createDiceWorld, DIE_FACES, playDiceSfx, syncDiceSprites } from '../../kits/dice';
import { DICE_COUNT, LOWER_BOXES, MAX_ROLLS, UPPER_BOXES, yahtzeeRules } from './rules';
import { Scorecard } from './scorecard';
import { dieAt, drawTable, placements, yahtzeeLayout } from './view';

const TURNS = UPPER_BOXES.length + LOWER_BOXES.length;
const TUMBLE_MS = 500;
/** Turns a tumbling die makes before it settles. */
const TUMBLE_SPINS = 2;
/** How far a tumbling die hops, in die sizes. */
const TUMBLE_HOP = 0.4;
/** How many faces a tumbling die flashes while its tween runs. */
const TUMBLE_FACE_CHANGES = 14;

interface Tumble {
  /** The dice that were rolled. */
  indices: number[];
  /** Time of the last frame in milliseconds; `null` until the first one. */
  lastFrame: number | null;
  tween: Tween;
}

/** Everything the handlers share; mutable, so it never triggers a render. */
interface Runtime {
  board: ReturnType<typeof createDiceWorld>;
  layout: YahtzeeLayout | null;
  session: Session<YahtzeeState, YahtzeeMove>;
  tumble: Tumble | null;
}

function createRuntime(): Runtime {
  return {
    board: createDiceWorld(DICE_COUNT),
    layout: null,
    tumble: null,
    session: createSession(yahtzeeRules, {
      options: undefined,
      undoable: true,
      isIrreversible: move => move.type === 'roll',
    }),
  };
}

/** Spin, hop and a passing face for each rolled die at tumble progress `eased` (0 to 1). */
function tumbleLooks(tumble: Tumble, eased: number, dieSize: number): Map<number, DieTumble> {
  const looks = new Map<number, DieTumble>();
  for (const index of tumble.indices) {
    looks.set(index, {
      angle: (1 - eased) * TUMBLE_SPINS * 2 * Math.PI * (index % 2 === 0 ? 1 : -1),
      dy: -Math.sin(eased * Math.PI) * dieSize * TUMBLE_HOP,
      value: ((Math.floor(eased * TUMBLE_FACE_CHANGES) + index * 3) % DIE_FACES + 1) as DieValue,
    });
  }
  return looks;
}

export function YahtzeeGame({ onBack, resources }: GameProps) {
  const { atlases, diceAudio } = resources;
  const runtimeRef = useRef<Runtime | null>(null);
  runtimeRef.current ??= createRuntime();
  const rt = runtimeRef.current;

  const [, setRevision] = useState(0);
  const refresh = (): void => setRevision(r => r + 1);

  const { areaRef, canvasRef, invalidate } = useCanvasGame({
    animating: () => rt.tumble !== null,
    draw(ctx, size) {
      const layout = rt.layout;
      if (!layout)
        return;
      let looks = new Map<number, DieTumble>();
      const tumble = rt.tumble;
      if (tumble) {
        const now = performance.now();
        const eased = tickTween(tumble.tween, tumble.lastFrame === null ? 0 : now - tumble.lastFrame);
        tumble.lastFrame = now;
        if (tweenDone(tumble.tween)) {
          rt.tumble = null;
          refresh();
        }
        else {
          looks = tumbleLooks(tumble, eased, layout.dieSize);
        }
      }
      syncDiceSprites(rt.board.world, rt.board.entityOf, placements(rt.session.state, layout, looks), layout.dieSize);
      drawTable(ctx, size, layout, rt.session.state, rt.board.world, atlases);
    },
    onPointerDown(point) {
      if (rt.tumble || !rt.layout)
        return;
      const index = dieAt(rt.layout, point);
      if (index !== null && rt.session.apply({ index, type: 'toggleHold' }))
        afterMove();
    },
    onResize(size: Size) {
      rt.layout = yahtzeeLayout(size);
    },
  });

  function afterMove(): void {
    refresh();
    invalidate();
  }

  function roll(): void {
    if (rt.tumble)
      return;
    const rolled = rt.session.state.dice.flatMap((die, index) => (die.held ? [] : [index]));
    if (!rt.session.apply({ type: 'roll' }))
      return;
    if (rolled.length > 0) {
      rt.tumble = { indices: rolled, lastFrame: null, tween: makeTween(TUMBLE_MS, 0, 1, easeOutCubic) };
      playDiceSfx(diceAudio, 'throw');
    }
    afterMove();
  }

  function score(box: Box): void {
    if (rt.tumble)
      return;
    if (rt.session.apply({ box, type: 'score' }))
      afterMove();
  }

  function undo(): void {
    if (!rt.tumble && rt.session.undo())
      afterMove();
  }

  function newGame(): void {
    rt.tumble = null;
    rt.session.newGame();
    afterMove();
  }

  const { rollsUsed } = rt.session.state;
  const over = rt.session.status === 'won';
  const filled = [...UPPER_BOXES, ...LOWER_BOXES].filter(box => rt.session.state.boxes[box] !== null).length;
  const rollsLeft = MAX_ROLLS - rollsUsed;

  return (
    <GameFrame
      areaRef={areaRef}
      canvasRef={canvasRef}
      newGameLabel="New game"
      side={<Scorecard onScore={score} showPreviews={rt.tumble === null} state={rt.session.state} />}
      undoDisabled={!rt.session.canUndo || rt.tumble !== null}
      onBack={onBack}
      onNewDeal={newGame}
      onUndo={undo}
    >
      <button
        class={frameStyles.btnPrimary}
        disabled={over || rollsLeft === 0 || rt.tumble !== null}
        onClick={roll}
      >
        {`Roll (${rollsLeft} left)`}
      </button>
      <span class={frameStyles.hint}>{over ? 'Game over' : `Turn ${filled + 1} / ${TURNS}`}</span>
    </GameFrame>
  );
}
