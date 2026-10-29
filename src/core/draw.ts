/**
 * Canvas drawing helpers shared by every game. All sizes are CSS pixels; the
 * canvas hook has already scaled the context for the display.
 */

export interface SlotStyle {
  /** Faint hint drawn in the middle of the slot, such as "A" for a foundation. */
  label?: string;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The outline of an empty card position, with an optional faint label. */
export function drawSlot(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  cardW: number,
  cardH: number,
  { label = '' }: SlotStyle = {},
): void {
  roundRect(ctx, pos.x, pos.y, cardW, cardH, Math.round(cardW * 0.1));
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = Math.max(1, Math.round(cardW / 40));
  ctx.stroke();
  if (label === '')
    return;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = `${Math.round(cardH * 0.25)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pos.x + cardW / 2, pos.y + cardH / 2);
}

/** A dark band across the canvas with a large text, such as "You win!". */
export function drawBanner(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  bandH: number,
  text: string,
): void {
  const cy = canvasH / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, cy - bandH / 2, canvasW, bandH);
  ctx.fillStyle = '#ffe14d';
  ctx.font = `700 ${Math.round(bandH * 0.5)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvasW / 2, cy);
}
