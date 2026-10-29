import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadResources, resumeOnFirstPress } from './resources';

vi.mock('../kits/cards/atlas', () => ({ loadCardAtlases: vi.fn() }));
vi.mock('../kits/cards/audio', () => ({ loadCardAudio: vi.fn() }));
vi.mock('../kits/dice/atlas', () => ({ loadDiceAtlases: vi.fn() }));
vi.mock('../kits/dice/audio', () => ({ loadDiceAudio: vi.fn() }));

const { loadCardAtlases } = await import('../kits/cards/atlas');
const { loadCardAudio } = await import('../kits/cards/audio');
const { loadDiceAtlases } = await import('../kits/dice/atlas');
const { loadDiceAudio } = await import('../kits/dice/audio');

interface FakeAudioContext {
  close: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  state: string;
}

let contexts: FakeAudioContext[];

function installAudioContext(): void {
  contexts = [];
  class FakeContext implements FakeAudioContext {
    close = vi.fn(async () => {});
    state = 'suspended';

    resume = vi.fn(async () => {
      this.state = 'running';
    });

    constructor() {
      contexts.push(this);
    }
  }
  vi.stubGlobal('AudioContext', FakeContext);
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
}

beforeEach(() => {
  installAudioContext();
  vi.mocked(loadCardAtlases).mockImplementation(async (_loader, _signal, registry) => {
    registry.add('cards', {} as never, {});
  });
  vi.mocked(loadDiceAtlases).mockResolvedValue(undefined);
  vi.mocked(loadCardAudio).mockResolvedValue({ audio: true } as never);
  vi.mocked(loadDiceAudio).mockResolvedValue({ dice: true } as never);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loadResources', () => {
  it('returns atlases, audio and the audio context', async () => {
    const resources = await loadResources(new AbortController().signal);
    expect(resources.audio).toEqual({ audio: true });
    expect(resources.diceAudio).toEqual({ dice: true });
    expect(resources.audioCtx).toBe(contexts[0]);
    expect(contexts[0]!.close).not.toHaveBeenCalled();
  });

  it('hands one atlas registry to the card and the dice loaders', async () => {
    const resources = await loadResources(new AbortController().signal);
    expect(vi.mocked(loadCardAtlases).mock.lastCall![2]).toBe(resources.atlases);
    expect(vi.mocked(loadDiceAtlases).mock.lastCall![2]).toBe(resources.atlases);
  });

  it('runs silent when the clips fail to load', async () => {
    vi.mocked(loadCardAudio).mockRejectedValue(new Error('decode failed'));
    const resources = await loadResources(new AbortController().signal);
    expect(resources.atlases).toBeDefined();
    expect(resources.audio).toBeNull();
    expect(resources.diceAudio).toBeNull();
    expect(resources.audioCtx).toBeNull();
    expect(contexts[0]!.close).toHaveBeenCalled();
  });

  it('runs silent when only the dice clips fail to load', async () => {
    vi.mocked(loadDiceAudio).mockRejectedValue(new Error('decode failed'));
    const resources = await loadResources(new AbortController().signal);
    expect(resources.audio).toBeNull();
    expect(resources.diceAudio).toBeNull();
    expect(resources.audioCtx).toBeNull();
  });

  it('runs silent when the browser has no audio context', async () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = undefined;
    const resources = await loadResources(new AbortController().signal);
    expect(resources.atlases).toBeDefined();
    expect(resources.audio).toBeNull();
    expect(resources.diceAudio).toBeNull();
    expect(resources.audioCtx).toBeNull();
  });

  it('runs silent when creating the audio context throws', async () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = class {
      constructor() {
        throw new Error('blocked');
      }
    };
    const resources = await loadResources(new AbortController().signal);
    expect(resources.audio).toBeNull();
    expect(resources.audioCtx).toBeNull();
  });

  it('rejects and closes the audio context when the atlases fail', async () => {
    vi.mocked(loadCardAtlases).mockRejectedValue(new Error('no atlas'));
    await expect(loadResources(new AbortController().signal)).rejects.toThrow('no atlas');
    expect(contexts[0]!.close).toHaveBeenCalled();
  });
});

describe('resumeOnFirstPress', () => {
  it('resumes on a press, then stops listening once running', async () => {
    const ctx = new (window.AudioContext as unknown as new () => FakeAudioContext)();
    const target = new EventTarget();
    resumeOnFirstPress(ctx as unknown as AudioContext, target);

    target.dispatchEvent(new Event('pointerdown'));
    await vi.waitFor(() => expect(ctx.state).toBe('running'));
    expect(ctx.resume).toHaveBeenCalledTimes(1);

    target.dispatchEvent(new Event('pointerup'));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('does nothing without an audio context', () => {
    expect(() => resumeOnFirstPress(null, new EventTarget())()).not.toThrow();
  });
});
