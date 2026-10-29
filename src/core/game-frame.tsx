/**
 * The frame around a canvas game: the control bar (Back, New deal, optional
 * Undo and the game's own items) and the area the canvas hook fills.
 */

import type { ComponentChildren, RefObject } from 'preact';

import styles from './game-frame.module.css';

export interface GameFrameProps {
  areaRef: RefObject<HTMLDivElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  /** The game's own bar items, such as the score. */
  children?: ComponentChildren;
  /** Greys out the Undo button, for a game with nothing to undo. */
  undoDisabled?: boolean;
  onBack: () => void;
  onNewDeal: () => void;
  /** Shows an Undo button when set. */
  onUndo?: () => void;
}

export function GameFrame({
  areaRef,
  canvasRef,
  children,
  onBack,
  onNewDeal,
  onUndo,
  undoDisabled = false,
}: GameFrameProps) {
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
        {onUndo && (
          <button
            class={styles.btnSecondary}
            aria-label="Undo the last move"
            disabled={undoDisabled}
            onClick={onUndo}
          >
            Undo
          </button>
        )}
        {children}
      </div>
      <div ref={areaRef} class={styles.area}>
        <canvas ref={canvasRef} class={styles.canvas} />
      </div>
    </>
  );
}
