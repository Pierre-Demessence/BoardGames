/**
 * The Yahtzee scorecard: a table beside the canvas, so the text stays crisp and
 * boxes get hover and keyboard focus. An open box that may be scored now is a
 * button showing its would-be score in italics with a dashed outline; a filled
 * box shows its score in bold. Nothing relies on color alone.
 */

import type { Box, YahtzeeState } from './rules';

import {
  canScore,
  LOWER_BOXES,
  scoreFor,
  totals,
  UPPER_BONUS_THRESHOLD,
  UPPER_BOXES,
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
  const sums = totals(state);

  const boxRow = (box: Box) => {
    const value = state.boxes[box];
    const label = BOX_LABELS[box];
    let cell;
    if (value !== null) {
      cell = <strong>{value}</strong>;
    }
    else if (showPreviews && canScore(state, box)) {
      const preview = scoreFor(state, box);
      cell = (
        <button
          class={styles.open}
          aria-label={`Score ${preview} in ${label}`}
          onClick={() => onScore(box)}
        >
          {preview}
        </button>
      );
    }
    else {
      cell = null;
    }
    return (
      <tr key={box}>
        <th scope="row">{label}</th>
        <td>{cell}</td>
      </tr>
    );
  };

  return (
    <table class={styles.card} aria-label="Scorecard">
      <tbody>
        {UPPER_BOXES.map(boxRow)}
        <tr class={styles.sum}>
          <th scope="row">Upper total</th>
          <td>{`${sums.upper} / ${UPPER_BONUS_THRESHOLD}`}</td>
        </tr>
        <tr class={styles.sum}>
          <th scope="row">{`Bonus (${UPPER_BONUS_THRESHOLD}+)`}</th>
          <td>{sums.upperBonus > 0 ? `+${sums.upperBonus}` : '0'}</td>
        </tr>
        {LOWER_BOXES.map(boxRow)}
        <tr class={styles.sum}>
          <th scope="row">Yahtzee bonus</th>
          <td>{sums.yahtzeeBonus > 0 ? `+${sums.yahtzeeBonus}` : '0'}</td>
        </tr>
        <tr class={styles.total}>
          <th scope="row">Total</th>
          <td>{sums.grand}</td>
        </tr>
      </tbody>
    </table>
  );
}
