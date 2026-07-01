/**
 * Shared constants used across all card games.
 *
 * Single source of truth for layout ratios, rendering offsets, audio levels,
 * and UI dimensions. Game-specific constants (e.g. dealer delay, auto-win speed)
 * remain local to their game modules.
 */

// --- UI ---

/** Height of the bottom control bar (px). */
export const BAR_HEIGHT = 44;

// --- Layout ratios ---

/** Vertical fan between consecutive face-up cards in a column (fraction of card height). */
export const FAN_FACE_UP_RATIO = 0.3;

/** Vertical fan between consecutive face-down cards in a column (fraction of card height). */
export const FAN_FACE_DOWN_RATIO = 0.125;

/** Vertical gap between the top row and the tableau (fraction of card height). */
export const TABLEAU_Y_GAP = 0.3;

// --- Drag visuals ---

/** Vertical fan between consecutive dragged cards (fraction of card height). */
export const DRAG_FAN_RATIO = 0.3;

/** Render-order bump for dragged cards so they paint on top. */
export const DRAG_ORDER_BUMP = 100_000;

// --- Off-screen ---

/** X coordinate used to place cards off the visible canvas. */
export const OFF_SCREEN_X = -200;

/** Base Y coordinate for off-screen cards; increment per card for stack illusion. */
export const OFF_SCREEN_Y = -200;

/** Per-card Y offset when stacking off-screen cards. */
export const OFF_SCREEN_Y_STEP = 2;

// --- Audio ---

/** Volume level (0–1) for card SFX. */
export const SFX_VOLUME = 0.6;

// --- Card overlap (horizontal) ---

/** Horizontal overlap between adjacent cards in a hand (fraction of card width). */
export const HAND_CARD_OVERLAP = 0.35;
