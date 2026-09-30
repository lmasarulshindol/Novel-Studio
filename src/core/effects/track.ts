import { ease } from './easing';

export type Keyframe = {
  time: number;
  value: number;
};

export function sampleTrack(keys: Keyframe[], time: number, easingName = 'linear'): number {
  if (keys.length === 0) return 0;
  const sorted = [...keys].sort((a, b) => a.time - b.time);
  if (sorted.length === 1) return sorted[0].value;
  if (time <= sorted[0].time) return sorted[0].value;
  const last = sorted[sorted.length - 1];
  if (time >= last.time) return last.value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time || 1;
      const u = ease(easingName, (time - a.time) / span);
      return a.value + (b.value - a.value) * u;
    }
  }
  return last.value;
}

export function sampleBezier(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
  };
}
