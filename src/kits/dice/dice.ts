/**
 * The dice model: plain JSON, no ECS. A roll takes and returns the random
 * generator's position, so the same state always rolls the same way.
 */

import { makeSeededRng, randomInt } from '@pierre/ecs/modules/rng';

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export interface Die {
  held: boolean;
  value: DieValue;
}

export const DIE_FACES = 6;

/** `count` dice showing 1, none held. */
export function makeDice(count: number): Die[] {
  return Array.from({ length: count }, () => ({ held: false, value: 1 }));
}

/**
 * Rolls the dice that are not held. Every die consumes one draw whether it is held
 * or not, so a die's next value never depends on which other dice are held.
 * `rngState` is a `SeededRng` state; the returned one follows the draws.
 */
export function rollDice(
  dice: readonly Die[],
  rngState: number,
): { dice: Die[]; rngState: number } {
  const rng = makeSeededRng(0);
  rng.state = rngState;
  const rolled = dice.map((die) => {
    const value = (randomInt(DIE_FACES, rng) + 1) as DieValue;
    return die.held ? { ...die } : { ...die, value };
  });
  return { dice: rolled, rngState: rng.state };
}

/** A copy of the dice with the hold of die `index` flipped. */
export function toggleHold(dice: readonly Die[], index: number): Die[] {
  return dice.map((die, i) => (i === index ? { ...die, held: !die.held } : { ...die }));
}
