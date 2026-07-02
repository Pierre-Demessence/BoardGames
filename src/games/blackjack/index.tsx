/**
 * Blackjack (21) — Preact game component.
 *
 * Turn-based: player hits or stands via buttons, dealer follows fixed rules.
 * Canvas rendering + ECS tick runs in a rAF loop via useEffect.
 */

import type { EntityId } from '@pierre/ecs';

import type { GameResources } from '../../shared';
import type { CardLayout } from '../../shared/layout';
import type { GameState } from './game';

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import { BAR_HEIGHT, computeLayout, GameShell, makeWorld, playCardSfx } from '../../shared';
import shellStyles from '../../shared/shell.module.css';
import {
  checkNaturalBlackjack,
  dealerHit,
  dealNewGame,
  hit,
  stand,
} from './game';
import { renderFrame, syncLayout } from './render';

const BLACKJACK_SLOTS = 12;
const DEALER_DELAY = 600;

export interface BlackjackGameProps {
  resources: GameResources;
  onBack: () => void;
}

export function BlackjackGame({ onBack, resources }: BlackjackGameProps) {
  const { atlases, audio } = resources;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef(makeWorld());
  const stateRef = useRef<GameState | null>(null);
  const nextDealerHitTimeRef = useRef(0);

  const [layout, setLayout] = useState<CardLayout | null>(null);
  const [playing, setPlaying] = useState(false);

  // Measure viewport and compute layout on mount
  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setLayout(computeLayout(w, h - BAR_HEIGHT, BLACKJACK_SLOTS));
  }, []);

  const newDeal = useCallback(() => {
    const world = makeWorld();
    worldRef.current = world;
    const state = dealNewGame((): EntityId => world.createEntity(), layout!);
    stateRef.current = state;
    nextDealerHitTimeRef.current = 0;
    if (checkNaturalBlackjack(state)) {
      setPlaying(false);
    }
    else {
      setPlaying(state.status === 'playerTurn');
    }
  }, [layout]);

  const handleHit = useCallback(() => {
    const state = stateRef.current;
    if (!state || state.status !== 'playerTurn')
      return;
    playCardSfx(audio, 'slide');
    hit(state);
    setPlaying(state.status === 'playerTurn');
  }, [audio]);

  const handleStand = useCallback(() => {
    const state = stateRef.current;
    if (!state || state.status !== 'playerTurn')
      return;
    playCardSfx(audio, 'place');
    stand(state);
    nextDealerHitTimeRef.current = performance.now() + DEALER_DELAY;
    setPlaying(false);
  }, [audio]);

  // rAF render loop
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

      if (state.status === 'dealerTurn') {
        if (nextDealerHitTimeRef.current === 0) {
          nextDealerHitTimeRef.current = performance.now() + DEALER_DELAY;
        }
        else if (performance.now() >= nextDealerHitTimeRef.current) {
          playCardSfx(audio, 'slide');
          const keepGoing = dealerHit(state);
          if (keepGoing) {
            nextDealerHitTimeRef.current = performance.now() + DEALER_DELAY;
          }
        }
      }

      // Update UI after dealer logic — placed outside narrowed block
      setPlaying(state.status === 'playerTurn');

      syncLayout(worldRef.current, state);
      renderFrame(ctx2d, worldRef.current, atlases, state);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [layout, atlases, audio]);

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
      <button
        class={shellStyles.btnPrimary}
        disabled={!playing}
        onClick={handleHit}
      >
        Hit
      </button>
      <button
        class={shellStyles.btnSecondary}
        disabled={!playing}
        onClick={handleStand}
      >
        Stand
      </button>
    </GameShell>
  );
}
