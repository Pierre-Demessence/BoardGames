/**
 * App shell: loads the shared resources once, then routes between the hub and
 * the selected game, which is loaded on demand.
 */

import type { ComponentType } from 'preact';

import type { GameDef, GameProps } from './registry';
import type { GameResources } from './resources';

import { useEffect, useState } from 'preact/hooks';

import { Hub } from '../hub.tsx';
import styles from './app.module.css';
import { GAMES } from './registry';
import { closeResources, loadResources, resumeOnFirstPress } from './resources';

type Screen
  = | { type: 'hub' }
    | { game: GameDef; type: 'game' };

export function App({ resources }: { resources: GameResources }) {
  const [screen, setScreen] = useState<Screen>({ type: 'hub' });

  useEffect(() => resumeOnFirstPress(resources.audioCtx), [resources]);

  if (screen.type === 'game') {
    return (
      <GameScreen
        key={screen.game.id}
        def={screen.game}
        resources={resources}
        onBack={() => setScreen({ type: 'hub' })}
      />
    );
  }
  return (
    <Hub
      onSelectGame={(gameId) => {
        const game = GAMES.find(g => g.id === gameId);
        if (game)
          setScreen({ game, type: 'game' });
      }}
    />
  );
}

export function AppLoader() {
  const [resources, setResources] = useState<GameResources | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    let loaded: GameResources | null = null;

    loadResources(abort.signal).then(
      (result) => {
        if (abort.signal.aborted) {
          closeResources(result);
          return;
        }
        loaded = result;
        setResources(result);
      },
      (err: unknown) => {
        if (abort.signal.aborted)
          return;
        setError(err instanceof Error ? err.message : String(err));
        console.error('board-games:', err);
      },
    );

    return () => {
      abort.abort();
      if (loaded)
        closeResources(loaded);
    };
  }, []);

  if (error) {
    return (
      <div class={styles.error}>
        Failed to load:
        {' '}
        {error}
      </div>
    );
  }
  if (!resources)
    return <div class={styles.loading}>Loading…</div>;
  return <App resources={resources} />;
}

function GameScreen({ def, onBack, resources }: GameProps & { def: GameDef }) {
  const [Game, setGame] = useState<ComponentType<GameProps> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    def.load().then(
      (component) => {
        if (!cancelled)
          setGame(() => component);
      },
      (err: unknown) => {
        if (cancelled)
          return;
        setError(err instanceof Error ? err.message : String(err));
        console.error('board-games:', err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [def]);

  if (error) {
    return (
      <div class={styles.error}>
        Failed to load
        {' '}
        {def.name}
        :
        {' '}
        {error}
        <div>
          <button class={styles.back} onClick={onBack}>← Games</button>
        </div>
      </div>
    );
  }
  if (!Game)
    return <div class={styles.loading}>Loading…</div>;
  return <Game resources={resources} onBack={onBack} />;
}
