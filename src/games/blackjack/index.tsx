/**
 * Blackjack (21) — Preact game component.
 *
 * The rules live in `rules.ts`, the geometry and drawing in `view.ts`. This
 * component wires them to the session and the canvas hook, and plays the
 * dealer's turn one step at a time on a timer. There is no Undo: a hit cannot
 * be taken back.
 */

import type { GameProps, Session, Size } from '../../core';
import type { BlackjackMove, BlackjackState } from './rules';
import type { BlackjackLayout } from './view';

import { useEffect, useRef, useState } from 'preact/hooks';

import { createSession, frameStyles, GameFrame, useCanvasGame } from '../../core';
import { createCardWorld, playCardSfx, syncCardSprites } from '../../kits/cards';
import { blackjackRules } from './rules';
import { blackjackLayout, drawTable, placements } from './view';

const CARD_COUNT = 52;
/** Pause between the dealer's actions, so the player can follow them. */
const DEALER_DELAY = 600;

/** Everything the handlers share; mutable, so it never triggers a render. */
interface Runtime {
  board: ReturnType<typeof createCardWorld>;
  dealerTimer: ReturnType<typeof setTimeout> | null;
  layout: BlackjackLayout | null;
  session: Session<BlackjackState, BlackjackMove>;
}

function createRuntime(): Runtime {
  return {
    board: createCardWorld(CARD_COUNT),
    dealerTimer: null,
    layout: null,
    session: createSession(blackjackRules, { options: undefined, undoable: false }),
  };
}

export function BlackjackGame({ onBack, resources }: GameProps) {
  const { atlases, audio } = resources;
  const runtimeRef = useRef<Runtime | null>(null);
  runtimeRef.current ??= createRuntime();
  const rt = runtimeRef.current;

  const [, setRevision] = useState(0);
  const refresh = (): void => setRevision(r => r + 1);

  const { areaRef, canvasRef, invalidate } = useCanvasGame({
    draw(ctx, size) {
      const layout = rt.layout;
      if (!layout)
        return;
      syncCardSprites(rt.board.world, rt.board.entityOf, placements(rt.session.state, layout), layout);
      drawTable(ctx, size, layout, rt.session.state, rt.board.world, atlases);
    },
    onResize(size: Size) {
      rt.layout = blackjackLayout(size);
    },
  });

  function clearDealerTimer(): void {
    if (rt.dealerTimer !== null)
      clearTimeout(rt.dealerTimer);
    rt.dealerTimer = null;
  }

  /** Plays the dealer's turn: one action every DEALER_DELAY until the round is over. */
  function scheduleDealer(): void {
    clearDealerTimer();
    if (rt.session.state.phase !== 'dealer')
      return;
    rt.dealerTimer = setTimeout(() => {
      rt.dealerTimer = null;
      const cardsBefore = rt.session.state.dealer.length;
      rt.session.apply({ type: 'dealerStep' });
      if (rt.session.state.dealer.length > cardsBefore)
        playCardSfx(audio, 'slide');
      afterMove();
    }, DEALER_DELAY);
  }

  function afterMove(): void {
    refresh();
    invalidate();
    scheduleDealer();
  }

  function hit(): void {
    if (!rt.session.apply({ type: 'hit' }))
      return;
    playCardSfx(audio, 'slide');
    afterMove();
  }

  function stand(): void {
    if (!rt.session.apply({ type: 'stand' }))
      return;
    playCardSfx(audio, 'place');
    afterMove();
  }

  function newDeal(): void {
    clearDealerTimer();
    rt.session.newGame();
    rt.board = createCardWorld(CARD_COUNT);
    refresh();
    invalidate();
  }

  useEffect(() => clearDealerTimer, []);

  const playing = rt.session.state.phase === 'player';

  return (
    <GameFrame areaRef={areaRef} canvasRef={canvasRef} onBack={onBack} onNewDeal={newDeal}>
      <button class={frameStyles.btnPrimary} disabled={!playing} onClick={hit}>
        Hit
      </button>
      <button class={frameStyles.btnSecondary} disabled={!playing} onClick={stand}>
        Stand
      </button>
    </GameFrame>
  );
}
