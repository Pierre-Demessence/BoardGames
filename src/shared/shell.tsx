/**
 * Game shell — Preact component shared by all card games.
 *
 * Renders the control bar (back, new deal, children slot) and a canvas
 * element. The parent game component owns the rAF loop, pointer events,
 * and game state — this component is purely presentational.
 */

import type { ComponentChildren, RefObject } from 'preact';

import { EcsWorld } from '@pierre/ecs';
import { RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';

import styles from './shell.module.css';

export interface GameShellProps {
  canvasH: number;
  canvasRef: RefObject<HTMLCanvasElement>;
  canvasW: number;
  children?: ComponentChildren;
  cursor?: 'default' | 'pointer';
  onBack: () => void;
  onNewDeal: () => void;
}

/**
 * Create an ECS world pre-registered with the components every card game uses.
 */
export function makeWorld(): EcsWorld {
  const world = new EcsWorld();
  world.registerComponent(PositionDef);
  world.registerComponent(RenderableDef);
  world.registerComponent(RenderOrderDef);
  return world;
}

export function GameShell({
  canvasH,
  canvasRef,
  canvasW,
  children,
  cursor = 'pointer',
  onBack,
  onNewDeal,
}: GameShellProps) {
  const cursorClass = cursor === 'default' ? styles.canvasDefault : styles.canvasPointer;

  return (
    <>
      <div class={styles.bar}>
        <button
          class={styles.btnSecondary}
          aria-label="Back to game selection"
          onClick={onBack}
        >
          ← Games
        </button>
        <button
          class={styles.btnPrimary}
          aria-label="Start a new deal"
          onClick={onNewDeal}
        >
          New deal
        </button>
        {children}
      </div>
      <canvas
        ref={canvasRef}
        class={`${styles.canvas} ${cursorClass}`}
        style={{ height: `${canvasH}px`, width: `${canvasW}px` }}
        width={canvasW}
        height={canvasH}
      />
    </>
  );
}
