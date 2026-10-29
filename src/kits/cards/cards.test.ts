import { describe, expect, it } from 'vitest';

import { CARD_BACK_FRAME, cardFrame, RANKS, suitColor, SUITS } from './cards';

describe('suitColor', () => {
  it('returns red for Diamonds', () => {
    expect(suitColor('Diamonds')).toBe('red');
  });

  it('returns red for Hearts', () => {
    expect(suitColor('Hearts')).toBe('red');
  });

  it('returns black for Clubs', () => {
    expect(suitColor('Clubs')).toBe('black');
  });

  it('returns black for Spades', () => {
    expect(suitColor('Spades')).toBe('black');
  });
});

describe('cardFrame', () => {
  it('formats Ace as A', () => {
    expect(cardFrame('Hearts', 1)).toBe('cardHeartsA.png');
  });

  it('formats numeric ranks as-is', () => {
    expect(cardFrame('Clubs', 5)).toBe('cardClubs5.png');
    expect(cardFrame('Diamonds', 10)).toBe('cardDiamonds10.png');
  });

  it('formats Jack as J', () => {
    expect(cardFrame('Spades', 11)).toBe('cardSpadesJ.png');
  });

  it('formats Queen as Q', () => {
    expect(cardFrame('Hearts', 12)).toBe('cardHeartsQ.png');
  });

  it('formats King as K', () => {
    expect(cardFrame('Clubs', 13)).toBe('cardClubsK.png');
  });
});

describe('constants', () => {
  it('has 4 suits', () => {
    expect(SUITS).toHaveLength(4);
    expect(SUITS).toEqual(['Clubs', 'Diamonds', 'Hearts', 'Spades']);
  });

  it('has 13 ranks (Ace=1 to King=13)', () => {
    expect(RANKS).toHaveLength(13);
    expect(RANKS[0]).toBe(1);
    expect(RANKS[12]).toBe(13);
  });

  it('defines the card back frame name', () => {
    expect(CARD_BACK_FRAME).toBe('cardBack_blue1.png');
  });
});
