import { makeSeededRng } from '@pierre/ecs/modules/rng';
import { describe, expect, it } from 'vitest';

import { makeDice, rollDice, toggleHold } from './dice';

describe('makeDice', () => {
  it('makes unheld dice showing 1', () => {
    expect(makeDice(5)).toEqual(Array.from({ length: 5 }, () => ({ held: false, value: 1 })));
  });
});

describe('rollDice', () => {
  it('gives values from 1 to 6', () => {
    let state = 1;
    let dice = makeDice(5);
    for (let i = 0; i < 200; i++) {
      ({ dice, rngState: state } = rollDice(dice, state));
      for (const die of dice) {
        expect(die.value).toBeGreaterThanOrEqual(1);
        expect(die.value).toBeLessThanOrEqual(6);
      }
    }
  });

  it('is deterministic from the dice and the state', () => {
    expect(rollDice(makeDice(5), 42)).toEqual(rollDice(makeDice(5), 42));
    expect(rollDice(makeDice(5), 42).dice).not.toEqual(rollDice(makeDice(5), 43).dice);
  });

  it('keeps held dice and advances the state by one draw per die', () => {
    const start = rollDice(makeDice(5), 7).dice;
    const held = toggleHold(toggleHold(start, 1), 3);
    const { dice, rngState } = rollDice(held, 99);
    expect(dice[1]).toEqual(held[1]);
    expect(dice[3]).toEqual(held[3]);

    const rng = makeSeededRng(99);
    for (let i = 0; i < 5; i++) rng();
    expect(rngState).toBe(rng.state);
  });

  it('rolls an unheld die the same whichever other dice are held', () => {
    const base = makeDice(5);
    const noHold = rollDice(base, 5).dice;
    const someHeld = rollDice(toggleHold(base, 0), 5).dice;
    expect(someHeld.slice(1)).toEqual(noHold.slice(1));
  });

  it('does not mutate its input', () => {
    const dice = toggleHold(makeDice(3), 0);
    const copy = structuredClone(dice);
    rollDice(dice, 3);
    expect(dice).toEqual(copy);
  });
});

describe('toggleHold', () => {
  it('flips one die in a new array', () => {
    const dice = makeDice(3);
    const next = toggleHold(dice, 1);
    expect(next.map(d => d.held)).toEqual([false, true, false]);
    expect(dice.every(d => !d.held)).toBe(true);
    expect(toggleHold(next, 1).map(d => d.held)).toEqual([false, false, false]);
  });
});
