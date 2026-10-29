import { describe, expect, it } from 'vitest';

import { yahtzeeRules } from './rules';
import { dieAt, placements, yahtzeeLayout } from './view';

/** The canvas next to the scorecard in a 1280×600 viewport. */
const SIZE = { height: 556, width: 940 };

function rolled(held: number[] = []) {
  const base = yahtzeeRules.setup(3, undefined, 0);
  return {
    ...base,
    dice: base.dice.map((die, i) => ({ ...die, held: held.includes(i), value: 3 as const })),
    rollsUsed: 1,
  };
}

describe('yahtzeeLayout', () => {
  it('fits five dice and the held row inside the canvas', () => {
    for (const size of [SIZE, { height: 400, width: 600 }, { height: 556, width: 2000 }]) {
      const layout = yahtzeeLayout(size);
      const half = layout.dieSize / 2;
      expect(layout.xs).toHaveLength(5);
      expect(layout.xs[0]! - half).toBeGreaterThanOrEqual(0);
      expect(layout.xs[4]! + half).toBeLessThanOrEqual(size.width);
      expect(layout.centerY - layout.raise - half).toBeGreaterThanOrEqual(0);
      expect(layout.centerY + half + layout.fontSize * 4).toBeLessThanOrEqual(size.height);
    }
  });

  it('keeps the dice apart', () => {
    const layout = yahtzeeLayout(SIZE);
    expect(layout.xs[1]! - layout.xs[0]!).toBeGreaterThan(layout.dieSize);
  });
});

describe('placements', () => {
  it('places nothing before the first roll', () => {
    expect(placements(yahtzeeRules.setup(1, undefined, 0), yahtzeeLayout(SIZE))).toEqual([]);
  });

  it('raises held dice above the free ones', () => {
    const layout = yahtzeeLayout(SIZE);
    const result = placements(rolled([1, 4]), layout);
    expect(result).toHaveLength(5);
    expect(result[0]!.y).toBe(layout.centerY);
    expect(result[1]!.y).toBe(layout.centerY - layout.raise);
    expect(result[4]!.y).toBe(layout.centerY - layout.raise);
    expect(result[1]!.held).toBe(true);
    expect(result.map(p => p.x)).toEqual(layout.xs);
  });

  it('applies the spin, hop and face of tumbling dice', () => {
    const layout = yahtzeeLayout(SIZE);
    const result = placements(rolled(), layout, new Map([[2, { angle: 1.5, dy: -10, value: 6 }]]));
    expect(result[2]).toMatchObject({ angle: 1.5, value: 6, y: layout.centerY - 10 });
    expect(result[0]).toMatchObject({ angle: 0, value: 3 });
  });
});

describe('dieAt', () => {
  const layout = yahtzeeLayout(SIZE);

  it('hits each die at its center, resting or raised', () => {
    layout.xs.forEach((x, i) => {
      expect(dieAt(layout, { x, y: layout.centerY })).toBe(i);
      expect(dieAt(layout, { x, y: layout.centerY - layout.raise })).toBe(i);
    });
  });

  it('misses the gaps, and the space above and below', () => {
    const between = (layout.xs[0]! + layout.xs[1]!) / 2;
    expect(dieAt(layout, { x: between, y: layout.centerY })).toBeNull();
    expect(dieAt(layout, { x: layout.xs[0]!, y: layout.centerY + layout.dieSize })).toBeNull();
    expect(dieAt(layout, { x: layout.xs[0]!, y: 0 })).toBeNull();
    expect(dieAt(layout, { x: 0, y: layout.centerY })).toBeNull();
  });
});
