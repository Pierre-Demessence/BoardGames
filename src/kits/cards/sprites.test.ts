import type { EntityId } from '@pierre/ecs';

import type { Card } from './deck';

import { EcsWorld } from '@pierre/ecs';
import { RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';
import { describe, expect, it } from 'vitest';

import { BACKS_ATLAS, CARDS_ATLAS } from './atlas';
import { CARD_BACK_FRAME, cardFrame } from './cards';
import { createCardWorld, syncCardSprites } from './sprites';

const SIZE = { cardH: 110, cardW: 80 };

function setup() {
  const world = new EcsWorld();
  world.registerComponent(PositionDef);
  world.registerComponent(RenderableDef);
  world.registerComponent(RenderOrderDef);
  const entityOf: EntityId[] = [0, 1, 2].map(() => world.createEntity());
  const cards: Card[] = [
    { id: 0, faceUp: true, rank: 13, suit: 'Hearts' },
    { id: 1, faceUp: false, rank: 2, suit: 'Spades' },
    { id: 2, faceUp: true, rank: 1, suit: 'Clubs' },
  ];
  return { cards, entityOf, world };
}

describe('syncCardSprites', () => {
  it('writes position, sprite and order for placed cards', () => {
    const { cards, entityOf, world } = setup();
    syncCardSprites(world, entityOf, [
      { card: cards[0]!, order: 5, x: 10, y: 20 },
      { card: cards[1]!, order: 6, x: 30, y: 40 },
    ], SIZE);

    expect(world.getStore(PositionDef).get(entityOf[0]!)).toEqual({ x: 10, y: 20 });
    expect(world.getStore(RenderOrderDef).get(entityOf[1]!)).toEqual({ value: 6 });
    expect(world.getStore(RenderableDef).get(entityOf[0]!)).toMatchObject({
      atlas: CARDS_ATLAS,
      dh: 110,
      dw: 80,
      frame: cardFrame('Hearts', 13),
      kind: 'sprite',
    });
    expect(world.getStore(RenderableDef).get(entityOf[1]!)).toMatchObject({
      atlas: BACKS_ATLAS,
      frame: CARD_BACK_FRAME,
    });
  });

  it('removes the sprite of cards that are no longer placed', () => {
    const { cards, entityOf, world } = setup();
    syncCardSprites(world, entityOf, cards.map((card, i) => ({ card, order: i, x: i, y: i })), SIZE);
    expect(world.getStore(RenderableDef).has(entityOf[2]!)).toBe(true);

    syncCardSprites(world, entityOf, [{ card: cards[0]!, order: 0, x: 0, y: 0 }], SIZE);
    const renderables = world.getStore(RenderableDef);
    expect(renderables.has(entityOf[0]!)).toBe(true);
    expect(renderables.has(entityOf[1]!)).toBe(false);
    expect(renderables.has(entityOf[2]!)).toBe(false);
  });

  it('updates a card that flips or moves', () => {
    const { cards, entityOf, world } = setup();
    syncCardSprites(world, entityOf, [{ card: cards[1]!, order: 0, x: 1, y: 1 }], SIZE);
    syncCardSprites(world, entityOf, [{ card: { ...cards[1]!, faceUp: true }, order: 0, x: 9, y: 9 }], SIZE);
    expect(world.getStore(PositionDef).get(entityOf[1]!)).toEqual({ x: 9, y: 9 });
    expect(world.getStore(RenderableDef).get(entityOf[1]!)).toMatchObject({
      atlas: CARDS_ATLAS,
      frame: cardFrame('Spades', 2),
    });
  });
});

describe('createCardWorld', () => {
  it('creates one entity per card id with the sprite components registered', () => {
    const { entityOf, world } = createCardWorld(3);
    expect(entityOf).toHaveLength(3);
    expect(new Set(entityOf).size).toBe(3);

    world.getStore(PositionDef).set(entityOf[2]!, { x: 1, y: 2 });
    expect(world.getStore(PositionDef).get(entityOf[2]!)).toEqual({ x: 1, y: 2 });
    expect(() => world.getStore(RenderableDef)).not.toThrow();
    expect(() => world.getStore(RenderOrderDef)).not.toThrow();
  });
});
