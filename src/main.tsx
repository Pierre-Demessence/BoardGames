/**
 * Board Games — Preact entry point.
 *
 * Loads shared resources (card atlases, audio) once, then renders the App
 * which manages navigation between the hub and individual game components.
 */

import type { GameResources } from './shared';

import { AssetLoader } from '@pierre/ecs/modules/asset-loader';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import { BlackjackGame } from './games/blackjack/index.tsx';
import { SolitaireGame } from './games/solitaire/index.tsx';
import { SpiderGame } from './games/spider/index.tsx';
import { Hub } from './hub.tsx';
import { loadCardAtlases } from './shared/atlas';
import { loadCardAudio } from './shared/audio';
import { BAR_HEIGHT } from './shared/constants';
import styles from './shared/shell.module.css';

// ---------- public API ----------

/**
 * Bootstrap the app into a container element. Returns a dispose function.
 */
export function start(container: HTMLElement): () => void {
  render(<AppLoader />, container);
  return () => render(null, container);
}

// ---------- AppLoader (async resource loading) ----------

function AppLoader() {
  const [resources, setResources] = useState<GameResources | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    let disposed = false;

    void (async () => {
      try {
        const assetLoader = new AssetLoader();
        const AudioContextClass = window.AudioContext ?? (window as unknown as {
          webkitAudioContext: typeof AudioContext;
        }).webkitAudioContext;
        const audioCtx = new AudioContextClass();

        const [atlases, audio] = await Promise.all([
          loadCardAtlases(assetLoader, abort.signal),
          loadCardAudio(assetLoader, audioCtx, abort.signal),
        ]);

        if (disposed)
          return;
        setResources({ atlases, audio, audioCtx } as GameResources);
      }
      catch (err) {
        if (disposed)
          return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        console.error('board-games:', err);
      }
    })();

    return () => {
      disposed = true;
      abort.abort();
    };
  }, []);

  if (error) {
    return (
      <div class={styles.error}>
        Failed to load:
        {error}
      </div>
    );
  }
  if (!resources) {
    return <div class={styles.loading}>Loading…</div>;
  }
  return <App resources={resources} />;
}

// ---------- App (screen router) ----------

type Screen
  = | { type: 'hub' }
    | { type: 'game'; gameId: string };

function App({ resources }: { resources: GameResources }) {
  const [screen, setScreen] = useState<Screen>({ type: 'hub' });

  if (screen.type === 'hub') {
    return (
      <Hub
        resources={resources}
        onSelectGame={gameId => setScreen({ gameId, type: 'game' })}
      />
    );
  }

  const onBack = () => setScreen({ type: 'hub' });

  switch (screen.gameId) {
    case 'blackjack':
      return <BlackjackGame resources={resources} onBack={onBack} />;
    case 'solitaire':
      return <SolitaireGame resources={resources} onBack={onBack} />;
    case 'spider':
      return <SpiderGame resources={resources} onBack={onBack} />;
    default:
      // Unknown game — fall back to hub
      return (
        <Hub
          resources={resources}
          onSelectGame={gameId => setScreen({ gameId, type: 'game' })}
        />
      );
  }
}

// Re-export for internal use (hub fallback)
export { BAR_HEIGHT };
