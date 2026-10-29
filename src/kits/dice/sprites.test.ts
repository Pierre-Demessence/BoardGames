import { RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef, RotationDef } from '@pierre/ecs/modules/transform';
import { describe, expect, it } from 'vitest';

import { DICE_ATLAS, DICE_HELD_ATLAS, dieFrame } from './atlas';
import { createDiceWorld, syncDiceSprites } from './sprites';

describe('dieFrame', () => {
  it('names the face frame of the free and the held dice', () => {
    expect(dieFrame(3, false)).toBe('dieWhite_border3.png');
    expect(dieFrame(6, true)).toBe('dieRed_border6.png');
  });
});

describe('syncDiceSprites', () => {
  it('writes position, rotation, sprite and order for placed dice', () => {
    const { entityOf, world } = createDiceWorld(3);
    syncDiceSprites(world, entityOf, [
      { angle: 0.5, held: false, index: 0, order: 1, value: 4, x: 10, y: 20 },
      { angle: 0, held: true, index: 2, order: 2, value: 6, x: 30, y: 40 },
    ], 64);

    expect(world.getStore(PositionDef).get(entityOf[0]!)).toEqual({ x: 10, y: 20 });
    expect(world.getStore(RotationDef).get(entityOf[0]!)).toEqual({ angle: 0.5 });
    expect(world.getStore(RenderOrderDef).get(entityOf[2]!)).toEqual({ value: 2 });
    expect(world.getStore(RenderableDef).get(entityOf[0]!)).toMatchObject({
      anchor: 'center',
      atlas: DICE_ATLAS,
      dh: 64,
      dw: 64,
      frame: dieFrame(4, false),
      kind: 'sprite',
    });
    expect(world.getStore(RenderableDef).get(entityOf[2]!)).toMatchObject({
      atlas: DICE_HELD_ATLAS,
      frame: dieFrame(6, true),
    });
  });

  it('removes the sprite of dice that are no longer placed', () => {
    const { entityOf, world } = createDiceWorld(2);
    const both = entityOf.map((_, index) => ({ angle: 0, held: false, index, order: index, value: 1 as const, x: 0, y: 0 }));
    syncDiceSprites(world, entityOf, both, 64);
    syncDiceSprites(world, entityOf, [both[0]!], 64);
    expect(world.getStore(RenderableDef).has(entityOf[0]!)).toBe(true);
    expect(world.getStore(RenderableDef).has(entityOf[1]!)).toBe(false);
  });
});
