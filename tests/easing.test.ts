import { describe, expect, it } from 'vitest';
import { EASING_NAMES, ease } from '../src/core/effects/easing';

describe('イージング', () => {
  it('端点は 0 と 1', () => {
    for (const name of EASING_NAMES) {
      expect(ease(name, 0)).toBeCloseTo(0, 5);
      expect(ease(name, 1)).toBeCloseTo(1, 5);
    }
  });

  it('linear の中点は 0.5', () => {
    expect(ease('linear', 0.5)).toBe(0.5);
  });

  it('bounceOut の途中は範囲内で端点と違う', () => {
    const mid = ease('bounceOut', 0.5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1.2);
    expect(mid).not.toBeCloseTo(0.5, 2);
  });
});
