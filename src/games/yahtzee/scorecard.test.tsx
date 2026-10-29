import type { SeatKind } from '../../core';
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

const SOLO: SeatKind[] = ['human'];

/** The seat to play has rolled `values`; `filled` fills boxes on its sheet. */
function rolled(
  values: readonly DieValue[],
  filled: Partial<Record<Box, number>> = {},
  seats: SeatKind[] = SOLO,
): YahtzeeState {
  const base = yahtzeeRules.setup(1, { seats }, 0);
  return {
    ...base,
    dice: values.map(value => ({ held: false, value })),
    rollsUsed: 1,
    sheets: base.sheets.map((sheet, index) => (index === 0 ? { ...sheet, boxes: { ...sheet.boxes, ...filled } } : sheet)),
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
    const root = mount(yahtzeeRules.setup(1, { seats: SOLO }, 0));
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
    const text = mount({ ...state, sheets: [{ ...state.sheets[0]!, yahtzeeBonuses: 1 }] }).textContent!;
    expect(text).toContain('68 / 63');
    expect(text).toContain('+35');
    expect(text).toContain('+100');
    expect(text).toContain('253');
  });
});

describe('scorecard with several seats', () => {
  const SEATS: SeatKind[] = ['human', 'computer', 'human'];

  it('shows one column per seat and names them', () => {
    const root = mount(rolled([1, 2, 3, 4, 5], {}, SEATS));
    const headers = [...root.querySelectorAll('thead th')].map(th => th.textContent);
    expect(headers).toHaveLength(3);
    expect(headers.join('|')).toContain('Player 1');
    expect(headers.join('|')).toContain('Computer 2');
    expect(headers.join('|')).toContain('Player 3');
    expect(root.querySelector('tbody tr')!.querySelectorAll('td')).toHaveLength(3);
  });

  it('marks the seat to play with an arrow and a current marker, not by color alone', () => {
    const root = mount(rolled([1, 2, 3, 4, 5], {}, SEATS));
    const marked = [...root.querySelectorAll('thead th')].filter(th => th.getAttribute('aria-current') === 'true');
    expect(marked).toHaveLength(1);
    expect(marked[0]!.textContent).toBe('\u25B6 Player 1');
    expect(root.querySelectorAll('thead th')[1]!.textContent).not.toContain('\u25B6');
  });

  it('offers score buttons only in the column of the seat to play', () => {
    const root = mount(rolled([1, 2, 3, 4, 5], {}, SEATS));
    const buttons = [...root.querySelectorAll('button')];
    expect(buttons).toHaveLength(13);
    for (const b of buttons)
      expect(b.closest('td')!.cellIndex).toBe(1);
  });

  it('offers the buttons in the column of whichever seat is to play', () => {
    const base = rolled([1, 2, 3, 4, 5], {}, SEATS);
    const root = mount({ ...base, seats: { ...base.seats, turn: { ...base.seats.turn, active: 2 } } });
    const buttons = [...root.querySelectorAll('button')];
    expect(buttons).toHaveLength(13);
    for (const b of buttons)
      expect(b.closest('td')!.cellIndex).toBe(3);
  });

  it('shows filled boxes of every seat as numbers', () => {
    const root = mount(rolled([1, 2, 3, 4, 5], { chance: 22 }, SEATS));
    const row = [...root.querySelectorAll('tr')].find(r => r.textContent?.startsWith('Chance'))!;
    expect(row.querySelectorAll('td')[0]!.textContent).toBe('22');
    expect(row.querySelectorAll('button')).toHaveLength(0);
  });

  it('offers no button on a computer\'s turn', () => {
    const base = rolled([1, 2, 3, 4, 5], {}, SEATS);
    const state = { ...base, seats: { ...base.seats, turn: { ...base.seats.turn, active: 1 } } };
    const root = mount(state);
    expect(root.querySelectorAll('button')).toHaveLength(0);
    expect(root.querySelector('thead [aria-current="true"]')!.textContent).toContain('Computer 2');
  });

  it('marks no seat once the game is over', () => {
    const base = rolled([1, 2, 3, 4, 5], {}, SEATS);
    const state = { ...base, seats: { ...base.seats, turn: { ...base.seats.turn, rounds: 13 } } };
    const root = mount(state);
    expect(root.querySelector('thead [aria-current]')).toBeNull();
    expect(root.querySelectorAll('button')).toHaveLength(0);
  });
});
