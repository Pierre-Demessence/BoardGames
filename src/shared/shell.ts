/**
 * Game shell — shared DOM + rAF infrastructure for all card games.
 *
 * Eliminates the ~40-line boilerplate repeated in every game's index.ts:
 * canvas creation, control bar, back/new-deal buttons, rAF loop, and
 * dispose/cleanup. Games provide a tick callback and add extra controls.
 */

import { EcsWorld } from '@pierre/ecs';
import { RenderableDef, RenderOrderDef } from '@pierre/ecs/modules/render-canvas2d';
import { PositionDef } from '@pierre/ecs/modules/transform';

import { BAR_HEIGHT } from './constants';

/** Styling shared by all game buttons. */
const BTN_BASE = 'padding:4px 12px;font:inherit;font-weight:600;border-radius:6px;cursor:pointer';
const BTN_PRIMARY = `${BTN_BASE};color:#fff;background:#1f6b4f;border:1px solid #3fbf8f`;
const BTN_SECONDARY = `${BTN_BASE};color:#cde;background:#2a5a4a;border:1px solid #3fbf8f`;

const BAR_CSS = 'display:flex;gap:12px;align-items:center;justify-content:center;'
  + `padding:8px 10px;font:13px system-ui;color:#cde;flex-shrink:0;height:${BAR_HEIGHT}px;box-sizing:border-box`;

/**
 * Create an ECS world pre-registered with the components every card game uses.
 */
export function makeWorld(): EcsWorld {
  const world = new EcsWorld();
  world.registerComponent(PositionDef);
  world.registerComponent(RenderableDef);
  world.registerComponent(RenderOrderDef);
  return world;
}

export interface GameShell {
  bar: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx2d: CanvasRenderingContext2D;
  signal: AbortSignal;

  /** Add a button to the control bar. Returns the element for styling/event binding. */
  addButton(label: string, primary: boolean, ariaLabel?: string): HTMLButtonElement;

  /** Append an arbitrary element (span, etc.) to the control bar. */
  addElement: (el: HTMLElement) => void;

  /** Tear down: cancel rAF, abort listeners, clear DOM. */
  dispose: () => void;

  /** Start the rAF loop. `tick()` is called every frame. */
  startLoop: (tick: () => void) => void;
}

export function createGameShell(
  container: HTMLElement,
  canvasW: number,
  canvasH: number,
  onBack: () => void,
  onNewDeal: () => void,
  cursor: 'default' | 'pointer' = 'pointer',
): GameShell {
  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  canvas.style.cssText = `display:block;width:${canvasW}px;height:${canvasH}px;`
    + `margin:0 auto;border-radius:10px;touch-action:none;cursor:${cursor}`;
  const ctx2d = canvas.getContext('2d')!;

  const bar = document.createElement('div');
  bar.style.cssText = BAR_CSS;

  const backBtn = document.createElement('button');
  backBtn.textContent = '← Games';
  backBtn.setAttribute('aria-label', 'Back to game selection');
  backBtn.style.cssText = BTN_SECONDARY;

  const newDealBtn = document.createElement('button');
  newDealBtn.textContent = 'New deal';
  newDealBtn.setAttribute('aria-label', 'Start a new deal');
  newDealBtn.style.cssText = BTN_PRIMARY;

  bar.append(backBtn, newDealBtn);
  container.append(bar, canvas);

  const abort = new AbortController();
  let disposed = false;
  let rafId = 0;

  backBtn.addEventListener('click', () => {
    disposed = true;
    abort.abort();
    cancelAnimationFrame(rafId);
    container.innerHTML = '';
    onBack();
  }, { signal: abort.signal });

  newDealBtn.addEventListener('click', onNewDeal, { signal: abort.signal });

  const shell: GameShell = {
    bar,
    canvas,
    ctx2d,
    signal: abort.signal,

    addButton(label: string, primary: boolean, ariaLabel?: string): HTMLButtonElement {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.setAttribute('aria-label', ariaLabel ?? label);
      btn.style.cssText = primary ? BTN_PRIMARY : BTN_SECONDARY;
      bar.insertBefore(btn, newDealBtn);
      return btn;
    },

    addElement(el: HTMLElement): void {
      bar.insertBefore(el, newDealBtn);
    },

    dispose(): void {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(rafId);
      container.innerHTML = '';
    },

    startLoop(tick: () => void): void {
      const loop = (): void => {
        if (disposed)
          return;
        tick();
        rafId = requestAnimationFrame(loop);
      };
      loop();
    },
  };

  return shell;
}
