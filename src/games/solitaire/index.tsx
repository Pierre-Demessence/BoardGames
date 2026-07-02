/**
 * Solitaire (Klondike, draw-1) — Preact game component.
 *
 * Canvas rendering + drag-and-drop + auto-win + victory animation run in a
 * rAF loop. The shell UI (buttons, score, timer) is rendered declaratively;
 * high-frequency text updates use refs to avoid per-frame re-renders.
 */

import type { EntityId } from '@pierre/ecs';

import type { GameResources } from '../../shared';
import type { CardLayout } from '../../shared/layout';
import type { Card, GameState, PileRef } from './game';

import { projectPointer } from '@pierre/ecs/modules/input';
import { RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import {
  BAR_HEIGHT,

  GameShell,
  makeWorld,
  playCardSfx,
} from '../../shared';
import shellStyles from '../../shared/shell.module.css';
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

// ---------- types ----------

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

interface AutoWinItem {
  card: Card;
  target: number;
}

const AUTO_WIN_DELAY = 50;

// ---------- helpers (pure, outside component) ----------

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

function inSlot(state: GameState, point: { x: number; y: number }, slot: { x: number; y: number }): boolean {
  const { cardH, cardW } = state.layout;
  return point.x >= slot.x && point.x <= slot.x + cardW
    && point.y >= slot.y && point.y <= slot.y + cardH;
}

function pickCard(
  state: GameState,
  point: { x: number; y: number },
): { pile: PileRef; index: number } | null {
  for (let t = 6; t >= 0; t--) {
    const pile = state.tableau[t]!;
    for (let i = pile.length - 1; i >= 0; i--) {
      if (inSlot(state, point, cardPosition(state, { index: t, kind: 'tableau' }, i)))
        return { index: i, pile: { index: t, kind: 'tableau' } };
    }
  }
  for (let f = 3; f >= 0; f--) {
    const pile = state.foundations[f]!;
    if (pile.length > 0 && inSlot(state, point, cardPosition(state, { index: f, kind: 'foundation' }, pile.length - 1)))
      return { index: pile.length - 1, pile: { index: f, kind: 'foundation' } };
  }
  const wastePile = state.waste;
  if (wastePile.length > 0 && inSlot(state, point, cardPosition(state, { index: 0, kind: 'waste' }, wastePile.length - 1)))
    return { index: wastePile.length - 1, pile: { index: 0, kind: 'waste' } };
  return null;
}

function flipExposed(pileRef: PileRef, state: GameState): boolean {
  if (pileRef.kind !== 'tableau')
    return false;
  const pile = state.tableau[pileRef.index]!;
  const top = pile.at(-1);
  if (top && !top.faceUp) {
    top.faceUp = true;
    return true;
  }
  return false;
}

function removeCardFromPiles(s: GameState, card: Card): void {
  const remove = (arr: Card[]): boolean => {
    const i = arr.indexOf(card);
    if (i === -1)
      return false;
    arr.splice(i, 1);
    return true;
  };
  if (remove(s.waste))
    return;
  for (const col of s.tableau) {
    if (remove(col))
      return;
  }
  for (const f of s.foundations) {
    if (remove(f))
      return;
  }
}

// ---------- component ----------

export interface SolitaireGameProps {
  resources: GameResources;
  onBack: () => void;
}

export function SolitaireGame({ onBack, resources }: SolitaireGameProps) {
  const { atlases, audio, audioCtx } = resources;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutable game state (never triggers re-render)
  const worldRef = useRef(makeWorld());
  const stateRef = useRef<GameState | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const autoWinQueueRef = useRef<AutoWinItem[]>([]);
  const autoWinNextTimeRef = useRef(0);
  const victoryCardsRef = useRef<VictoryCard[]>([]);
  const lastTimeUpdateRef = useRef(0);

  // Refs for imperative text updates (avoid per-frame Preact re-renders)
  const scoreElRef = useRef<HTMLSpanElement | null>(null);
  const timeElRef = useRef<HTMLSpanElement | null>(null);

  const [layout, setLayout] = useState<CardLayout | null>(null);

  // Measure viewport and compute layout on mount
  useEffect(() => {
    setLayout(initLayout(window.innerWidth, window.innerHeight - BAR_HEIGHT));
  }, []);

  // ---- helpers (access refs, called from handlers + rAF) ----

  const playSfx = useCallback((kind: 'place' | 'slide') => {
    playCardSfx(audio, kind);
  }, [audio]);

  const updateScoreDisplay = useCallback(() => {
    const s = stateRef.current;
    if (!s)
      return;
    const elapsed = Math.floor((Date.now() - s.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    if (timeElRef.current)
      timeElRef.current.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    if (scoreElRef.current)
      scoreElRef.current.textContent = `Score: ${s.score}`;
  }, []);

  const startVictoryAnimation = useCallback(() => {
    const s = stateRef.current;
    if (!s)
      return;
    const vc: VictoryCard[] = [];
    const { layout: lay } = s;
    for (let f = 0; f < 4; f++) {
      const pile = s.foundations[f]!;
      pile.forEach((card, i) => {
        const pos = cardPosition(s, { index: f, kind: 'foundation' }, i);
        vc.push({
          card,
          vx: (Math.random() - 0.5) * lay.cardW * 0.3,
          vy: -lay.cardH * (0.2 + Math.random() * 0.3),
          x: pos.x,
          y: pos.y,
        });
      });
    }
    victoryCardsRef.current = vc;
  }, []);

  const tryAutoWin = useCallback((s: GameState): boolean => {
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

    const queue: AutoWinItem[] = [];
    const sim = cloneState(s);

    let changed = true;
    while (changed) {
      changed = false;
      const wTop = sim.waste.at(-1);
      if (wTop) {
        const fi = findFoundationFor(sim, wTop);
        if (fi !== -1) {
          queue.push({ card: wTop, target: fi });
          sim.waste.pop();
          sim.foundations[fi]!.push(wTop);
          changed = true;
          continue;
        }
      }
      for (let t = 0; t < 7; t++) {
        const col = sim.tableau[t]!;
        const top = col.at(-1);
        if (top) {
          const fi = findFoundationFor(sim, top);
          if (fi !== -1) {
            queue.push({ card: top, target: fi });
            col.pop();
            sim.foundations[fi]!.push(top);
            changed = true;
            break;
          }
        }
      }
    }

    if (queue.length === 0)
      return false;
    autoWinQueueRef.current = queue;
    autoWinNextTimeRef.current = performance.now() + AUTO_WIN_DELAY;
    return true;
  }, []);

  const afterMove = useCallback((s: GameState) => {
    if (isWon(s)) {
      s.won = true;
      const bonus = finalScore(s);
      s.score = bonus;
      updateScoreDisplay();
      startVictoryAnimation();
      return;
    }
    if (autoWinQueueRef.current.length === 0)
      tryAutoWin(s);
  }, [updateScoreDisplay, startVictoryAnimation, tryAutoWin]);

  const newDeal = useCallback(() => {
    const world = makeWorld();
    worldRef.current = world;
    const state = dealNewGame((): EntityId => world.createEntity(), layout!);
    stateRef.current = state;
    dragRef.current = null;
    autoWinQueueRef.current = [];
    victoryCardsRef.current = [];
    lastTimeUpdateRef.current = Date.now();
    updateScoreDisplay();
  }, [layout, updateScoreDisplay]);

  // ---- drop resolution ----

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

    // Determine drop target
    let target: PileRef | null = null;
    for (let f = 0; f < 4; f++) {
      const slot = slotPosition(lay, { index: f, kind: 'foundation' });
      if (center.x >= slot.x && center.x <= slot.x + lay.cardW
        && center.y >= slot.y && center.y <= slot.y + lay.cardH) {
        if (canDropOnFoundation(d.cards[0]!, s.foundations[f]!))
          target = { index: f, kind: 'foundation' };
        break;
      }
    }
    if (!target) {
      for (let t = 0; t < 7; t++) {
        const col = s.tableau[t]!;
        const slot = slotPosition(lay, { index: t, kind: 'tableau' });
        const bottom = col.length === 0
          ? slot.y + lay.cardH
          : cardPosition(s, { index: t, kind: 'tableau' }, col.length - 1).y + lay.cardH;
        if (center.x >= slot.x && center.x <= slot.x + lay.cardW
          && center.y >= slot.y && center.y <= bottom + lay.cardH * 0.4) {
          if (canDropOnTableau(d.cards[0]!, col))
            target = { index: t, kind: 'tableau' };
          break;
        }
      }
    }

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
  }, [updateScoreDisplay, afterMove]);

  // ---- stock deal ----

  const dealFromStock = useCallback((s: GameState, sfx: (kind: 'place' | 'slide') => void) => {
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
  }, [updateScoreDisplay]);

  // ---- pointer event handlers ----

  const toWorld = useCallback((event: PointerEvent | MouseEvent) => {
    return projectPointer(event, canvasRef.current!);
  }, []);

  const onPointerDown = useCallback((event: PointerEvent) => {
    const state = stateRef.current;
    if (!state || state.won || autoWinQueueRef.current.length > 0)
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
    dragRef.current = {
      cards,
      from: hit.pile,
      grabX: point.x - origin.x,
      grabY: point.y - origin.y,
      pointerX: point.x,
      pointerY: point.y,
    };
    canvasRef.current!.setPointerCapture(event.pointerId);
  }, [audioCtx, toWorld, dealFromStock, playSfx]);

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

  const onDoubleClick = useCallback((event: MouseEvent) => {
    const state = stateRef.current;
    if (!state || state.won || autoWinQueueRef.current.length > 0)
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
    pile.pop();
    state.foundations[target]!.push(card);
    const flipped = flipExposed(hit.pile, state);
    awardPoints(state, movePoints(hit.pile, { index: target, kind: 'foundation' }));
    if (flipped)
      awardPoints(state, FLIP_POINTS);
    playSfx('place');
    updateScoreDisplay();
    afterMove(state);
  }, [toWorld, playSfx, updateScoreDisplay, afterMove]);

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
      const now = performance.now();

      updateScoreDisplay();

      // Time penalty every 10 seconds
      if (now - lastTimeUpdateRef.current > 10000) {
        const penalty = computeTimePenalty(state);
        if (penalty < 0)
          awardPoints(state, penalty);
        lastTimeUpdateRef.current = now;
        updateScoreDisplay();
      }

      // Auto-win queue
      const queue = autoWinQueueRef.current;
      if (queue.length > 0 && now >= autoWinNextTimeRef.current && !state.won) {
        const { card, target } = queue.shift()!;
        removeCardFromPiles(state, card);
        state.foundations[target]!.push(card);
        awardPoints(state, movePoints(
          { index: 0, kind: 'waste' },
          { index: target, kind: 'foundation' },
        ));
        playSfx('place');
        updateScoreDisplay();
        if (queue.length > 0) {
          autoWinNextTimeRef.current = now + AUTO_WIN_DELAY;
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
      const vc = victoryCardsRef.current;
      if (vc.length > 0) {
        const positions = worldRef.current.getStore(PositionDef);
        const { layout: lay } = state;
        for (const v of vc) {
          v.vy += lay.cardH * 0.015;
          v.x += v.vx;
          v.y += v.vy;
          if (v.y > lay.canvasH - lay.cardH) {
            v.y = lay.canvasH - lay.cardH;
            v.vy *= -0.5;
            if (Math.abs(v.vy) < 1)
              v.vy = 0;
          }
          if (v.x < 0) {
            v.x = 0;
            v.vx *= -0.5;
          }
          if (v.x > lay.canvasW - lay.cardW) {
            v.x = lay.canvasW - lay.cardW;
            v.vx *= -0.5;
          }
          positions.set(v.card.id, { x: v.x, y: v.y });
        }
        const orders = worldRef.current.getStore(RenderOrderDef);
        vc.forEach((v, i) => {
          orders.set(v.card.id, { value: 200000 + i });
        });
      }

      if (vc.length === 0)
        syncLayout(worldRef.current, state, dragRef.current);
      renderFrame(ctx2d, worldRef.current, atlases, state);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [layout, atlases, playSfx, updateScoreDisplay, startVictoryAnimation]);

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
    canvas.addEventListener('dblclick', onDoubleClick, { signal: sig });
    return () => ctrl.abort();
  }, [layout, onPointerDown, onPointerMove, onPointerUp, onDoubleClick]);

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
      <span ref={scoreElRef} class={shellStyles.score}>Score: 0</span>
      <span ref={timeElRef} class={shellStyles.timer}>0:00</span>
    </GameShell>
  );
}
