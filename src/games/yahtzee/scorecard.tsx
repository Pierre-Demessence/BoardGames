/**
 * The Yahtzee scorecard: a table beside the canvas, so the text stays crisp and
 * boxes get hover and keyboard focus. One column per seat; with several seats the seat
 * to play has an arrow and a bold header. In that column, on a human's turn, an open
 * box that may be scored now is a button showing its would-be score in italics with a
 * dashed outline; a filled box shows its score in bold. Nothing relies on color alone.
 */

import type { Box, YahtzeeState } from './rules';

import { isComputerTurn, seatName, seatToPlay } from '../../core';
import {
  canScore,
  LOWER_BOXES,
  scoreFor,
  totals,
  UPPER_BONUS_THRESHOLD,
  UPPER_BOXES,
  yahtzeeRules,
} from './rules';
import styles from './scorecard.module.css';

export interface ScorecardProps {
  /** Whether open boxes show their would-be score; false while the dice tumble. */
  showPreviews: boolean;
  state: YahtzeeState;
  /** Called when the player picks an open box. */
  onScore: (box: Box) => void;
}

export const BOX_LABELS: Record<Box, string> = {
  chance: 'Chance',
  fives: 'Fives',
  fourOfAKind: 'Four of a Kind',
  fours: 'Fours',
  fullHouse: 'Full House',
  largeStraight: 'Large Straight',
  ones: 'Ones',
  sixes: 'Sixes',
  smallStraight: 'Small Straight',
  threeOfAKind: 'Three of a Kind',
  threes: 'Threes',
  twos: 'Twos',
  yahtzee: 'Yahtzee',
};

export function Scorecard({ onScore, showPreviews, state }: ScorecardProps) {
  const { kinds } = state.seats;
  const multi = state.sheets.length > 1;
  const over = yahtzeeRules.status(state) === 'won';
  const playing = over ? null : seatToPlay(state.seats);
  const canPick = showPreviews && !over && !isComputerTurn(state.seats);
  const sums = state.sheets.map(totals);

  const boxCell = (box: Box, seat: number) => {
    const value = state.sheets[seat]!.boxes[box];
    let cell = null;
    if (value !== null) {
      cell = <strong>{value}</strong>;
    }
    else if (seat === playing && canPick && canScore(state, box)) {
      const preview = scoreFor(state, box);
      cell = (
        <button
          class={styles.open}
          aria-label={`Score ${preview} in ${BOX_LABELS[box]}`}
          onClick={() => onScore(box)}
        >
          {preview}
        </button>
      );
    }
    return <td key={seat}>{cell}</td>;
  };

  const boxRow = (box: Box) => (
    <tr key={box}>
      <th scope="row">{BOX_LABELS[box]}</th>
      {state.sheets.map((_, seat) => boxCell(box, seat))}
    </tr>
  );

  const sumRow = (label: string, text: (seat: number) => string, rowClass: string) => (
    <tr class={rowClass}>
      <th scope="row">{label}</th>
      {state.sheets.map((_, seat) => <td key={seat}>{text(seat)}</td>)}
    </tr>
  );

  return (
    <table class={multi ? `${styles.card} ${styles.multi}` : styles.card} aria-label="Scorecard">
      {multi && (
        <thead>
          <tr>
            <td />
            {state.sheets.map((_, seat) => (
              <th
                key={seat}
                scope="col"
                class={seat === playing ? styles.current : undefined}
                aria-current={seat === playing ? 'true' : undefined}
              >
                {`${seat === playing ? '▶ ' : ''}${seatName(kinds, seat)}`}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {UPPER_BOXES.map(boxRow)}
        {sumRow('Upper total', seat => `${sums[seat]!.upper} / ${UPPER_BONUS_THRESHOLD}`, styles.sum!)}
        {sumRow(`Bonus (${UPPER_BONUS_THRESHOLD}+)`, seat => (sums[seat]!.upperBonus > 0 ? `+${sums[seat]!.upperBonus}` : '0'), styles.sum!)}
        {LOWER_BOXES.map(boxRow)}
        {sumRow('Yahtzee bonus', seat => (sums[seat]!.yahtzeeBonus > 0 ? `+${sums[seat]!.yahtzeeBonus}` : '0'), styles.sum!)}
        {sumRow('Total', seat => String(sums[seat]!.grand), styles.total!)}
      </tbody>
    </table>
  );
}
