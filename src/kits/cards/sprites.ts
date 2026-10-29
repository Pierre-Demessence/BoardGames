import type { EntityId } from '@pierre/ecs';

import type { Card } from './deck';

import { EcsWorld } from '@pierre/ecs';
import { RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';

import { BACKS_ATLAS, CARDS_ATLAS } from './atlas';
import { CARD_BACK_FRAME, cardFrame } from './cards';

export interface CardPlacement {
  card: Card;
  /** Paint order; higher paints on top. */
  order: number;
  x: number;
  y: number;
}

/**
 * Writes the position, sprite and paint order of every placed card to its
 * entity (`entityOf[card.id]`), and removes the sprite of cards not placed so
 * they are not drawn. The world needs `PositionDef`, `RenderableDef` and
 * `RenderOrderDef` registered.
 */
export function syncCardSprites(
  world: EcsWorld,
  entityOf: readonly EntityId[],
  placements: readonly CardPlacement[],
  size: { cardH: number; cardW: number },
): void {
  const positions = world.getStore(PositionDef);
  const renderables = world.getStore(RenderableDef);
  const orders = world.getStore(RenderOrderDef);
  const placed = new Set<number>();

  for (const { card, order, x, y } of placements) {
    const entity = entityOf[card.id]!;
    placed.add(card.id);
    positions.set(entity, { x, y });
    renderables.set(entity, {
      anchor: 'top-left',
      atlas: card.faceUp ? CARDS_ATLAS : BACKS_ATLAS,
      dh: size.cardH,
      dw: size.cardW,
      frame: card.faceUp ? cardFrame(card.suit, card.rank) : CARD_BACK_FRAME,
      kind: 'sprite',
    });
    orders.set(entity, { value: order });
  }

  entityOf.forEach((entity, id) => {
    if (!placed.has(id))
      renderables.delete(entity);
  });
}

/**
 * A world with the components `syncCardSprites` needs and one entity per card
 * id (`entityOf[id]`). A game view creates it when a new game starts.
 */
export function createCardWorld(cardCount: number): { entityOf: EntityId[]; world: EcsWorld } {
  const world = new EcsWorld();
  world.registerComponent(PositionDef);
  world.registerComponent(RenderableDef);
  world.registerComponent(RenderOrderDef);
  const entityOf = Array.from({ length: cardCount }, () => world.createEntity());
  return { entityOf, world };
}
