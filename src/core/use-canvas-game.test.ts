import type { CanvasGame, CanvasGameOptions } from './use-canvas-game';

import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCanvasGame } from './use-canvas-game';

type ResizeCallback = (entries: { contentRect: { height: number; width: number } }[]) => void;

let frames: Map<number, () => void>;
let nextFrame: number;
let resizeCallback: ResizeCallback | null;
let observerDisconnected: boolean;
let context: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  frames = new Map();
  nextFrame = 1;
  resizeCallback = null;
  observerDisconnected = false;
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id);
  });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeCallback) {
      resizeCallback = callback;
    }

    disconnect(): void {
      observerDisconnected = true;
    }

    observe(): void {}
    unobserve(): void {}
  });
  context = { setTransform: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Runs the frames requested so far, once; returns how many ran. */
function runFrames(): number {
  const pending = [...frames.values()];
  frames.clear();
  for (const frame of pending) frame();
  return pending.length;
}

function mount(options: CanvasGameOptions) {
  const container = document.createElement('div');
  document.body.append(container);
  let game!: CanvasGame;
  function Harness() {
    game = useCanvasGame(options);
    return h('div', { ref: game.areaRef }, h('canvas', { ref: game.canvasRef }));
  }
  act(() => {
    render(h(Harness, {}), container);
  });
  return {
    container,
    get game() {
      return game;
    },
    resize(width: number, height: number) {
      resizeCallback!([{ contentRect: { height, width } }]);
    },
    unmount() {
      act(() => {
        render(null, container);
      });
    },
  };
}

describe('useCanvasGame', () => {
  it('draws once on the first size, then no frame while nothing moves', () => {
    const draw = vi.fn();
    const view = mount({ draw });
    expect(draw).not.toHaveBeenCalled();

    view.resize(400, 300);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0]![1]).toEqual({ height: 300, width: 400 });

    expect(runFrames()).toBe(0);
    expect(runFrames()).toBe(0);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('draws one frame for any number of invalidate calls', () => {
    const draw = vi.fn();
    const view = mount({ draw });
    view.resize(400, 300);
    draw.mockClear();

    view.game.invalidate();
    view.game.invalidate();
    view.game.invalidate();
    expect(runFrames()).toBe(1);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(runFrames()).toBe(0);
  });

  it('keeps drawing while animating() returns true, then stops', () => {
    let remaining = 3;
    const draw = vi.fn(() => {
      remaining--;
    });
    const view = mount({ draw, animating: () => remaining > 0 });
    view.resize(400, 300);
    // The resize frame ran with 2 left; two more frames finish it.
    expect(runFrames()).toBe(1);
    expect(runFrames()).toBe(1);
    expect(runFrames()).toBe(0);
    expect(draw).toHaveBeenCalledTimes(3);
  });

  it('sizes the backing store by the pixel density and scales the context', () => {
    vi.stubGlobal('devicePixelRatio', 1.5);
    const draw = vi.fn();
    const onResize = vi.fn();
    const view = mount({ draw, onResize });
    view.resize(400.7, 300);

    const canvas = view.container.querySelector('canvas')!;
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(450);
    expect(canvas.style.width).toBe('400px');
    expect(canvas.style.height).toBe('300px');
    expect(context.setTransform).toHaveBeenLastCalledWith(1.5, 0, 0, 1.5, 0, 0);
    expect(onResize).toHaveBeenCalledWith({ height: 300, width: 400 });
  });

  it('re-lays out on a new size but ignores an unchanged one', () => {
    const draw = vi.fn();
    const onResize = vi.fn();
    const view = mount({ draw, onResize });
    view.resize(400, 300);
    view.resize(400, 300);
    expect(onResize).toHaveBeenCalledTimes(1);
    view.resize(500, 300);
    expect(onResize).toHaveBeenCalledTimes(2);
    expect(draw).toHaveBeenCalledTimes(2);
    view.resize(0, 0);
    expect(onResize).toHaveBeenCalledTimes(2);
  });

  it('passes pointer events in CSS pixels relative to the canvas', () => {
    const onPointerDown = vi.fn();
    const view = mount({ draw: vi.fn(), onPointerDown });
    const canvas = view.container.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20 } as DOMRect);

    canvas.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 110, clientY: 70 }));
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerDown.mock.calls[0]![0]).toEqual({ x: 100, y: 50 });
  });

  it('stops frames and listeners on unmount', () => {
    const draw = vi.fn();
    const onPointerDown = vi.fn();
    const view = mount({ draw, onPointerDown });
    view.resize(400, 300);
    view.game.invalidate();
    const canvas = view.container.querySelector('canvas')!;

    view.unmount();
    expect(observerDisconnected).toBe(true);
    expect(frames.size).toBe(0);
    canvas.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
    expect(onPointerDown).not.toHaveBeenCalled();
    view.game.invalidate();
    expect(frames.size).toBe(0);
  });
});
