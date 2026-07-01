import { describe, expect, it } from 'vitest';

import { computeLayout } from './layout';

describe('computeLayout', () => {
  it('returns canvas dimensions matching the container', () => {
    const layout = computeLayout(1024, 768, 7);
    expect(layout.canvasW).toBe(1024);
    expect(layout.canvasH).toBe(768);
  });

  it('produces a card width no larger than MAX_CARD_W (160)', () => {
    const layout = computeLayout(4000, 2000, 7);
    expect(layout.cardW).toBeLessThanOrEqual(160);
  });

  it('produces a card height matching the aspect ratio', () => {
    const layout = computeLayout(1024, 768, 7);
    const expectedH = Math.round(layout.cardW * (110 / 80));
    expect(layout.cardH).toBe(expectedH);
  });

  it('ensures margin is at least MIN_MARGIN (16)', () => {
    const layout = computeLayout(200, 200, 7);
    expect(layout.marginX).toBeGreaterThanOrEqual(16);
  });

  it('ensures topY is at least 12', () => {
    const layout = computeLayout(100, 100, 7);
    expect(layout.topY).toBeGreaterThanOrEqual(12);
  });

  it('ensures colPitch is at least card width', () => {
    const layout = computeLayout(1024, 768, 7);
    expect(layout.colPitch).toBeGreaterThanOrEqual(layout.cardW);
  });

  it('clamps card size when height is insufficient for the column', () => {
    // Very short container — cards should shrink to fit vertically.
    const normal = computeLayout(1024, 768, 7);
    const short = computeLayout(1024, 400, 7);
    expect(short.cardW).toBeLessThan(normal.cardW);
    expect(short.cardH).toBeLessThan(normal.cardH);
  });

  it('does not clamp when height is ample', () => {
    // Tall container — cards should be at their max (or width-limited).
    const tall = computeLayout(1024, 2000, 7);
    const reference = computeLayout(1024, 1200, 7);
    // Both should hit the same cardW since width is the limiting factor.
    expect(tall.cardW).toBe(reference.cardW);
  });

  it('adjusts layout for different slot counts', () => {
    const seven = computeLayout(1024, 768, 7);
    const ten = computeLayout(1024, 768, 10);
    // More slots → narrower cards (or same if already at max).
    expect(ten.cardW).toBeLessThanOrEqual(seven.cardW);
  });

  it('centers the layout horizontally', () => {
    const layout = computeLayout(1920, 1080, 7);
    const totalW = 7 * layout.cardW + 6 * (layout.colPitch - layout.cardW);
    const expectedMargin = Math.round((1920 - totalW) / 2);
    // marginX should be at least the computed center, respecting MIN_MARGIN.
    expect(layout.marginX).toBe(expectedMargin);
  });

  it('handles the minimal container gracefully', () => {
    const layout = computeLayout(100, 100, 1);
    expect(layout.cardW).toBeGreaterThan(0);
    expect(layout.cardH).toBeGreaterThan(0);
    expect(layout.colPitch).toBeGreaterThan(0);
  });

  it('rounds all output values to integers', () => {
    const layout = computeLayout(1024, 768, 7);
    expect(Number.isInteger(layout.cardW)).toBe(true);
    expect(Number.isInteger(layout.cardH)).toBe(true);
    expect(Number.isInteger(layout.colPitch)).toBe(true);
    expect(Number.isInteger(layout.marginX)).toBe(true);
    expect(Number.isInteger(layout.topY)).toBe(true);
    expect(Number.isInteger(layout.canvasW)).toBe(true);
    expect(Number.isInteger(layout.canvasH)).toBe(true);
  });
});
