/**
 * Table layout for card games: card size from the width and the top row,
 * columns that squeeze to fit, and hands laid out in a row.
 */

import { FAN_FACE_DOWN_RATIO, FAN_FACE_UP_RATIO, HAND_CARD_OVERLAP, TABLEAU_Y_GAP } from './constants';

const CARD_ASPECT = 110 / 80;
const GAP_RATIO = 0.2;
const MIN_MARGIN = 16;
const MAX_CARD_W = 160;

/** Room kept below the top row and its gap, in card heights, so a column always has space to fan. */
const MIN_TABLEAU_ROOM = 1.5;

export interface Point {
  x: number;
  y: number;
}

export interface TableLayout {
  canvasH: number;
  canvasW: number;
  cardH: number;
  cardW: number;
  colPitch: number;
  marginX: number;
  /** Lowest y a card's bottom edge may reach. */
  tableauBottom: number;
  /** Y of the first card of every tableau column. */
  tableauTop: number;
  /** Y of the top row. */
  topY: number;
}

/**
 * Sizes cards by the width available for `columns` columns, then shrinks them
 * only as far as the top row and a minimal tableau need. Column depth does not
 * shrink cards: `fanColumn` squeezes the column instead.
 */
export function computeTableLayout(width: number, height: number, columns: number): TableLayout {
  const topY = Math.max(12, Math.round(height * 0.025));
  const marginX = Math.max(MIN_MARGIN, Math.round(width * 0.03));

  const availableW = width - marginX * 2;
  let cardW = Math.min(Math.floor(availableW / (columns + GAP_RATIO * (columns - 1))), MAX_CARD_W);

  const maxCardH = (height - topY * 2) / (1 + TABLEAU_Y_GAP + MIN_TABLEAU_ROOM);
  if (cardW * CARD_ASPECT > maxCardH)
    cardW = Math.floor(maxCardH / CARD_ASPECT);
  cardW = Math.max(1, cardW);
  const cardH = Math.round(cardW * CARD_ASPECT);

  const colPitch = Math.round(cardW * (1 + GAP_RATIO));
  const totalW = columns * cardW + (columns - 1) * (colPitch - cardW);

  return {
    canvasH: height,
    canvasW: width,
    cardH,
    cardW,
    colPitch,
    marginX: Math.max(marginX, Math.round((width - totalW) / 2)),
    tableauBottom: height - topY,
    tableauTop: topY + cardH + Math.round(cardH * TABLEAU_Y_GAP),
    topY,
  };
}

/**
 * Y of every card in a column starting at `top`. Cards fan by the shared
 * face-up and face-down ratios; when the last card's bottom edge would pass
 * `maxBottom`, every gap shrinks by the same factor (down to a full overlap).
 */
export function fanColumn(
  cards: readonly { faceUp: boolean }[],
  top: number,
  maxBottom: number,
  cardH: number,
): number[] {
  const offsets: number[] = [];
  let total = 0;
  for (const card of cards) {
    offsets.push(total);
    total += Math.round(cardH * (card.faceUp ? FAN_FACE_UP_RATIO : FAN_FACE_DOWN_RATIO));
  }
  // Only the gaps between cards squeeze: nothing sits below the last card.
  const span = offsets.at(-1) ?? 0;
  const room = maxBottom - cardH - top;
  const scale = span > room ? Math.max(0, room) / span : 1;
  return offsets.map(offset => top + Math.floor(offset * scale));
}

/**
 * Positions of `count` cards laid out in a horizontally centered row at `y`,
 * overlapping by `overlap` of the card width. A row wider than the canvas
 * overlaps more instead of running off it.
 */
export function rowPositions(
  count: number,
  cardW: number,
  canvasW: number,
  y: number,
  overlap: number = HAND_CARD_OVERLAP,
): Point[] {
  if (count === 0)
    return [];
  let step = Math.round(cardW * overlap);
  if (count > 1)
    step = Math.max(0, Math.min(step, Math.floor((canvasW - cardW) / (count - 1))));
  const startX = (canvasW - (cardW + (count - 1) * step)) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: startX + i * step, y }));
}
