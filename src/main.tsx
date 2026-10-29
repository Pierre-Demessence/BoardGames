/**
 * Board Games — Preact entry point.
 */

import { render } from 'preact';

import { AppLoader } from './core/app.tsx';

/**
 * Bootstrap the app into a container element. Returns a dispose function that
 * unmounts it and closes the audio context.
 */
export function start(container: HTMLElement): () => void {
  render(<AppLoader />, container);
  return () => render(null, container);
}
