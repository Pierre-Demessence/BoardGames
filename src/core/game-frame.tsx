/**
 * The frame around a canvas game: the control bar (Back, New deal, optional
 * Undo and the game's own items), an optional side panel and the area the
 * canvas hook fills.
 */

import type { ComponentChildren, RefObject } from 'preact';

import styles from './game-frame.module.css';

export interface GameFrameProps {
  areaRef: RefObject<HTMLDivElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  /** The game's own bar items, such as the score. */
  children?: ComponentChildren;
  /** Label of the new-game button. */
  newGameLabel?: string;
  /** A panel left of the canvas area, such as a scorecard. */
  side?: ComponentChildren;
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
  newGameLabel = 'New deal',
  onBack,
  onNewDeal,
  onUndo,
  side,
  undoDisabled = false,
}: GameFrameProps) {
  const area = (
    <div ref={areaRef} class={styles.area}>
      <canvas ref={canvasRef} class={styles.canvas} />
    </div>
  );
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
          {newGameLabel}
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
      {side
        ? (
            <div class={styles.body}>
              <div class={styles.side}>{side}</div>
              {area}
            </div>
          )
        : area}
    </>
  );
}
