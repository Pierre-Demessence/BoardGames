/**
 * Board Games — entry point.
 *
 * Loads shared resources (card atlases, audio) once, then boots the hub
 * which lets the user pick a game. Each game reuses the same resources.
 */

import { AssetLoader } from '@pierre/ecs/modules/asset-loader';

import { loadCardAtlases } from './shared/atlas';
import { loadCardAudio } from './shared/audio';
import { startHub } from './hub';

export function start(container: HTMLElement): () => void {
  container.innerHTML = '';

  const loading = document.createElement('div');
  loading.textContent = 'Loading…';
  loading.style.cssText = 'text-align:center;padding:60px;font:18px system-ui;color:#cde;';
  container.append(loading);

  const abort = new AbortController();
  let disposed = false;

  void (async () => {
    try {
      const assetLoader = new AssetLoader();
      const audioCtx = new (window.AudioContext ?? (window as unknown as {
        webkitAudioContext: typeof AudioContext;
      }).webkitAudioContext)();

      const [atlases, audio] = await Promise.all([
        loadCardAtlases(assetLoader, abort.signal),
        loadCardAudio(assetLoader, audioCtx, abort.signal),
      ]);

      if (disposed)
        return;

      startHub(container, { atlases, audio, audioCtx });
    }
    catch (error) {
      if (disposed)
        return;
      const message = error instanceof Error ? error.message : String(error);
      container.innerHTML = '';
      const err = document.createElement('div');
      err.textContent = `Failed to load: ${message}`;
      err.style.cssText = 'text-align:center;padding:60px;font:18px system-ui;color:#f88;';
      container.append(err);
      console.error('board-games:', error);
    }
  })();

  return () => {
    disposed = true;
    abort.abort();
    container.innerHTML = '';
  };
}
