import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { start } from './main.tsx';

vi.mock('./kits/cards/atlas', () => ({ loadCardAtlases: vi.fn(async () => ({})) }));
vi.mock('./kits/cards/audio', () => ({ loadCardAudio: vi.fn(async () => ({})) }));

let closeSpy: ReturnType<typeof vi.fn>;
let created: number;

beforeEach(() => {
  closeSpy = vi.fn(async () => {});
  created = 0;
  (window as unknown as { AudioContext: unknown }).AudioContext = class {
    close = closeSpy;
    resume = vi.fn(async () => {});
    state = 'suspended';
    constructor() {
      created++;
    }
  };
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('start', () => {
  it('closes the AudioContext when the dispose function runs', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const dispose = start(container);
    await vi.waitFor(() => expect(container.textContent).toContain('Solitaire'));
    expect(created).toBe(1);
    expect(closeSpy).not.toHaveBeenCalled();

    dispose();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('closes the AudioContext when disposed while still loading', async () => {
    const { loadCardAtlases } = await import('./kits/cards/atlas');
    let release!: () => void;
    vi.mocked(loadCardAtlases).mockImplementationOnce(
      () => new Promise((resolve) => {
        release = () => resolve({} as never);
      }),
    );
    const container = document.createElement('div');
    document.body.append(container);
    const dispose = start(container);
    await vi.waitFor(() => expect(created).toBe(1));

    dispose();
    release();
    await vi.waitFor(() => expect(closeSpy).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
