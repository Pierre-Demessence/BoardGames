/**
 * Shared dynamic layout — computes card and canvas sizes from viewport.
 *
 * Card size is width-driven (horizontal space first) then clamped so
 * columns fit vertically without scrollbars. Tight fan ratios keep
 * deep columns compact.
 */

const CARD_ASPECT = 110 / 80;
const GAP_RATIO = 0.2;
const MIN_MARGIN = 16;
const MAX_CARD_W = 160;

/** Tight fan ratios so deep columns fit vertically. */
const FAN_FACE_DOWN = 0.05;
const FAN_FACE_UP = 0.18;

/**
 * Max practical column depth in card-heights:
 * 6 face-down × FAN_FACE_DOWN + 13 face-up × FAN_FACE_UP + 1 card.
 */
const MAX_COLUMN_RATIO = 6 * FAN_FACE_DOWN + 13 * FAN_FACE_UP + 1;

export interface CardLayout {
  canvasH: number;
  canvasW: number;
  cardH: number;
  cardW: number;
  colPitch: number;
  marginX: number;
  topY: number;
}

export function computeLayout(
  containerWidth: number,
  containerHeight: number,
  slots: number,
): CardLayout {
  const topY = Math.max(12, Math.round(containerHeight * 0.025));
  const marginX = Math.max(MIN_MARGIN, Math.round(containerWidth * 0.03));

  // Card size from width
  const availableW = containerWidth - marginX * 2;
  let cardW = Math.floor(availableW / (slots + GAP_RATIO * (slots - 1)));
  cardW = Math.min(cardW, MAX_CARD_W);
  let cardH = Math.round(cardW * CARD_ASPECT);

  // Clamp so column fits vertically (no scrollbars)
  const tableauYGap = Math.round(cardH * 0.3);
  const maxColumnH = Math.round(cardH * MAX_COLUMN_RATIO);
  const neededH = topY + cardH + tableauYGap + maxColumnH + Math.round(cardH * 0.5);

  if (neededH > containerHeight) {
    const scale = (containerHeight - topY) / (neededH - topY);
    cardW = Math.floor(cardW * scale);
    cardH = Math.round(cardW * CARD_ASPECT);
  }

  const colPitch = Math.round(cardW * (1 + GAP_RATIO));

  // Center horizontally
  const totalW = slots * cardW + (slots - 1) * (colPitch - cardW);
  const centerMarginX = Math.max(marginX, Math.round((containerWidth - totalW) / 2));

  return {
    canvasH: containerHeight,
    canvasW: containerWidth,
    cardH,
    cardW,
    colPitch,
    marginX: centerMarginX,
    topY,
  };
}
