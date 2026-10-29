/**
 * Layout ratios and drawing offsets shared by every card game. Game-specific
 * constants (dealer delay, auto-win delay) stay in their game.
 */

/** Vertical fan between consecutive face-up cards in a column (fraction of card height). */
export const FAN_FACE_UP_RATIO = 0.3;

/** Vertical fan between consecutive face-down cards in a column (fraction of card height). */
export const FAN_FACE_DOWN_RATIO = 0.125;

/** Vertical gap between the top row and the tableau (fraction of card height). */
export const TABLEAU_Y_GAP = 0.3;

/** Vertical fan between consecutive dragged cards (fraction of card height). */
export const DRAG_FAN_RATIO = 0.3;

/** Render-order bump for dragged cards so they paint on top. */
export const DRAG_ORDER_BUMP = 100_000;

/** X coordinate used to place cards off the visible canvas. */
export const OFF_SCREEN_X = -200;

/** Base Y coordinate for off-screen cards; increment per card for stack illusion. */
export const OFF_SCREEN_Y = -200;

/** Per-card Y offset when stacking off-screen cards. */
export const OFF_SCREEN_Y_STEP = 2;

/** Horizontal overlap between adjacent cards in a hand (fraction of card width). */
export const HAND_CARD_OVERLAP = 0.35;
