import type { SeatKind } from './seats';

import { render } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SeatPicker } from './seat-picker';

let container: HTMLElement | null = null;

function mount(props: Partial<Parameters<typeof SeatPicker>[0]> = {}): HTMLElement {
  container = document.createElement('div');
  document.body.append(container);
  render(<SeatPicker initial={['human']} maxSeats={4} onStart={() => {}} {...props} />, container);
  return container;
}

/** Preact batches state updates; wait for the DOM to catch up. */
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
    ?? [...root.querySelectorAll('button')].find(b => b.textContent === label);
  if (!found)
    throw new Error(`no button ${label}`);
  return found as HTMLButtonElement;
}

const seatCount = (root: HTMLElement): number => root.querySelectorAll('li').length;

afterEach(() => {
  if (container)
    render(null, container);
  container?.remove();
  container = null;
});

describe('seatPicker', () => {
  it('lists the initial seats with a Human and a Computer choice each', () => {
    const root = mount({ initial: ['human', 'computer'] });
    expect(seatCount(root)).toBe(2);
    expect(button(root, 'Seat 1: Human').getAttribute('aria-pressed')).toBe('true');
    expect(button(root, 'Seat 1: Computer').getAttribute('aria-pressed')).toBe('false');
    expect(button(root, 'Seat 2: Computer').getAttribute('aria-pressed')).toBe('true');
    expect(button(root, 'Seat 2: Computer').textContent).toContain('✓');
  });

  it('adds seats up to the maximum', async () => {
    const root = mount({ maxSeats: 3 });
    button(root, 'Add seat').click();
    await flush();
    button(root, 'Add seat').click();
    await flush();
    expect(seatCount(root)).toBe(3);
    expect(button(root, 'Add seat').disabled).toBe(true);
  });

  it('removes seats down to the minimum', async () => {
    const root = mount({ initial: ['human', 'human'] });
    button(root, 'Remove seat 2').click();
    await flush();
    expect(seatCount(root)).toBe(1);
    expect(button(root, 'Remove seat 1').disabled).toBe(true);
  });

  it('reports the chosen kinds on Start', async () => {
    const onStart = vi.fn();
    const root = mount({ onStart });
    button(root, 'Add seat').click();
    await flush();
    button(root, 'Seat 2: Computer').click();
    await flush();
    root.querySelector('form')!.requestSubmit();
    expect(onStart).toHaveBeenCalledWith(['human', 'computer'] satisfies SeatKind[]);
  });

  it('cancels on Escape', () => {
    const onCancel = vi.fn();
    const root = mount({ onCancel });
    root.querySelector('form')!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows Cancel only when it can be cancelled', () => {
    const without = mount();
    expect([...without.querySelectorAll('button')].some(b => b.textContent === 'Cancel')).toBe(false);
    render(null, without);
    without.remove();

    const onCancel = vi.fn();
    const root = mount({ onCancel });
    button(root, 'Cancel').click();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
