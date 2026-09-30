import { describe, expect, it } from 'vitest';
import { PRESET_NAMES, PRESETS } from '../src/core/effects/catalog';
import { coveredPresetNames, defaultContext, planEffect, type TrackChannel } from '../src/core/effects/plan';
import { roleForPreset } from '../src/core/effects/catalog';

describe('演出プラン', () => {
  it('カタログの全プリセットがプランになる', () => {
    expect(coveredPresetNames().sort()).toEqual([...PRESET_NAMES].sort());
    for (const name of PRESET_NAMES) {
      const plan = planEffect(name, {}, defaultContext(roleForPreset(name)));
      expect(plan.preset).toBe(name);
    }
  });

  it('fade は対象で別名になる', () => {
    expect(planEffect('fade', {}, defaultContext('bg')).preset).toBe('crossfade');
    expect(planEffect('fade', {}, defaultContext('show')).preset).toBe('fadeIn');
    expect(planEffect('fade', {}, defaultContext('hide')).preset).toBe('fadeOut');
  });

  it('camera shake は camShake', () => {
    const plan = planEffect('shake', { amount: 8 }, defaultContext('camera'));
    expect(plan.preset).toBe('camShake');
    expect(plan.channels.some((channel) => channel.type === 'oscillate')).toBe(true);
  });

  it('bounceIn は bounceOut で着地する', () => {
    const plan = planEffect('bounceIn', { duration: 0.4 }, defaultContext('show'));
    expect(plan.easing).toBe('bounceOut');
    expect(plan.duration).toBe(0.4);
    const y = plan.channels.find((channel) => channel.type === 'track' && channel.property === 'y') as TrackChannel;
    expect(y.keys[0].value).toBeLessThan(y.keys[1].value);
  });

  it('jump は縦に潰れる', () => {
    const plan = planEffect('jump', {}, defaultContext('fx'));
    const scaleY = plan.channels.find((channel) => channel.type === 'track' && channel.property === 'scaleY') as TrackChannel;
    expect(Math.min(...scaleY.keys.map((key) => key.value))).toBeLessThan(1);
  });

  it('wipe はマスク量を動かす', () => {
    const plan = planEffect('wipe', { direction: 'left' }, defaultContext('bg'));
    expect(plan.reveal).toBe('wipe');
    expect(plan.direction).toBe('left');
  });

  it('全演出に使い方の説明がある', () => {
    for (const preset of PRESETS) {
      expect(preset.detail.length).toBeGreaterThan(12);
      expect(preset.detail).toMatch(/[a-z]/);
    }
  });

  it('未知の演出は失敗する', () => {
    expect(() => planEffect('not-real', {}, defaultContext('fx'))).toThrow(/未知の演出/);
  });
});
