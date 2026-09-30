import { describe, expect, it } from 'vitest';
import { sampleBezier, sampleTrack } from '../src/core/effects/track';

describe('トラック補間', () => {
  const keys = [{ time: 0, value: 0 }, { time: 1, value: 100 }];

  it('線形の中点は 50', () => {
    expect(sampleTrack(keys, 0.5, 'linear')).toBe(50);
  });

  it('quadIn の中点は 50 未満', () => {
    expect(sampleTrack(keys, 0.5, 'quadIn')).toBeLessThan(50);
  });

  it('範囲外は端の値に吸着する', () => {
    expect(sampleTrack(keys, -1)).toBe(0);
    expect(sampleTrack(keys, 2)).toBe(100);
  });

  it('キーが1つならその値', () => {
    expect(sampleTrack([{ time: 0, value: 5 }], 0.4)).toBe(5);
  });

  it('空なら 0', () => {
    expect(sampleTrack([], 0.2)).toBe(0);
  });

  it('ベジェの端点', () => {
    expect(sampleBezier(0, 0, 50, -20, 100, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(sampleBezier(0, 0, 50, -20, 100, 0, 1)).toEqual({ x: 100, y: 0 });
  });
});
