import { describe, expect, it } from 'vitest';

import { computeTableLayout, fanColumn, rowPositions } from './layout';

function column(total: number, faceDown: number): { faceUp: boolean }[] {
  return Array.from({ length: total }, (_, i) => ({ faceUp: i >= faceDown }));
}

describe('computeTableLayout', () => {
  it('matches the canvas size and keeps the margin and top row inside it', () => {
    const layout = computeTableLayout(1024, 768, 7);
    expect(layout.canvasW).toBe(1024);
    expect(layout.canvasH).toBe(768);
    expect(layout.marginX).toBeGreaterThanOrEqual(16);
    expect(layout.topY).toBeGreaterThanOrEqual(12);
  });

  it('keeps the 110:80 card aspect', () => {
    const layout = computeTableLayout(1024, 768, 7);
    expect(layout.cardH).toBe(Math.round(layout.cardW * (110 / 80)));
  });

  it('caps the card width at 160', () => {
    expect(computeTableLayout(4000, 3000, 7).cardW).toBe(160);
  });

  it('fits all columns across the width', () => {
    const layout = computeTableLayout(1024, 768, 10);
    const right = layout.marginX + 9 * layout.colPitch + layout.cardW;
    expect(right).toBeLessThanOrEqual(1024);
  });

  it('sizes by width alone when the height is ample', () => {
    expect(computeTableLayout(1024, 1200, 7).cardW).toBe(computeTableLayout(1024, 2000, 7).cardW);
  });

  it('shrinks cards on a short canvas so the tableau keeps room', () => {
    const tall = computeTableLayout(1024, 768, 7);
    const short = computeTableLayout(1024, 400, 7);
    expect(short.cardW).toBeLessThan(tall.cardW);
    expect(short.tableauBottom - short.tableauTop).toBeGreaterThanOrEqual(short.cardH * 1.5 - 1);
  });

  it('starts the tableau below the top row', () => {
    const layout = computeTableLayout(1024, 768, 7);
    expect(layout.tableauTop).toBeGreaterThan(layout.topY + layout.cardH);
    expect(layout.tableauBottom).toBeLessThan(layout.canvasH);
  });
});

describe('fanColumn', () => {
  it('returns nothing for an empty column', () => {
    expect(fanColumn([], 100, 600, 100)).toEqual([]);
  });

  it('puts a single card at the top', () => {
    expect(fanColumn(column(1, 0), 100, 600, 100)).toEqual([100]);
  });

  it('fans face-down and face-up cards by their ratios when there is room', () => {
    // Card height 100: a face-down step is 13 (0.125 rounded), a face-up step is 30.
    expect(fanColumn(column(4, 2), 10, 1000, 100)).toEqual([10, 23, 36, 66]);
  });

  it('squeezes the gaps evenly so the last bottom edge stays inside', () => {
    const ys = fanColumn(column(20, 3), 100, 500, 100);
    expect(ys[0]).toBe(100);
    expect(ys.at(-1)! + 100).toBeLessThanOrEqual(500);
    const steps = ys.slice(1).map((y, i) => y - ys[i]!);
    expect(steps.every(step => step >= 0)).toBe(true);
    const faceUpSteps = steps.slice(3);
    expect(Math.max(...faceUpSteps) - Math.min(...faceUpSteps)).toBeLessThanOrEqual(1);
  });

  it('stacks every card when there is no room for gaps', () => {
    expect(fanColumn(column(5, 0), 100, 150, 100)).toEqual([100, 100, 100, 100, 100]);
  });

  it('keeps 40 cards (5 face-down) inside the canvas at heights from 400 px', () => {
    for (let height = 400; height <= 1200; height += 25) {
      for (const columns of [7, 10]) {
        const layout = computeTableLayout(1280, height, columns);
        const ys = fanColumn(column(40, 5), layout.tableauTop, layout.tableauBottom, layout.cardH);
        expect(ys).toHaveLength(40);
        expect(ys.at(-1)! + layout.cardH).toBeLessThanOrEqual(layout.canvasH);
        expect(ys.every((y, i) => i === 0 || y >= ys[i - 1]!)).toBe(true);
      }
    }
  });
});

describe('tiny canvases', () => {
  it('stacks a single card instead of producing NaN when there is no room', () => {
    expect(fanColumn(column(1, 0), 100, 50, 100)).toEqual([100]);
  });

  it('keeps every layout number and card position finite down to a 1 px canvas', () => {
    for (let size = 1; size <= 60; size++) {
      for (const columns of [7, 10]) {
        const layout = computeTableLayout(size, size, columns);
        expect(Object.values(layout).every(Number.isFinite)).toBe(true);
        const ys = fanColumn(column(5, 2), layout.tableauTop, layout.tableauBottom, layout.cardH);
        expect(ys.every(Number.isFinite)).toBe(true);
      }
    }
  });
});

describe('rowPositions', () => {
  it('returns nothing for no cards', () => {
    expect(rowPositions(0, 80, 800, 50)).toEqual([]);
  });

  it('centers a single card', () => {
    expect(rowPositions(1, 80, 800, 50)).toEqual([{ x: 360, y: 50 }]);
  });

  it('overlaps cards by 35 % of the width and centers the row', () => {
    // Step round(80 * 0.35) = 28, row width 80 + 2 * 28 = 136, start (800 - 136) / 2 = 332.
    expect(rowPositions(3, 80, 800, 50)).toEqual([
      { x: 332, y: 50 },
      { x: 360, y: 50 },
      { x: 388, y: 50 },
    ]);
  });

  it('overlaps more instead of running past the canvas', () => {
    const xs = rowPositions(12, 80, 300, 0).map(p => p.x);
    expect(xs[0]).toBeGreaterThanOrEqual(0);
    expect(xs.at(-1)! + 80).toBeLessThanOrEqual(300);
  });
});
