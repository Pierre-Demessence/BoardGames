/**
 * The frame around a canvas game: the control bar (Back, New deal, optional
 * Undo and the game's own items), an optional side panel, the area the
 * canvas hook fills and an optional overlay on top of both.
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
  /** Shown centered over the side panel and the canvas area, which stay mounted underneath. */
  overlay?: ComponentChildren;
  /** A panel left of the canvas area, such as a scorecard. */
  side?: ComponentChildren;
  /** Width of the side panel in CSS pixels, when the default does not fit its content. */
  sideWidth?: number;
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
  overlay,
  side,
  sideWidth,
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
      {side || overlay
        ? (
            <div class={styles.body}>
              {side && <div class={styles.side} style={sideWidth === undefined ? undefined : { flexBasis: `${sideWidth}px` }}>{side}</div>}
              {area}
              {overlay && <div class={styles.overlay}>{overlay}</div>}
            </div>
          )
        : area}
    </>
  );
}
