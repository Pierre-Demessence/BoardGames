/**
 * Yahtzee's table view: where the five dice sit for a canvas size, which die a
 * point hits, and the felt, labels, sprites and final banner drawn each frame.
 * The scorecard is not drawn here; it is a Preact table beside the canvas.
 */

import type { EcsWorld } from '@pierre/ecs';
import type { Canvas2DRenderContext } from '@pierre/ecs/modules/render-canvas2d';
import type { TextureAtlasRegistry } from '@pierre/ecs/modules/texture-atlas';

import type { Point, Size } from '../../core';
import type { DicePlacement, DieValue } from '../../kits/dice';
import type { YahtzeeState } from './rules';

import { Canvas2DRenderer } from '@pierre/ecs/modules/render-canvas2d';

import { drawBanner } from '../../core';
import { DICE_COUNT, totals, yahtzeeRules } from './rules';

export interface YahtzeeLayout {
  /** Height of the final banner. */
  bannerH: number;
  /** Vertical middle of a die at rest. */
  centerY: number;
  dieSize: number;
  /** Font size of the labels. */
  fontSize: number;
  /** How far a held die is raised. */
  raise: number;
  /** Horizontal middle of each die. */
  xs: number[];
}

/** A tumbling die's look for one frame: spun, hopped and showing a passing face. */
export interface DieTumble {
  angle: number;
  /** Vertical offset from the resting spot; negative is up. */
  dy: number;
  value: DieValue;
}

const MAX_DIE = 120;
/** Gap between dice, in die sizes. */
const GAP = 0.3;
/** Share of the canvas width the row of dice may fill, leaving room for a spinning die's corners. */
const ROW_SHARE = 0.9;
/** Share of the canvas height one die may take. */
const HEIGHT_SHARE = 0.3;
const RAISE = 0.35;
const FELT = '#0b5e3a';

const renderer = new Canvas2DRenderer();

/** Centers five dice in a row, as large as the canvas allows up to a cap. */
export function yahtzeeLayout(size: Size): YahtzeeLayout {
  const dieSize = Math.max(
    8,
    Math.floor(Math.min(MAX_DIE, (size.width * ROW_SHARE) / (DICE_COUNT + (DICE_COUNT - 1) * GAP), size.height * HEIGHT_SHARE)),
  );
  const step = dieSize * (1 + GAP);
  const left = (size.width - (DICE_COUNT - 1) * step) / 2;
  return {
    bannerH: Math.max(24, Math.round(dieSize * 0.9)),
    centerY: Math.round(size.height * 0.5),
    dieSize,
    fontSize: Math.max(12, Math.round(dieSize * 0.2)),
    raise: Math.round(dieSize * RAISE),
    xs: Array.from({ length: DICE_COUNT }, (_, i) => Math.round(left + i * step)),
  };
}

/**
 * Where each die is drawn. Held dice are raised; dice in `tumbling` use their
 * spin, hop and face. Before the first roll of a turn nothing is placed.
 */
export function placements(
  state: YahtzeeState,
  layout: YahtzeeLayout,
  tumbling: ReadonlyMap<number, DieTumble> = new Map(),
): DicePlacement[] {
  if (state.rollsUsed === 0)
    return [];
  return state.dice.map((die, index) => {
    const tumble = tumbling.get(index);
    return {
      angle: tumble?.angle ?? 0,
      held: die.held,
      index,
      order: index,
      value: tumble?.value ?? die.value,
      x: layout.xs[index]!,
      y: layout.centerY - (die.held ? layout.raise : 0) + (tumble?.dy ?? 0),
    };
  });
}

/** The die under `point`, counting both its resting and its raised spot, or `null` between dice. */
export function dieAt(layout: YahtzeeLayout, point: Point): number | null {
  const half = layout.dieSize / 2;
  if (point.y < layout.centerY - layout.raise - half || point.y > layout.centerY + half)
    return null;
  const index = layout.xs.findIndex(x => Math.abs(point.x - x) <= half);
  return index === -1 ? null : index;
}

/** Draws the felt, the dice, a "Held" label under each held die, a hint and the final banner. */
export function drawTable(
  ctx: CanvasRenderingContext2D,
  size: Size,
  layout: YahtzeeLayout,
  state: YahtzeeState,
  world: EcsWorld,
  atlases: TextureAtlasRegistry,
): void {
  ctx.fillStyle = FELT;
  ctx.fillRect(0, 0, size.width, size.height);

  const renderContext: Canvas2DRenderContext = { atlases, ctx2d: ctx, world };
  renderer.render(renderContext);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `${layout.fontSize}px system-ui`;
  if (yahtzeeRules.status(state) === 'won') {
    drawBanner(ctx, size.width, size.height, layout.bannerH, `Final score: ${totals(state).grand}`);
    return;
  }
  if (state.rollsUsed === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(layout.fontSize * 1.6)}px system-ui`;
    ctx.fillText('Roll to start', size.width / 2, layout.centerY);
    return;
  }
  ctx.fillStyle = '#ffe14d';
  state.dice.forEach((die, index) => {
    if (die.held)
      ctx.fillText('Held', layout.xs[index]!, layout.centerY + layout.dieSize / 2 + 6);
  });
  if (state.rollsUsed < 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('Click a die to hold it', size.width / 2, layout.centerY + layout.dieSize / 2 + layout.fontSize * 2.5);
  }
}
