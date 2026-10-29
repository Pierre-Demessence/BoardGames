import type { DieValue } from '../../kits/dice';
import type { Box, YahtzeeState } from './rules';

import { render } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { yahtzeeRules } from './rules';
import { Scorecard } from './scorecard';

let container: HTMLElement | null = null;

function mount(state: YahtzeeState, showPreviews = true, onScore: (box: Box) => void = () => {}): HTMLElement {
  container = document.createElement('div');
  document.body.append(container);
  render(<Scorecard state={state} showPreviews={showPreviews} onScore={onScore} />, container);
  return container;
}

function rolled(values: readonly DieValue[], filled: Partial<Record<Box, number>> = {}): YahtzeeState {
  const base = yahtzeeRules.setup(1, undefined, 0);
  return {
    ...base,
    boxes: { ...base.boxes, ...filled },
    dice: values.map(value => ({ held: false, value })),
    rollsUsed: 1,
  };
}

afterEach(() => {
  if (container)
    render(null, container);
  container?.remove();
  container = null;
});

describe('scorecard', () => {
  it('shows no previews before the first roll', () => {
    const root = mount(yahtzeeRules.setup(1, undefined, 0));
    expect(root.querySelectorAll('button')).toHaveLength(0);
  });

  it('shows no previews while the dice tumble', () => {
    const root = mount(rolled([1, 2, 3, 4, 5]), false);
    expect(root.querySelectorAll('button')).toHaveLength(0);
  });

  it('shows the would-be score of every open box after a roll', () => {
    const root = mount(rolled([2, 2, 2, 5, 5]));
    const buttons = [...root.querySelectorAll('button')];
    expect(buttons).toHaveLength(13);
    expect(root.querySelector('[aria-label="Score 6 in Twos"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="Score 25 in Full House"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="Score 16 in Chance"]')).not.toBeNull();
  });

  it('sends the box when a preview is clicked', () => {
    const onScore = vi.fn();
    const root = mount(rolled([2, 2, 2, 5, 5]), true, onScore);
    root.querySelector<HTMLButtonElement>('[aria-label="Score 25 in Full House"]')!.click();
    expect(onScore).toHaveBeenCalledWith('fullHouse');
  });

  it('shows a filled box as a plain number, not a button', () => {
    const root = mount(rolled([1, 2, 3, 4, 5], { chance: 22 }));
    expect(root.querySelectorAll('button')).toHaveLength(12);
    const row = [...root.querySelectorAll('tr')].find(r => r.textContent?.startsWith('Chance'))!;
    expect(row.querySelector('button')).toBeNull();
    expect(row.querySelector('strong')?.textContent).toBe('22');
  });

  it('offers only the boxes the joker rule allows', () => {
    const root = mount(rolled([4, 4, 4, 4, 4], { yahtzee: 50 }));
    const buttons = [...root.querySelectorAll('button')];
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(['Score 20 in Fours']);
  });

  it('shows the upper progress, the bonuses and the total', () => {
    const state = rolled([1, 2, 3, 4, 5], {
      fives: 25,
      fours: 16,
      ones: 3,
      sixes: 24,
      yahtzee: 50,
    });
    const text = mount({ ...state, yahtzeeBonuses: 1 }).textContent!;
    expect(text).toContain('68 / 63');
    expect(text).toContain('+35');
    expect(text).toContain('+100');
    expect(text).toContain('253');
  });
});
