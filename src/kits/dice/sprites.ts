import type { EntityId } from '@pierre/ecs';

import type { DieValue } from './dice';

import { EcsWorld } from '@pierre/ecs';
import { RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef, RotationDef } from '@pierre/ecs/modules/transform';

import { diceAtlas, dieFrame } from './atlas';

export interface DicePlacement {
  /** Rotation in radians around the die's center; 0 when still. */
  angle: number;
  held: boolean;
  /** Index of the die in the state; selects its entity. */
  index: number;
  /** Paint order; higher paints on top. */
  order: number;
  value: DieValue;
  /** Center of the die. */
  x: number;
  y: number;
}

/**
 * Writes the position, rotation, sprite and paint order of every placed die to
 * its entity (`entityOf[index]`), and removes the sprite of dice not placed. The
 * world needs the four components registered. Dice are anchored at their center
 * so a tumbling die spins in place.
 */
export function syncDiceSprites(
  world: EcsWorld,
  entityOf: readonly EntityId[],
  placements: readonly DicePlacement[],
  dieSize: number,
): void {
  const positions = world.getStore(PositionDef);
  const rotations = world.getStore(RotationDef);
  const renderables = world.getStore(RenderableDef);
  const orders = world.getStore(RenderOrderDef);
  const placed = new Set<number>();

  for (const { angle, held, index, order, value, x, y } of placements) {
    const entity = entityOf[index]!;
    placed.add(index);
    positions.set(entity, { x, y });
    rotations.set(entity, { angle });
    renderables.set(entity, {
      anchor: 'center',
      atlas: diceAtlas(held),
      dh: dieSize,
      dw: dieSize,
      frame: dieFrame(value, held),
      kind: 'sprite',
    });
    orders.set(entity, { value: order });
  }

  entityOf.forEach((entity, index) => {
    if (!placed.has(index))
      renderables.delete(entity);
  });
}

/** A world with the components `syncDiceSprites` needs and one entity per die. */
export function createDiceWorld(diceCount: number): { entityOf: EntityId[]; world: EcsWorld } {
  const world = new EcsWorld();
  world.registerComponent(PositionDef);
  world.registerComponent(RotationDef);
  world.registerComponent(RenderableDef);
  world.registerComponent(RenderOrderDef);
  const entityOf = Array.from({ length: diceCount }, () => world.createEntity());
  return { entityOf, world };
}
