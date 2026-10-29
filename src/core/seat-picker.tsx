/**
 * The form shown before a multi-seat game: one row per seat with a Human or Computer
 * choice, Add and Remove for the number of seats, and Start. Cancel appears when a
 * game is already running and the player may keep it.
 */

import type { SeatKind } from './seats';

import { useEffect, useRef, useState } from 'preact/hooks';

import styles from './seat-picker.module.css';

export interface SeatPickerProps {
  /** The seats shown first. */
  initial: readonly SeatKind[];
  maxSeats: number;
  minSeats?: number;
  /** Shows a Cancel button when set. */
  onCancel?: () => void;
  onStart: (kinds: SeatKind[]) => void;
}

const KINDS: readonly { kind: SeatKind; label: string }[] = [
  { kind: 'human', label: 'Human' },
  { kind: 'computer', label: 'Computer' },
];

export function SeatPicker({ initial, maxSeats, minSeats = 1, onCancel, onStart }: SeatPickerProps) {
  const [kinds, setKinds] = useState<SeatKind[]>([...initial]);
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => startRef.current?.focus(), []);

  const setKind = (seat: number, kind: SeatKind): void =>
    setKinds(current => current.map((existing, index) => (index === seat ? kind : existing)));

  return (
    <form
      class={styles.panel}
      role="dialog"
      aria-label="Players"
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onCancel)
          onCancel();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        onStart(kinds);
      }}
    >
      <h2 class={styles.title}>Players</h2>
      <ul class={styles.rows}>
        {kinds.map((kind, seat) => (
          <li key={seat} class={styles.row}>
            <span class={styles.seatLabel}>{`Seat ${seat + 1}`}</span>
            {KINDS.map(choice => (
              <button
                key={choice.kind}
                type="button"
                class={styles.kind}
                aria-label={`Seat ${seat + 1}: ${choice.label}`}
                aria-pressed={kind === choice.kind}
                onClick={() => setKind(seat, choice.kind)}
              >
                {kind === choice.kind ? `✓ ${choice.label}` : choice.label}
              </button>
            ))}
            <button
              type="button"
              class={styles.action}
              aria-label={`Remove seat ${seat + 1}`}
              disabled={kinds.length <= minSeats}
              onClick={() => setKinds(current => current.filter((_, index) => index !== seat))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        class={styles.action}
        disabled={kinds.length >= maxSeats}
        onClick={() => setKinds(current => [...current, 'human'])}
      >
        Add seat
      </button>
      <div class={styles.footer}>
        {onCancel && (
          <button type="button" class={styles.action} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button ref={startRef} type="submit" class={styles.start}>
          Start
        </button>
      </div>
    </form>
  );
}
