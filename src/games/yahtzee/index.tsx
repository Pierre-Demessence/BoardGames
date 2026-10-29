/**
 * Yahtzee (one to four seats) — Preact game component.
 *
 * The rules live in `rules.ts`, the computer player in `computer.ts`, the dice
 * geometry and drawing in `view.ts` and the scorecard in `scorecard.tsx`. This
 * component wires them to the session, the seat picker, the computer's pacing and
 * the canvas hook, and plays the roll's tumble, which is view-only: the rules
 * already hold the rolled values while the dice spin.
 */

import type { Tween } from '@pierre/ecs/modules/tween';

import type { ComputerTurns, GameProps, SeatKind, Session, Size } from '../../core';
import type { DieValue } from '../../kits/dice';
import type { Box, YahtzeeMove, YahtzeeOptions, YahtzeeState } from './rules';
import type { DieTumble, YahtzeeLayout } from './view';

import { easeOutCubic } from '@pierre/ecs/modules/easing';
import { makeTween, tickTween, tweenDone } from '@pierre/ecs/modules/tween';
import { useEffect, useRef, useState } from 'preact/hooks';

import {
  createComputerTurns,
  createSession,
  frameStyles,
  GameFrame,
  isComputerTurn,
  seatName,
  SeatPicker,
  seatToPlay,
  useCanvasGame,
} from '../../core';
import { createDiceWorld, DIE_FACES, playDiceSfx, syncDiceSprites } from '../../kits/dice';
import { computerMove } from './computer';
import { DICE_COUNT, LOWER_BOXES, MAX_ROLLS, MAX_SEATS, totals, UPPER_BOXES, yahtzeeRules } from './rules';
import { Scorecard } from './scorecard';
import { dieAt, drawTable, placements, resultText, yahtzeeLayout } from './view';

const TURNS = UPPER_BOXES.length + LOWER_BOXES.length;
const TUMBLE_MS = 500;
/** Pause before each computer action; longer than the tumble, so a roll settles before the score. */
const COMPUTER_DELAY = 800;
/** Side panel width for one seat is the default; each seat beyond it adds a column. */
const SIDE_BASE = 140;
const SIDE_COLUMN = 64;
const SIDE_MIN = 260;
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

/** The seats of the last game in this page's lifetime, offered again by the picker. Not saved. */
let lastSeats: SeatKind[] = ['human'];

/** Everything the handlers share; mutable, so it never triggers a render. */
interface Runtime {
  board: ReturnType<typeof createDiceWorld>;
  layout: YahtzeeLayout | null;
  session: Session<YahtzeeState, YahtzeeMove, YahtzeeOptions>;
  tumble: Tumble | null;
  turns: ComputerTurns;
  /** Reacts to a computer move; replaced on every render so it sees the current handlers. */
  handleComputerMove: (move: YahtzeeMove) => void;
}

function createRuntime(): Runtime {
  const session = createSession(yahtzeeRules, {
    computer: computerMove,
    options: { seats: lastSeats },
    undoable: true,
    isIrreversible: move => move.type === 'roll',
  });
  const runtime: Runtime = {
    board: createDiceWorld(DICE_COUNT),
    layout: null,
    session,
    tumble: null,
    turns: createComputerTurns(session, {
      delayMs: COMPUTER_DELAY,
      onMove: move => runtime.handleComputerMove(move),
    }),
    handleComputerMove: () => {},
  };
  return runtime;
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
  /** The picker opens on entering the game; `started` tells whether a game was chosen yet. */
  const [picking, setPicking] = useState(true);
  const [started, setStarted] = useState(false);

  useEffect(() => rt.turns.cancel, [rt]);

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
      if (picking || rt.tumble || !rt.layout)
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
    rt.turns.schedule();
  }

  /** Tumbles the dice that were just rolled: the free ones, since a roll keeps the held. */
  function startTumble(): void {
    const rolled = rt.session.state.dice.flatMap((die, index) => (die.held ? [] : [index]));
    if (rolled.length === 0)
      return;
    rt.tumble = { indices: rolled, lastFrame: null, tween: makeTween(TUMBLE_MS, 0, 1, easeOutCubic) };
    playDiceSfx(diceAudio, 'throw');
  }

  rt.handleComputerMove = (move) => {
    if (move.type === 'roll')
      startTumble();
    afterMove();
  };

  function roll(): void {
    if (picking || rt.tumble || !rt.session.apply({ type: 'roll' }))
      return;
    startTumble();
    afterMove();
  }

  function score(box: Box): void {
    if (picking || rt.tumble)
      return;
    if (rt.session.apply({ box, type: 'score' }))
      afterMove();
  }

  function undo(): void {
    if (!picking && !rt.tumble && rt.session.undo())
      afterMove();
  }

  /** New game: pause the computer and ask for the seats first. */
  function openPicker(): void {
    rt.turns.cancel();
    setPicking(true);
  }

  function closePicker(): void {
    setPicking(false);
    rt.turns.schedule();
  }

  function start(kinds: SeatKind[]): void {
    lastSeats = kinds;
    rt.tumble = null;
    rt.session.newGame(undefined, { seats: kinds });
    setStarted(true);
    setPicking(false);
    afterMove();
  }

  const { rollsUsed, seats, sheets } = rt.session.state;
  const over = rt.session.status === 'won';
  const computerTurn = isComputerTurn(seats);
  const rollsLeft = MAX_ROLLS - rollsUsed;
  const turnText = `Turn ${Math.min(seats.turn.rounds + 1, TURNS)} / ${TURNS}`;
  let status: string;
  if (over)
    status = sheets.length === 1 ? `Game over · ${totals(sheets[0]!).grand}` : resultText(rt.session.state);
  else if (sheets.length === 1)
    status = turnText;
  else
    status = `${seatName(seats.kinds, seatToPlay(seats))}${computerTurn ? ' is playing' : ''} · ${turnText}`;

  return (
    <GameFrame
      areaRef={areaRef}
      canvasRef={canvasRef}
      newGameLabel="New game"
      overlay={picking
        ? (
            <SeatPicker
              initial={lastSeats}
              maxSeats={MAX_SEATS}
              onCancel={started ? closePicker : undefined}
              onStart={start}
            />
          )
        : undefined}
      side={<Scorecard onScore={score} showPreviews={rt.tumble === null && !picking} state={rt.session.state} />}
      sideWidth={Math.max(SIDE_MIN, SIDE_BASE + SIDE_COLUMN * sheets.length)}
      undoDisabled={!rt.session.canUndo || rt.tumble !== null || picking}
      onBack={onBack}
      onNewDeal={openPicker}
      onUndo={undo}
    >
      <button
        class={frameStyles.btnPrimary}
        disabled={over || picking || computerTurn || rollsLeft === 0 || rt.tumble !== null}
        onClick={roll}
      >
        {`Roll (${rollsLeft} left)`}
      </button>
      <span class={frameStyles.hint} role="status">{status}</span>
    </GameFrame>
  );
}
