/**
 * The canvas plumbing every game shares: it sizes the canvas to its area at the
 * display's pixel density, hands pointer events to the game in CSS pixels, and
 * draws a frame only when asked to or while the game is animating.
 */

import type { RefObject } from 'preact';

import { useCallback, useEffect, useRef } from 'preact/hooks';

export interface Size {
  height: number;
  width: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface CanvasGameOptions {
  /** Whether something still moves; the hook keeps drawing frames while it returns true. */
  animating?: () => boolean;
  /** Draws one frame. The context is scaled so coordinates are CSS pixels. */
  draw: (ctx: CanvasRenderingContext2D, size: Size) => void;
  onDoubleClick?: (point: Point, event: MouseEvent) => void;
  onPointerCancel?: (event: PointerEvent) => void;
  onPointerDown?: (point: Point, event: PointerEvent) => void;
  onPointerMove?: (point: Point, event: PointerEvent) => void;
  onPointerUp?: (point: Point, event: PointerEvent) => void;
  /** The area changed size (also called once with the first size), before the frame is drawn. */
  onResize?: (size: Size) => void;
}

export interface CanvasGame {
  /** Put on the element that fills the space for the canvas; the hook measures it. */
  areaRef: RefObject<HTMLDivElement>;
  /** Put on the canvas inside the area. */
  canvasRef: RefObject<HTMLCanvasElement>;
  /** Asks for one frame. Many calls before the next frame draw once. */
  invalidate: () => void;
}

/**
 * The options may change on every render: the latest ones are always used, so
 * callbacks can read the component's refs without being memoized.
 */
export function useCanvasGame(options: CanvasGameOptions): CanvasGame {
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const scheduleRef = useRef<() => void>(() => {});
  const invalidate = useCallback(() => scheduleRef.current(), []);

  useEffect(() => {
    const area = areaRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!area || !canvas || !ctx)
      return;

    let size: Size | null = null;
    let density = 1;
    let frame: number | null = null;
    let disposed = false;

    const paint = (): void => {
      if (size === null || disposed)
        return;
      ctx.setTransform(density, 0, 0, density, 0, 0);
      optionsRef.current.draw(ctx, size);
      if (optionsRef.current.animating?.() === true)
        schedule();
    };

    function schedule(): void {
      if (frame !== null || disposed)
        return;
      frame = requestAnimationFrame(() => {
        frame = null;
        paint();
      });
    }
    scheduleRef.current = schedule;

    const applySize = (width: number, height: number): void => {
      const next = { height: Math.floor(height), width: Math.floor(width) };
      const nextDensity = window.devicePixelRatio || 1;
      if (next.width < 1 || next.height < 1)
        return;
      if (size?.width === next.width && size.height === next.height && density === nextDensity)
        return;
      size = next;
      density = nextDensity;
      canvas.width = Math.round(next.width * density);
      canvas.height = Math.round(next.height * density);
      canvas.style.width = `${next.width}px`;
      canvas.style.height = `${next.height}px`;
      optionsRef.current.onResize?.(next);
      // Resizing clears the canvas, so draw now instead of on the next frame.
      paint();
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries.at(-1);
      if (entry)
        applySize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(area);

    const toPoint = (event: MouseEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const ctrl = new AbortController();
    const { signal } = ctrl;
    canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0)
        return;
      canvas.setPointerCapture?.(event.pointerId);
      optionsRef.current.onPointerDown?.(toPoint(event), event);
    }, { signal });
    canvas.addEventListener('pointermove', (event) => {
      optionsRef.current.onPointerMove?.(toPoint(event), event);
    }, { signal });
    canvas.addEventListener('pointerup', (event) => {
      if (canvas.hasPointerCapture?.(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      optionsRef.current.onPointerUp?.(toPoint(event), event);
    }, { signal });
    canvas.addEventListener('pointercancel', (event) => {
      optionsRef.current.onPointerCancel?.(event);
    }, { signal });
    canvas.addEventListener('dblclick', (event) => {
      optionsRef.current.onDoubleClick?.(toPoint(event), event);
    }, { signal });

    return () => {
      disposed = true;
      ctrl.abort();
      observer.disconnect();
      if (frame !== null)
        cancelAnimationFrame(frame);
      scheduleRef.current = () => {};
    };
  }, []);

  return { areaRef, canvasRef, invalidate };
}
