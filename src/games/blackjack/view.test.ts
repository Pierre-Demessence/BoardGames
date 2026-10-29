import { describe, expect, it } from 'vitest';

import { blackjackRules } from './rules';
import { blackjackLayout, placements } from './view';

describe('blackjackLayout', () => {
  it.each([
    { height: 400, width: 1000 },
    { height: 700, width: 1000 },
    { height: 900, width: 500 },
    { height: 300, width: 1600 },
  ])('keeps both hands inside the canvas and apart at $width x $height', (size) => {
    const layout = blackjackLayout(size);
    expect(layout.dealerY).toBeGreaterThanOrEqual(0);
    expect(layout.playerY + layout.cardH).toBeLessThanOrEqual(size.height);
    expect(layout.dealerY + layout.cardH).toBeLessThan(layout.playerY);
  });
});

describe('result banner', () => {
  it.each([
    { height: 300, width: 1600 },
    { height: 400, width: 1000 },
    { height: 700, width: 1000 },
    { height: 900, width: 500 },
  ])('sits between the dealer cards and the player label at $width x $height', (size) => {
    const layout = blackjackLayout(size);
    const top = layout.bannerY - layout.bannerH / 2;
    const bottom = layout.bannerY + layout.bannerH / 2;
    expect(layout.bannerH).toBeGreaterThan(0);
    expect(top).toBeGreaterThanOrEqual(layout.dealerY + layout.cardH);
    expect(bottom).toBeLessThanOrEqual(layout.playerY - Math.round(layout.cardH * 0.4));
  });
});

describe('placements', () => {
  it('places only the dealt cards, dealer above player, with distinct paint orders', () => {
    const state = blackjackRules.setup(4, undefined, 0);
    const layout = blackjackLayout({ height: 700, width: 1000 });
    const list = placements(state, layout);
    expect(list).toHaveLength(state.dealer.length + state.player.length);
    expect(new Set(list.map(p => p.order)).size).toBe(list.length);
    const dealerYs = list.filter(p => state.dealer.includes(p.card)).map(p => p.y);
    expect(dealerYs.every(y => y === layout.dealerY)).toBe(true);
  });

  it('keeps a long hand inside the canvas width', () => {
    const state = blackjackRules.setup(4, undefined, 0);
    state.player = state.deck.splice(0, 9).map(c => ({ ...c, faceUp: true }));
    const layout = blackjackLayout({ height: 700, width: 500 });
    for (const p of placements(state, layout).filter(p => state.player.includes(p.card))) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + layout.cardW).toBeLessThanOrEqual(500);
    }
  });
});
